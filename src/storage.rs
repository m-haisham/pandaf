use eyre::{eyre, WrapErr};
use std::path::{Path, PathBuf};

use tempfile::TempDir;

use crate::env::get_hbt_root;

#[derive(Debug)]
pub struct Storage {
    dir: PathBuf,
    provider: StorageProvider,
}

#[derive(Debug)]
pub enum StorageProvider {
    Local,
}

impl Storage {
    pub fn local() -> eyre::Result<Self> {
        Ok(Self {
            dir: get_hbt_root()?.join(".hbt").join("storage"),
            provider: StorageProvider::Local,
        })
    }

    pub fn save<R: std::io::Read>(&self, path: &Path, reader: &mut R) -> std::io::Result<()> {
        match &self.provider {
            StorageProvider::Local => {
                let file_path = self.dir.join(path);
                if let Some(parent) = file_path.parent() {
                    std::fs::create_dir_all(parent)?;
                }

                let mut file = std::fs::File::create(file_path)?;
                std::io::copy(reader, &mut file)?;
            }
        }

        Ok(())
    }

    pub fn copy(&self, from: &Path, to: &Path) -> std::io::Result<()> {
        match &self.provider {
            StorageProvider::Local => {
                std::fs::copy(self.dir.join(from), self.dir.join(to))?;
            }
        }

        Ok(())
    }

    pub fn remove(&self, path: &Path) -> std::io::Result<()> {
        match &self.provider {
            StorageProvider::Local => {
                std::fs::remove_file(self.dir.join(path))?;
            }
        }

        Ok(())
    }

    pub fn temp_dir(&self) -> eyre::Result<TempDir> {
        match &self.provider {
            StorageProvider::Local => {
                let temp_dir = tempfile::tempdir_in(&self.dir)
                    .map_err(|e| eyre!(e))
                    .wrap_err("Failed to create temporary directory")?;

                Ok(temp_dir)
            }
        }
    }
}
