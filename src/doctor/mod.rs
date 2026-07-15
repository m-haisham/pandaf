mod project;

use std::{
    env::VarError,
    path::{Path, PathBuf},
};

use eyre::{eyre, WrapErr};
use strum::IntoEnumIterator;

use crate::{
    context::AppContext,
    env::get_hbt_root,
    project::Project,
    types::Outcome,
    ui::{components::LabeledLine, traits::Draw, BrushContext},
    utils::which,
};

#[allow(dead_code)] // We expect this to be used in the future
pub struct Health {
    env: HealthEnvironment,
    docker: HealthDocker,
    projects: Vec<project::ProjectHealth>,
}

pub struct HealthEnvironment {
    pub hbt_root: EnvDirHealth,
    pub hbt_docker_root: EnvDirHealth,
    pub path: Option<String>,
}

#[derive(Debug)]
pub struct EnvDirHealth {
    pub key: &'static str,
    pub outcome: EnvDirHealthOutcome,
}

#[derive(Debug)]
pub enum EnvDirHealthOutcome {
    Ok(String),
    InvalidDirectory(String),
    DoesNotExist(String),
    NotSet,
    NotUnicode,
}

impl EnvDirHealth {
    pub fn from_key(key: &'static str) -> Self {
        match std::env::var(key) {
            Ok(value) => {
                let path = Path::new(&value);
                if path.exists() {
                    if path.is_dir() {
                        Self {
                            key,
                            outcome: EnvDirHealthOutcome::Ok(value),
                        }
                    } else {
                        Self {
                            key,
                            outcome: EnvDirHealthOutcome::InvalidDirectory(value),
                        }
                    }
                } else {
                    Self {
                        key,
                        outcome: EnvDirHealthOutcome::DoesNotExist(value),
                    }
                }
            }
            Err(VarError::NotPresent) => Self {
                key,
                outcome: EnvDirHealthOutcome::NotSet,
            },
            Err(VarError::NotUnicode(_)) => Self {
                key,
                outcome: EnvDirHealthOutcome::NotUnicode,
            },
        }
    }

    pub fn as_line(&self) -> LabeledLine {
        match &self.outcome {
            EnvDirHealthOutcome::Ok(value) => LabeledLine::new(self.key.to_string(), value.clone()),
            EnvDirHealthOutcome::InvalidDirectory(value) => {
                LabeledLine::new(self.key.to_string(), value.clone())
                    .with_errors(vec!["Not a valid directory".to_string()])
            }
            EnvDirHealthOutcome::DoesNotExist(value) => {
                LabeledLine::new(self.key.to_string(), value.clone())
                    .with_errors(vec!["The path does not exist".to_string()])
            }
            EnvDirHealthOutcome::NotSet => {
                LabeledLine::new(self.key.to_string(), "Not set".to_string())
                    .with_errors(vec!["The path is not set".to_string()])
            }
            EnvDirHealthOutcome::NotUnicode => {
                LabeledLine::new(self.key.to_string(), "Not valid unicode".to_string())
                    .with_errors(vec!["The path is not valid unicode".to_string()])
            }
        }
    }
}

impl HealthEnvironment {
    pub fn draw(&self, brush: &BrushContext<'_>) -> eyre::Result<()> {
        brush.heading("Environment")?;
        brush.draw(&self.hbt_root.as_line())?;
        brush.draw(&self.hbt_docker_root.as_line())?;
        brush.labeled("PATH", self.path.as_deref().unwrap_or("Not set"))?;
        Ok(())
    }
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
