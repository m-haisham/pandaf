use std::path::{Path, PathBuf};

use dialoguer::MultiSelect;
use eyre::{eyre, WrapErr};
use itertools::Itertools;
use strum::IntoEnumIterator;

use crate::{
    env::get_hbt_root,
    git::{self, Repository},
};

pub async fn setup_projects(non_interactive: bool) -> eyre::Result<()> {
    let projects = if non_interactive {
        tracing::info!("Non-interactive mode enabled, skipping project selection");
        Repository::iter().collect_vec()
    } else {
        prompt_projects()?
    };

    for project in projects {
        setup_project(&project).await?;
    }

    Ok(())
}

fn prompt_projects() -> eyre::Result<Vec<Repository>> {
    let required_projects = [Repository::DevEnvironment];

    let projects = Repository::iter()
        .filter(|p| !required_projects.contains(p))
        .collect::<Vec<_>>();

    let selected_indexes = MultiSelect::new()
        .with_prompt("Select the projects you want to setup")
        .items(&projects)
        .interact()
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to get input")?;

    let selected_projects = required_projects
        .into_iter()
        .chain(
            selected_indexes
                .into_iter()
                .flat_map(|index| projects.get(index).cloned()),
        )
        .collect_vec();

    Ok(selected_projects)
}

#[tracing::instrument]
pub async fn setup_project(repo: &Repository) -> eyre::Result<()> {
    tracing::info!("Setting up repository: {}", repo);

    let hbt_root = get_hbt_root()?;
    let dir = hbt_root.join(repo.dir_name());

    if dir.exists() && dir.is_file() {
        return Err(eyre!("Project directory is a file"));
    }

    if !dir.exists() {
        std::fs::create_dir_all(&dir)
            .map_err(|e| eyre!(e))
            .wrap_err("Failed to create project directory")?;

        git::git_clone(repo.url(), &dir)
            .await
            .wrap_err("Failed to clone project repository")?;

        tracing::info!("Cloned project repository to {}", dir.display());
    } else {
        tracing::info!("Project directory already exists, skipping cloning");
    }

    setup_project_env(&dir)
        .await
        .wrap_err("Failed to setup project environment")?;

    Ok(())
}

async fn setup_project_env(project_dir: &Path) -> eyre::Result<PathBuf> {
    let env_file = project_dir.join(".env");

    if env_file.exists() {
        tracing::info!("Environment file already exists, skipping setup");
    } else {
        tracing::info!("Creating environment file");

        let env_example_file = project_dir.join(".env.example");
        if !env_example_file.exists() {
            return Err(eyre!("Environment example file not found"));
        }

        std::fs::copy(&env_example_file, &env_file)
            .map_err(|e| eyre!(e))
            .wrap_err("Failed to copy environment example file")?;
    }

    Ok(env_file)
}
