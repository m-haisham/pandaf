use console::Style;
use eyre::{eyre, Context};
use strum::IntoEnumIterator;

use crate::{
    context::AppContext,
    git,
    project::{detect_project, Project},
    ui::BrushContext,
};

pub async fn print_branches(mut context: AppContext) -> eyre::Result<()> {
    let current_project = detect_project()?;
    let current_branch = git::current_branch().await.ok();

    for project in Project::iter() {
        let project_dir = project.dir()?;

        context
            .working_dir
            .change_dir(project_dir.clone())
            .map_err(|e| eyre!(e))
            .wrap_err("Failed to set current project")?;

        let branch = git::current_branch()
            .await
            .map_err(|e| eyre!(e))
            .wrap_err("Failed to get current branch")?;

        let commit = git::current_commit().await;

        let draw = BrushContext::new_from_context(&context);

        let style = Style::new();

        let style = if Some(&project) == current_project.as_ref() {
            style.bold()
        } else {
            style
        };

        let style = if Some(&branch) == current_branch.as_ref() {
            style.green()
        } else {
            style
        };

        let commit_output = match commit {
            Ok(commit) => {
                let commit = format!(
                    "; {} {}",
                    commit.short_hash,
                    commit.message.unwrap_or_default()
                );
                Style::new().apply_to(commit)
            }
            Err(e) => {
                let error = format!("; {}", e);
                Style::new().red().apply_to(error)
            }
        };

        let value = format!("{}{}", style.apply_to(branch), commit_output);

        draw.labeled_styled(project.name(), &value, &style)?;
    }

    Ok(())
}
