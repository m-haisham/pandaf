use std::{
    env::current_dir,
    fs::File,
    io::{BufReader, BufWriter, Seek, SeekFrom, Write},
    path::Path,
};

use chrono::Utc;
use color_eyre::Section;
use eyre::{eyre, Context};
use itertools::Itertools;
use strum::IntoEnumIterator;
use tempfile::TempDir;

use super::types::{MysqlDump, RepositorySnapshot, SnapshotManifest, SnapshotOptions};
use crate::{
    compress,
    context::{AppContext, WorkingDir},
    db,
    git::{self, Repository},
    snapshot::{types::SnapshotFile, utils::hash_as_hex, MANIFEST_FILE, MYSQL_DUMPS_DIR},
};

#[tracing::instrument(skip_all)]
pub async fn create_snapshot(context: AppContext, options: SnapshotOptions) -> eyre::Result<()> {
    tracing::info!("Creating snapshot...");

    let data_dir = context.data_dir()?;

    let tempdir = tempfile::tempdir_in(&data_dir)
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to create temporary directory")?;

    // This is just for logging purposes, the performance impact is acceptable.
    let tempdir_name = tempdir
        .path()
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| tempdir.path().display().to_string());

    tracing::info!(
        "Created temporary directory to pack snapshot: {}",
        tempdir_name
    );

    let repositories = create_repository_snapshots(&context.working_dir).await?;

    let mysql_dumps = store_database_dumps(&tempdir, &options)
        .await
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to store database dumps")?;

    let manifest = SnapshotManifest {
        repositories,
        mysql_dumps,
        created_at: Utc::now(),
    };

    store_manifest(&tempdir, &manifest)
        .await
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to store manifest")?;

    let snapshot_file = tempfile::tempfile_in(&data_dir)
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to create snapshot file")?;

    let snapshot_file = pack_snapshot(&tempdir, snapshot_file)
        .await
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to pack snapshot")?;

    let output_path = current_dir()?.join("snapshot.zip");
    copy_snapshot(snapshot_file, &output_path)
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to copy snapshot")?;

    Ok(())
}

#[tracing::instrument(skip_all)]
pub async fn create_repository_snapshots(
    working_dir: &WorkingDir,
) -> eyre::Result<Vec<RepositorySnapshot>> {
    tracing::info!("Creating repository snapshots...");

    let mut snapshots = vec![];

    for repository in Repository::iter() {
        let snapshot = repository_snapshot(working_dir, repository).await?;
        snapshots.push(snapshot);
    }

    Ok(snapshots)
}

#[tracing::instrument(skip_all)]
pub async fn repository_snapshot(
    working_dir: &WorkingDir,
    repository: Repository,
) -> eyre::Result<RepositorySnapshot> {
    tracing::info!("Creating snapshot for repository: {}", repository);

    let repository_dir = repository.dir()?;
    let git_info = working_dir
        .with_working_dir(&repository_dir, async |_| git::git_info().await)
        .await?;

    let snapshot = RepositorySnapshot {
        repository,
        branch: git_info.branch,
        origin: git_info.origin,
    };

    Ok(snapshot)
}

pub async fn store_database_dumps(
    temp_dir: &TempDir,
    options: &SnapshotOptions,
) -> eyre::Result<Vec<MysqlDump>> {
    tracing::info!("Dumping databases for snapshot...");

    let mysql_dumps_dir = temp_dir.path().join(MYSQL_DUMPS_DIR);
    if !mysql_dumps_dir.exists() {
        std::fs::create_dir(&mysql_dumps_dir)
            .map_err(|e| eyre!(e))
            .wrap_err("Failed to create MySQL dumps directory")?;
    }

    let configured_dbs = db::get_configured_dbs().await?;
    let mut database_dumps = vec![];

    let databases_to_dump = match options.include_databases.as_ref() {
        Some(include_databases) => {
            let databases_not_found = include_databases
                .iter()
                .filter(|db| {
                    !configured_dbs
                        .iter()
                        .find(|conf| conf.db_database == db.as_str())
                        .is_some()
                })
                .cloned()
                .collect::<Vec<_>>();

            if !databases_not_found.is_empty() {
                return Err(eyre!(
                    "Databases not found: {}",
                    databases_not_found.join(", ")
                ))
                .with_suggestion(|| {
                    let available_databases =
                        configured_dbs.iter().map(|db| &db.db_database).join(", ");
                    format!("Please select from the following: {}", available_databases)
                });
            }

            configured_dbs
                .into_iter()
                .filter(|db| include_databases.contains(&db.db_database))
                .collect::<Vec<_>>()
        }
        None => configured_dbs,
    };

    for project_db in databases_to_dump {
        tracing::info!("Dumping database {}", project_db.project.name());

        let (dump_name, dump_path) = db::dump_project(&project_db, &mysql_dumps_dir)
            .await
            .wrap_err_with(|| format!("Failed to dump database {}", project_db.project.name()))?;

        let dump_path_relative = dump_path
            .strip_prefix(temp_dir.path())
            .map_err(|e| eyre!(e))
            .wrap_err("Failed to get relative path to database dump")?;

        let file = File::open(&dump_path)
            .map_err(|e| eyre!(e))
            .wrap_err("Failed to open dump file")?;

        let metadata = file
            .metadata()
            .map_err(|e| eyre!(e))
            .wrap_err("Failed to get file metadata")?;

        let size = metadata.len();

        let mut reader = BufReader::new(file);
        let hash = hash_as_hex(&mut reader)?;

        let dump = MysqlDump {
            project: project_db.project,
            file: SnapshotFile {
                name: dump_name,
                path: dump_path_relative.to_path_buf(),
                size,
                hash,
            },
        };

        database_dumps.push(dump);
    }

    Ok(database_dumps)
}

pub async fn store_manifest(tempdir: &TempDir, manifest: &SnapshotManifest) -> eyre::Result<()> {
    tracing::info!("Storing manifest as {}...", MANIFEST_FILE);

    let manifest_path = tempdir.path().join(MANIFEST_FILE);
    let manifest_json = serde_json::to_string_pretty(manifest)
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to serialize manifest")?;

    let file = File::create(&manifest_path)
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to create manifest file")?;

    let mut writer = BufWriter::new(file);

    writer
        .write_all(manifest_json.as_bytes())
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to write manifest to file")?;

    Ok(())
}

pub async fn pack_snapshot(tempdir: &TempDir, snapshot_file: File) -> eyre::Result<File> {
    tracing::info!("Packing manifest into zip file...");

    let writer = std::io::BufWriter::new(snapshot_file);

    let writer = compress::zip_dir(writer, tempdir.path())
        .await
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to compress snapshot")?;

    let mut snapshot_file = writer
        .into_inner()
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to finalize snapshot file")?;

    snapshot_file
        .seek(SeekFrom::Start(0))
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to seek snapshot file")?;

    Ok(snapshot_file)
}

pub fn copy_snapshot(source: File, destination: &Path) -> eyre::Result<()> {
    tracing::info!("Copying final snapshot to {}...", destination.display());

    let mut reader = BufReader::new(source);

    let destination_file = File::create(destination)
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to create destination file")?;

    let mut writer = BufWriter::new(destination_file);

    std::io::copy(&mut reader, &mut writer)
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to copy snapshot")?;

    Ok(())
}
