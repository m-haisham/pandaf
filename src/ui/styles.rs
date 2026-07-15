use console::StyledObject;

#[derive(Debug, Clone)]
pub struct Styles {
    pub normal: console::Style,
    pub error: console::Style,
    pub warning: console::Style,
}

impl Styles {
    pub fn new() -> Self {
        Self {
            normal: console::Style::new(),
            error: console::Style::new().red(),
            warning: console::Style::new().yellow(),
        }
    }

    pub fn error<'a>(&self, message: &'a str) -> StyledObject<&'a str> {
        self.error.apply_to(message)
    }

    pub fn warning<'a>(&self, message: &'a str) -> StyledObject<&'a str> {
        self.warning.apply_to(message)
    }
}
