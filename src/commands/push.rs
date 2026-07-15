use strum::IntoEnumIterator;

use crate::{
    context::AppContext,
    git::git_changes,
    project::Project,
    ui::{components::LabeledLine, traits::Draw, BrushContext},
};

pub async fn push_all_projects(mut context: AppContext) -> eyre::Result<()> {
    for project in Project::iter() {
        push_project(&mut context, &project).await?;
    }

    Ok(())
}

async fn push_project(context: &mut AppContext, project: &Project) -> eyre::Result<()> {
    context.working_dir.change_dir(project.dir()?)?;

    let brush = BrushContext::new_from_context(&context);
    let changes = git_changes().await?;

    if !changes.is_empty() {
        let new_changes = changes.iter().filter(|c| c.status.is_added()).count();
        let modified_changes = changes.iter().filter(|c| c.status.is_modified()).count();
        let deleted_changes = changes.iter().filter(|c| c.status.is_deleted()).count();
        let other_changes = changes.len() - new_changes - modified_changes - deleted_changes;

        let change_summary = [
            brush
                .styles
                .success
                .apply_to(format!("{} new", new_changes))
                .to_string(),
            brush
                .styles
                .warning
                .apply_to(format!("{} modified", modified_changes))
                .to_string(),
            brush
                .styles
                .error
                .apply_to(format!("{} deleted", deleted_changes))
                .to_string(),
            format!("{} other", other_changes),
        ]
        .join(" ");

        let line = LabeledLine::new(
            project.name().to_string(),
            format!("Uncommitted changes ({change_summary})"),
        );

        line.draw(&brush)?;
        return Ok(());
    }

    let line = LabeledLine::new(project.name().to_string(), "Pushing changes".to_string());
    brush.draw(&line)?;

    Ok(())
}
