use eyre::{eyre, WrapErr};
use std::io::Write;

pub async fn gzip(content: &str) -> eyre::Result<Vec<u8>> {
    let mut encoder = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
    encoder.write_all(content.as_bytes())?;

    let bytes = encoder
        .finish()
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to finish gzip encoding")?;

    Ok(bytes)
}
