use std::collections::BTreeMap;

use color_eyre::Section;
use eyre::eyre;
use itertools::Itertools;
use strum::IntoEnumIterator;

use crate::{
    context::AppContext,
    docker::ping_docker,
    env::get_hbt_root,
    git::{self, GitInfo, Repository},
    ui::BrushContext,
};

use super::{print_branches, start_all_projects};

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

    brush.write_newline()?;
    brush.heading("Branches:")?;
    print_branches(&context).await?;

    check_working_branch(&brush, &git_infos).await?;

    Ok(())
}

pub async fn check_working_branch(
    brush: &BrushContext<'_>,
    git_infos: &BTreeMap<Repository, GitInfo>,
) -> eyre::Result<()> {
    brush.write_newline()?;
    brush.heading("Checking working branch...")?;

    let grouped = git_infos
        .iter()
        .chunk_by(|(_, git_info)| git_info.branch.clone())
        .into_iter()
        .map(|(branch, i)| (branch, i.collect()))
        .collect::<BTreeMap<String, Vec<(&Repository, &GitInfo)>>>();

    let main_branches = ["main", "master", "develop"];
    let feature_branches = grouped
        .keys()
        .filter(|branch| !main_branches.contains(&branch.as_str()))
        .collect::<Vec<&String>>();

    match feature_branches.len() {
        0 => {
            brush.write_line("No feature branches found.")?;
        }
        1 => {
            brush.write_line("Found feature branch:")?;
            brush.indented(|brush| {
                brush.write_line(feature_branches[0])?;
                Ok::<_, eyre::Report>(())
            })?;
        }
        _ => {
            brush.write_warning("Multiple feature branches found:")?;
            brush.indented(|brush| {
                for branch in feature_branches {
                    brush.write_warning(branch)?;
                }
                Ok::<_, eyre::Report>(())
            })?;
            brush.write_newline()?;
            brush.write_warning(
                "Consider cleaning up your feature branches to avoid conflicting behaviour.",
            )?;
        }
    }

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
