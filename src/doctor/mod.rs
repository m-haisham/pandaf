mod docker;
mod env;
mod project;

use docker::DockerHealth;
use env::{EnvDirHealth, HealthEnvironment};
use strum::IntoEnumIterator;

use crate::{
    context::AppContext, env::get_hbt_root, project::Project, ui::BrushContext, utils::which,
};

#[allow(dead_code)]
pub struct Health {
    env: HealthEnvironment,
    docker: DockerHealth,
    projects: Vec<project::ProjectHealth>,
}

pub async fn check_health(context: AppContext) -> eyre::Result<Health> {
    let brush = BrushContext::new_from_context(&context);

    let env = HealthEnvironment {
        hbt_root: EnvDirHealth::from_key("HBT_ROOT"),
        hbt_docker_root: EnvDirHealth::from_key("HBT_DOCKER_ROOT"),
        path: which("hbt").await?,
    };

    brush.draw(&env)?;

    let docker = DockerHealth::new().await;

    brush.draw(&docker)?;

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
