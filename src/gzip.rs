use eyre::{eyre, WrapErr};
use std::io::{Read, Write};

pub async fn gzip(content: &str) -> eyre::Result<Vec<u8>> {
    let mut encoder = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
    encoder.write_all(content.as_bytes())?;

    let bytes = encoder
        .finish()
        .map_err(|e| eyre!(e))
        .wrap_err("Failed to finish gzip encoding")?;

    Ok(bytes)
}

pub async fn gunzip(bytes: &[u8]) -> eyre::Result<String> {
    let mut decoder = flate2::read::GzDecoder::new(bytes);
    let mut content = String::new();
    decoder.read_to_string(&mut content)?;

    Ok(content)
}
