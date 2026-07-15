use super::traits::Draw;

#[derive(Debug)]
pub struct LabeledLine {
    label: String,
    value: String,
    warnings: Vec<String>,
    errors: Vec<String>,
}

impl LabeledLine {
    pub fn new(label: String, value: String) -> Self {
        Self {
            label,
            value,
            warnings: vec![],
            errors: vec![],
        }
    }

    pub fn with_warnings(mut self, warnings: Vec<String>) -> Self {
        self.warnings = warnings;
        self
    }

    pub fn with_errors(mut self, errors: Vec<String>) -> Self {
        self.errors = errors;
        self
    }
}

impl Draw for LabeledLine {
    fn draw_compact(&self, brush: &super::BrushContext<'_>) -> eyre::Result<()> {
        let style = if !self.errors.is_empty() {
            &brush.styles.error
        } else if !self.warnings.is_empty() {
            &brush.styles.warning
        } else {
            &brush.styles.normal
        };

        let mut suffixes = vec![];

        if !self.errors.is_empty() {
            suffixes.push(format!("{} errors", self.errors.len()));
        }

        if !self.warnings.is_empty() {
            suffixes.push(format!("{} warnings", self.warnings.len()));
        }

        let suffix = if suffixes.is_empty() {
            "".to_string()
        } else {
            format!(" ({})", suffixes.join(", "))
        };

        let value = format!("{}{suffix}", self.value);

        brush.labeled_styled(&self.label, &style.apply_to(value).to_string(), style)?;

        Ok(())
    }

    fn draw_verbose(&self, brush: &super::BrushContext<'_>) -> eyre::Result<()> {
        let style = if !self.errors.is_empty() {
            &brush.styles.error
        } else if !self.warnings.is_empty() {
            &brush.styles.warning
        } else {
            &brush.styles.normal
        };

        brush.labeled_styled(&self.label, &style.apply_to(&self.value).to_string(), style)?;

        for error in &self.errors {
            brush.error_line(&error)?;
        }

        for warning in &self.warnings {
            brush.warning_line(&warning)?;
        }

        Ok(())
    }
}
