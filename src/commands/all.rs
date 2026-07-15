use strum::IntoEnumIterator;

use crate::{
    docker,
    project::{set_current_project, Project},
};

pub async fn start_all_projects(args: &[String]) -> eyre::Result<()> {
    let docker_projects = Project::iter().filter_map(|p| p.container().map(|c| (p, c)));

    for (project, container) in docker_projects {
        set_current_project(&project).await?;
        docker::compose_up(args).await?;
    }

    Ok(())
}

pub async fn stop_all_projects(args: &[String]) -> eyre::Result<()> {
    let docker_projects = Project::iter().filter_map(|p| p.container().map(|c| (p, c)));

    for (project, container) in docker_projects {
        set_current_project(&project).await?;
        docker::compose_down(args).await?;
    }

    Ok(())
}
