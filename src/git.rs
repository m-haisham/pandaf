use std::path::Path;

use eyre::{eyre, Context};
use tokio::process::Command;

pub async fn checkout(branch_name: &str) -> eyre::Result<()> {
    let output = Command::new("git")
        .arg("checkout")
        .arg(branch_name)
        .output()
        .await
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to checkout branch")?;

    if !output.status.success() {
        return Err(eyre!("Failed to checkout branch"));
    }

    Ok(())
}

/// Checkout the first branch in the list that exists in the project repository
pub async fn checkout_first<'a>(branches: &[&'a str]) -> eyre::Result<&'a str> {
    for branch in branches {
        let checkout_result = checkout(branch).await;
        match checkout_result {
            Ok(_) => return Ok(*branch),
            Err(e) => {
                // Some of these are expected, so we only log them as debug
                tracing::debug!("Failed to checkout branch: {}", e);
            }
        }
    }

    Err(eyre!(
        "None of the branches exist in the project repository"
    ))
}

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

#[derive(Debug)]
pub struct GitCommit {
    pub hash: String,
    pub short_hash: String,
    pub message: Option<String>,
    pub long_message: Option<String>,
}

pub async fn current_commit() -> eyre::Result<GitCommit> {
    let output = Command::new("git")
        .arg("log")
        .arg("-1")
        .arg("--pretty=format:%H %s %b")
        .output()
        .await
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to get current commit")?;

    let output = String::from_utf8(output.stdout)
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to parse commit")?;

    let mut parts = output.splitn(2, ' ');

    let hash = parts
        .next()
        .ok_or_else(|| eyre!("Failed to parse commit hash"))?
        .to_owned();

    let short_hash = hash
        .get(..7)
        .ok_or_else(|| eyre!("Failed to get short hash"))?
        .to_owned();

    let full_message = parts
        .next()
        .ok_or_else(|| eyre!("Failed to get commit message"))?
        .trim();

    let mut message_parts = full_message.splitn(2, '\n');

    let message = message_parts.next().map(|s| s.trim().to_owned());
    let long_message = message_parts.next().map(|s| s.trim().to_owned());

    Ok(GitCommit {
        hash,
        short_hash,
        message,
        long_message,
    })
}

pub async fn current_origin() -> eyre::Result<String> {
    let output = Command::new("git")
        .arg("remote")
        .arg("get-url")
        .arg("origin")
        .output()
        .await
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to get origin URL")?;

    let origin = String::from_utf8(output.stdout)
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to parse origin URL")?
        .trim()
        .to_owned();

    Ok(origin)
}

pub async fn git_clone(url: &str, dir: &Path) -> eyre::Result<()> {
    Command::new("git")
        .arg("clone")
        .arg(url)
        .arg(dir)
        .output()
        .await
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to clone repository")?;

    Ok(())
}
