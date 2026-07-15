mod types;

use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use directories::ProjectDirs;
use eyre::{eyre, Context};
use hex::ToHex;
use sha2::Digest;
use tempfile::TempDir;
use tokio::io::{AsyncReadExt, AsyncWriteExt, BufWriter};
use types::{MysqlDump, SnapshotManifest};

use crate::{compress, context::AppContext, db};

const MYSQL_DUMPS_DIR: &str = "mysql_dumps";
const MANIFEST_FILE: &str = "manifest.json";

pub async fn create_snapshot(context: AppContext) -> eyre::Result<()> {
    let dirs = context.dirs()?;

    let tempdir = tempfile::tempdir_in(&dirs.data_dir().join("tmp"))
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to create temporary directory")?;

    let mysql_dumps = store_database_dumps(&tempdir)
        .await
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to store database dumps")?;

    let manifest = SnapshotManifest {
        mysql_dumps,
        created_at: Utc::now(),
    };

    store_manifest(&tempdir, &manifest)
        .await
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to store manifest")?;

    let snapshot_path = pack_snapshot(&tempdir, Path::new(MANIFEST_FILE))
        .await
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to pack snapshot")?;

    Ok(())
}

pub async fn store_database_dumps(temp_dir: &TempDir) -> eyre::Result<Vec<MysqlDump>> {
    let mysql_dumps_dir = temp_dir.path().join(MYSQL_DUMPS_DIR);
    if !mysql_dumps_dir.exists() {
        std::fs::create_dir(&mysql_dumps_dir)
            .map_err(|e| eyre!(e))
            .wrap_err("Failed to create MySQL dumps directory")?;
    }

    let configured_dbs = db::get_configured_dbs().await?;
    let mut database_dumps = vec![];

    for project_db in configured_dbs {
        let (dump_name, dump_path) = db::dump_project(&project_db, &mysql_dumps_dir)
            .await
            .wrap_err_with(|| format!("Failed to dump database {}", project_db.project.name()))?;

        let file = tokio::fs::File::open(&dump_path)
            .await
            .map_err(|e| eyre!(e))
            .wrap_err("Failed to open dump file")?;

        let metadata = file
            .metadata()
            .await
            .map_err(|e| eyre!(e))
            .wrap_err("Failed to get file metadata")?;

        let size = metadata.len();
        let hash = hash_file(file).await?;

        let dump = MysqlDump {
            file: types::SnapshotFile {
                name: dump_name,
                path: dump_path,
                size,
                hash,
            },
        };

        database_dumps.push(dump);
    }

    Ok(database_dumps)
}

pub async fn store_manifest(tempdir: &TempDir, manifest: &SnapshotManifest) -> eyre::Result<()> {
    let manifest_path = tempdir.path().join("manifest.json");
    let manifest_json = serde_json::to_string_pretty(manifest)
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to serialize manifest")?;

    let file = tokio::fs::File::create(&manifest_path)
        .await
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to create manifest file")?;

    let mut writer = BufWriter::new(file);

    writer
        .write_all(manifest_json.as_bytes())
        .await
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to write manifest to file")?;

    Ok(())
}

pub async fn pack_snapshot(tempdir: &TempDir, target_path: &Path) -> eyre::Result<PathBuf> {
    let target_file = std::fs::File::create(target_path)
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to create target file")?;

    let writer = std::io::BufWriter::new(target_file);

    compress::zip_dir(writer, tempdir.path())
        .await
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to compress snapshot")?;

    Ok(PathBuf::new())
}

pub async fn hash_file(file: tokio::fs::File) -> eyre::Result<String> {
    use sha2::Sha256;

    let mut reader = tokio::io::BufReader::new(file);
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 4096];

    loop {
        let read = reader
            .read(&mut buffer)
            .await
            .map_err(|e| eyre!(e))
            .wrap_err("Failed to read from file")?;

        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }

    Ok(hasher.finalize().encode_hex())
}
