mod env;
mod project;

use env::{EnvDirHealth, HealthEnvironment};
use eyre::{eyre, WrapErr};
use strum::IntoEnumIterator;

use crate::{
    context::AppContext, env::get_hbt_root, project::Project, ui::BrushContext, utils::which,
};

#[allow(dead_code)] // We expect this to be used in the future
pub struct Health {
    env: HealthEnvironment,
    docker: HealthDocker,
    projects: Vec<project::ProjectHealth>,
}

pub struct HealthDocker {
    pub version: Option<String>,
    pub compose_version: Option<String>,
    pub path: Option<String>,
}

impl HealthDocker {
    pub fn draw(&self) {
        println!("Docker:");

        println!(
            "- {}",
            self.version.as_deref().unwrap_or("Version: Not available")
        );
        println!(
            "- {}",
            self.compose_version
                .as_deref()
                .unwrap_or("Compose Version: Not available")
        );
        println!("- PATH: {}", self.path.as_deref().unwrap_or("Not set"));
    }
}

pub async fn check_health(context: AppContext) -> eyre::Result<Health> {
    let env = HealthEnvironment {
        hbt_root: EnvDirHealth::from_key("HBT_OOT"),
        hbt_docker_root: EnvDirHealth::from_key("HBT_DOCKER_ROOT"),
        path: which("hbt").await?,
    };

    let brush = BrushContext::new_from_context(&context);

    env.draw(&brush)?;

    let docker = HealthDocker {
        version: docker_version().await?,
        compose_version: docker_compose_version().await?,
        path: which("docker").await?,
    };

    docker.draw();

    let mut projects = Vec::new();

    println!("Projects:");
    if let Ok(hbt_root) = get_hbt_root() {
        for project in Project::iter() {
            let Some(dir_name) = project.dir_name() else {
                continue;
            };

            let dir = hbt_root.join(dir_name);
            if let Err(e) = std::env::set_current_dir(&dir) {
                println!("  {} - {e}", project.name());
                continue;
            }

            let project_health = project::check_project_health(project, &dir).await?;
            println!();

            projects.push(project_health);
        }
    }

    Ok(Health {
        env,
        docker,
        projects,
    })
}

async fn docker_version() -> eyre::Result<Option<String>> {
    let result = tokio::process::Command::new("docker")
        .arg("--version")
        .output()
        .await
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to check Docker version")?;

    if result.status.success() {
        let version = String::from_utf8(result.stdout)
            .map_err(|e| eyre!(e))
            .wrap_err("Failed to parse Docker version output")?
            .trim()
            .to_string();

        Ok(Some(version))
    } else {
        Ok(None)
    }
}

async fn docker_compose_version() -> eyre::Result<Option<String>> {
    let result = tokio::process::Command::new("docker-compose")
        .arg("--version")
        .output()
        .await
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to check Docker Compose version")?;

    if result.status.success() {
        let version = String::from_utf8(result.stdout)
            .map_err(|e| eyre!(e))
            .wrap_err("Failed to parse Docker Compose version output")?
            .trim()
            .to_string();

        Ok(Some(version))
    } else {
        Ok(None)
    }
}
