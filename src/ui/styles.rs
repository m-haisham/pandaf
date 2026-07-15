use console::StyledObject;

#[derive(Debug, Clone)]
pub struct Styles {
    error: console::Style,
}

impl Styles {
    pub fn new() -> Self {
        Self {
            error: console::Style::new().red(),
        }
    }

    pub fn error<'a>(&self, message: &'a str) -> StyledObject<&'a str> {
        self.error.apply_to(message)
    }
}
