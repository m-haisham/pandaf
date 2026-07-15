use std::collections::BTreeMap;

use color_eyre::Section;
use eyre::eyre;
use strum::IntoEnumIterator;

use crate::{
    context::AppContext,
    docker::ping_docker,
    env::get_hbt_root,
    git::{self, GitInfo, Repository},
    ui::BrushContext,
};

use super::start_all_projects;

#[tracing::instrument(skip_all)]
pub async fn start_work(context: AppContext) -> eyre::Result<()> {
    let brush = BrushContext::new_from_context(&context);

    ping_docker()
        .await
        .map_err(|e| eyre!(e))
        .with_suggestion(|| "Failed to connect to docker. Make sure docker is running.")?;

    brush.heading("Starting project containers...")?;
    start_all_projects(&[]).await?;

    let git_infos = get_repository_git_infos(&context).await?;

    Ok(())
}

pub async fn get_repository_git_infos(
    context: &AppContext,
) -> eyre::Result<BTreeMap<Repository, GitInfo>> {
    let mut git_infos = BTreeMap::new();

    for repository in Repository::iter() {
        let hbt_root = get_hbt_root()?;
        let repository_dir = hbt_root.join(repository.dir_name());

        let git_info = context
            .working_dir
            .with_working_dir(&repository_dir, async |_| git::git_info().await)
            .await?;

        git_infos.insert(repository, git_info);
    }

    Ok(git_infos)
}
