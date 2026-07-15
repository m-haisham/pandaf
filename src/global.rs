use crate::{
    docker,
    project::{set_current_project, HBT_PROJECTS},
};

pub async fn start_all_projects(args: &[String]) -> eyre::Result<()> {
    for app in HBT_PROJECTS {
        set_current_project(app).await?;
        docker::compose_up(args).await?;
    }

    Ok(())
}

pub async fn stop_all_projects(args: &[String]) -> eyre::Result<()> {
    for app in HBT_PROJECTS {
        set_current_project(app).await?;
        docker::compose_down(args).await?;
    }

    Ok(())
}
