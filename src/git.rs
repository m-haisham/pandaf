use eyre::{eyre, Context};
use tokio::process::Command;

pub async fn current_branch() -> eyre::Result<String> {
    let output = Command::new("git")
        .arg("branch")
        .arg("--show-current")
        .output()
        .await
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to get current branch")?;

    let branch = String::from_utf8(output.stdout)
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to parse branch name")?
        .trim()
        .to_owned();

    Ok(branch)
}
