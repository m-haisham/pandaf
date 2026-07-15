use eyre::{bail, eyre, Context};
use serde::Serialize;

use crate::config::{read_config, write_config, ConfigKey, Username};

pub fn print_config() -> eyre::Result<()> {
    let config = read_config()?;
    print_toml(config)?;
    Ok(())
}

pub fn get_config(key: String) -> eyre::Result<()> {
    let key = ConfigKey::try_from(key.as_str())?;
    let config = read_config()?;

    match key {
        ConfigKey::Profile => {
            print_toml(config.profile)?;
        }
        ConfigKey::ProfileUsername => {
            if let Some(username) = config.profile.username {
                println!("{}", username);
            } else {
                println!("No username set");
            }
        }
    }

    Ok(())
}

pub fn set_config(key: String, value: String) -> eyre::Result<()> {
    let key = ConfigKey::try_from(key.as_str())?;

    match key {
        ConfigKey::Profile => bail!("The profile cannot be set. Try setting a specific key"),
        ConfigKey::ProfileUsername => {
            let username = Username::try_from(value)?;
            let mut config = read_config()?;
            config.profile.username = Some(username);
            write_config(&config)?;
        }
    }

    Ok(())
}

fn print_toml<T: Serialize>(value: T) -> eyre::Result<()> {
    let output = toml::to_string_pretty(&value)
        .map_err(|e| eyre!(e))
        .wrap_err("Could not serialize config")?;

    println!("{}", output);
    Ok(())
}
