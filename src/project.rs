use clap::Parser;
use eyre::{eyre, WrapErr};
use serde::Deserialize;
use std::{
    env::set_current_dir,
    path::{Path, PathBuf},
};
use strum::EnumIter;

use crate::{compress, docker, env::get_hbt_root, infra::InfraEnv, kebab::Kebab};

#[derive(Debug, EnumIter)]
pub enum Project {
    Traefik,
    Infra,
    Gateway,
    Rates,
    Search,
    Operations,
    Foundation,
    Products,
    ApiGateway,
    App,
    Nest,
}

impl Project {
    pub fn name(&self) -> &str {
        match self {
            Project::Traefik => "traefik",
            Project::Infra => "infra",
            Project::Gateway => "gateway",
            Project::Rates => "rates",
            Project::Search => "search",
            Project::Operations => "operations",
            Project::Foundation => "foundation",
            Project::Products => "products",
            Project::ApiGateway => "apigateway",
            Project::App => "app",
            Project::Nest => "nest",
        }
    }

    pub fn dir_name(&self) -> &str {
        match self {
            Project::Traefik => "traefik",
            Project::Infra => "infra",
            Project::Gateway => "gateway-app",
            Project::Rates => "rates",
            Project::Search => "search",
            Project::Operations => "operations",
            Project::Foundation => "foundation",
            Project::Products => "products",
            Project::ApiGateway => "apigateway",
            Project::App => "hummingbird-app",
            Project::Nest => "nest-app",
        }
    }
}

pub async fn set_current_project(project: &Project) -> eyre::Result<()> {
    tracing::info!("Setting current directory to {}", project.name());

    let hbt_docker_root = std::env::var("HBT_DOCKER_ROOT")
        .map_err(|e| eyre!(e))
        .wrap_err("HBT_DOCKER_ROOT not set")?;

    let project_dir = Path::new(&hbt_docker_root).join(format!("hbt-{}", project.name()));

    set_current_dir(project_dir)
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to change directory")?;

    Ok(())
}

#[tracing::instrument]
pub fn detect_project() -> eyre::Result<Option<Project>> {
    let current_dir = std::env::current_dir()
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to get current directory")?;

    let mut current_dir = Some(current_dir);

    while let Some(dir) = current_dir {
        tracing::info!("Checking directory for project: {}", dir.display());

        let Some(dir_name) = dir.file_name() else {
            tracing::warn!("Directory does not have a valid name: {}", dir.display());
            break;
        };

        let Some(dir_name) = dir_name.to_str() else {
            tracing::warn!("Directory name is not valid UTF-8: {}", dir.display());
            break;
        };

        if let Some(project) = dir_name_to_project(dir_name) {
            return Ok(Some(project));
        }

        current_dir = dir.parent().map(|dir| dir.to_path_buf());
    }

    Ok(None)
}

pub fn dir_name_to_project(name: &str) -> Option<Project> {
    match name {
        "traefik" => Some(Project::Traefik),
        "infra" => Some(Project::Infra),
        "apigateway" => Some(Project::ApiGateway),
        "gateway" | "gateway-app" => Some(Project::Gateway),
        "rates" => Some(Project::Rates),
        "search" => Some(Project::Search),
        "operations" => Some(Project::Operations),
        "foundation" => Some(Project::Foundation),
        "products" => Some(Project::Products),
        "app" | "hummingbird-app" => Some(Project::App),
        "nest" | "nest-app" => Some(Project::Nest),
        _ => None,
    }
}

#[derive(Debug, Parser)]
pub enum ProjectCommands {
    /// Start the project
    Up { rest: Vec<String> },
    /// Stop the project
    Down { rest: Vec<String> },
    /// Restart the project
    Restart { rest: Vec<String> },
    /// Start an interactive shell in the project
    Shell { rest: Vec<String> },
    /// Alias for node in the project
    Node { rest: Vec<String> },
    /// Alias for npm in the project
    Npm { rest: Vec<String> },
    /// Alias for yarn in the project
    Yarn { rest: Vec<String> },
    /// Alias for php in the project
    Php { rest: Vec<String> },
    /// Alias for artisan in the project
    Artisan { rest: Vec<String> },
    /// Alias for composer in the project
    Composer { rest: Vec<String> },
    /// Alias for phpunit in the project
    Phpunit { rest: Vec<String> },
    /// Dump the database
    Dump {
        /// A unique key to identify the dump
        key: Option<Kebab>,
    },
    /// Restore from a dump
    Restore {
        /// The path to the dump file
        path: PathBuf,
    },
}

#[derive(Debug, Deserialize)]
pub struct ProjectEnv {
    pub db_database: String,
}

#[tracing::instrument]
pub async fn read_project_env(project: &Project) -> eyre::Result<Option<ProjectEnv>> {
    tracing::info!("Reading environment for project: {}", project.name());

    let hbt_root = get_hbt_root()?;
    let env_path = hbt_root.join(project.dir_name()).join(".env");

    if !env_path.exists() {
        return Ok(None);
    }

    let env = crate::env::read_env(&env_path).await?;

    Ok(Some(env))
}

#[tracing::instrument(skip(infra_env, dump_dir))]
pub async fn dump_project_db(
    project: &Project,
    infra_env: &InfraEnv,
    dump_dir: &Path,
) -> eyre::Result<()> {
    tracing::info!("Dumping {}...", project.name());

    let project_env = read_project_env(&project).await?;
    let Some(project_env) = project_env else {
        return Err(eyre!("No environment found for {}", project.name()));
    };

    let dump_file = dump_dir.join(format!("{}.sql.gz", project.dir_name()));

    let dump =
        match docker::mysql_dump(&project_env.db_database, &infra_env.mysql_db_password).await {
            Ok(dump) => dump,
            Err(e) => {
                return Err(eyre!(
                    "Failed to dump database for {}: {}",
                    project.name(),
                    e
                ));
            }
        };

    tracing::info!("Dumped {} bytes", dump.len());

    let dump = compress::gzip(&dump).await?;
    tracing::info!("Compressed dump to {} bytes", dump.len());

    std::fs::write(&dump_file, dump)
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to write dump to file")?;

    tracing::info!("Wrote dump to file {}", dump_file.display());

    Ok(())
}
