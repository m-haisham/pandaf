use std::{env::VarError, path::Path};

use crate::ui::{components::LabeledLine, BrushContext};

pub struct HealthEnvironment {
    pub hbt_root: EnvDirHealth,
    pub hbt_docker_root: EnvDirHealth,
    pub path: Option<String>,
}

impl HealthEnvironment {
    pub fn draw(&self, brush: &BrushContext<'_>) -> eyre::Result<()> {
        brush.heading("Environment")?;
        brush.draw(&self.hbt_root.as_line())?;
        brush.draw(&self.hbt_docker_root.as_line())?;
        brush.labeled("PATH", self.path.as_deref().unwrap_or("Not set"))?;
        Ok(())
    }
}

#[derive(Debug)]
pub struct EnvDirHealth {
    pub key: &'static str,
    pub outcome: EnvDirHealthOutcome,
}

#[derive(Debug)]
pub enum EnvDirHealthOutcome {
    Ok(String),
    InvalidDirectory(String),
    DoesNotExist(String),
    NotSet,
    NotUnicode,
}

impl EnvDirHealth {
    pub fn from_key(key: &'static str) -> Self {
        match std::env::var(key) {
            Ok(value) => {
                let path = Path::new(&value);
                if !path.exists() {
                    return Self {
                        key,
                        outcome: EnvDirHealthOutcome::DoesNotExist(value),
                    };
                }

                if path.is_dir() {
                    Self {
                        key,
                        outcome: EnvDirHealthOutcome::Ok(value),
                    }
                } else {
                    Self {
                        key,
                        outcome: EnvDirHealthOutcome::InvalidDirectory(value),
                    }
                }
            }
            Err(VarError::NotPresent) => Self {
                key,
                outcome: EnvDirHealthOutcome::NotSet,
            },
            Err(VarError::NotUnicode(_)) => Self {
                key,
                outcome: EnvDirHealthOutcome::NotUnicode,
            },
        }
    }

    pub fn as_line(&self) -> LabeledLine {
        match &self.outcome {
            EnvDirHealthOutcome::Ok(value) => LabeledLine::new(self.key.to_string(), value.clone()),
            EnvDirHealthOutcome::InvalidDirectory(value) => {
                LabeledLine::new(self.key.to_string(), value.clone())
                    .with_errors(vec!["Not a valid directory".to_string()])
            }
            EnvDirHealthOutcome::DoesNotExist(value) => {
                LabeledLine::new(self.key.to_string(), value.clone())
                    .with_errors(vec!["The path does not exist".to_string()])
            }
            EnvDirHealthOutcome::NotSet => {
                LabeledLine::new(self.key.to_string(), "Not set".to_string())
                    .with_errors(vec!["The path is not set".to_string()])
            }
            EnvDirHealthOutcome::NotUnicode => {
                LabeledLine::new(self.key.to_string(), "Not valid unicode".to_string())
                    .with_errors(vec!["The path is not valid unicode".to_string()])
            }
        }
    }
}
