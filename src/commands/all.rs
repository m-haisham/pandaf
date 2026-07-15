use strum::IntoEnumIterator;

use crate::{docker, project::Project};

pub async fn start_all_projects(args: &[String]) -> eyre::Result<()> {
    let docker_projects = Project::iter().filter_map(|p| p.container());

    for container in docker_projects {
        docker::compose_up(&container.compose_file()?, args).await?;
    }

    Ok(())
}

pub async fn stop_all_projects(args: &[String]) -> eyre::Result<()> {
    let docker_projects = Project::iter().filter_map(|p| p.container());

    for container in docker_projects {
        docker::compose_down(&container.compose_file()?, args).await?;
    }

    Ok(())
}
