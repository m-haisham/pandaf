use eyre::{eyre, Context};
use hex::ToHex;
use sha2::Digest;
use std::io::Read;

pub fn hash_as_hex<R: Read>(reader: &mut R) -> eyre::Result<String> {
    use sha2::Sha256;

    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 4096];

    loop {
        let read = reader
            .read(&mut buffer)
            .map_err(|e| eyre!(e))
            .wrap_err("Failed to read from file")?;

        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }

    Ok(hasher.finalize().encode_hex())
}
