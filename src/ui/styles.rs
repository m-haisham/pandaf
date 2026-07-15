use console::StyledObject;

#[derive(Debug, Clone)]
pub struct Styles {
    pub success: console::Style,
    pub normal: console::Style,
    pub error: console::Style,
    pub warning: console::Style,
    pub caption: console::Style,
    pub bold: console::Style,
}

impl Styles {
    pub fn new() -> Self {
        Self {
            success: console::Style::new().green(),
            normal: console::Style::new(),
            error: console::Style::new().red(),
            warning: console::Style::new().yellow(),
            caption: console::Style::new().dim(),
            bold: console::Style::new().bold(),
        }
    }

    pub fn error<'a>(&self, message: &'a str) -> StyledObject<&'a str> {
        self.error.apply_to(message)
    }

    pub fn warning<'a>(&self, message: &'a str) -> StyledObject<&'a str> {
        self.warning.apply_to(message)
    }
}
