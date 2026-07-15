use std::path::PathBuf;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::project::Project;

#[derive(Debug, Serialize, Deserialize)]
pub struct SnapshotManifest {
    pub repositories: Vec<RepositorySnapshot>,
    pub mysql_dumps: Vec<MysqlDump>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MysqlDump {
    pub file: SnapshotFile,
    pub project: Project,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SnapshotFile {
    pub name: String,
    pub path: PathBuf,
    pub size: u64,
    pub hash: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RepositorySnapshot {
    pub branch: String,
    pub origin: String,
}
