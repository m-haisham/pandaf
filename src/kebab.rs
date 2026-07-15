use std::{fmt::Display, ops::Deref, str::FromStr};

#[derive(Debug, Clone)]
pub struct Kebab(String);

impl Kebab {
    pub fn into_inner(self) -> String {
        self.0
    }
}

impl AsRef<str> for Kebab {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl Deref for Kebab {
    type Target = str;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl Display for Kebab {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

impl FromStr for Kebab {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        if is_kebab(s) {
            Ok(Kebab(s.to_owned()))
        } else {
            Err(format!("'{}' is not kebab-case", s))
        }
    }
}

pub fn is_kebab(name: &str) -> bool {
    name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

pub fn kebabify(name: &str) -> Kebab {
    let mut kebab = String::with_capacity(name.len());

    for c in name.chars() {
        if c.is_ascii_alphanumeric() {
            kebab.push(c.to_ascii_lowercase());
        } else if c == ' ' {
            kebab.push('-');
        }
    }

    Kebab(kebab)
}
