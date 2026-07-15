use std::ops::Deref;

use crate::ui::{traits::Draw, BrushContext};

#[derive(Debug)]
pub struct Outcome<T> {
    pub value: Option<T>,
    pub errors: Vec<eyre::Report>,
    pub warnings: Vec<eyre::Report>,
}

#[derive(Debug)]
pub struct LabeledOutcome<'a, T> {
    pub label: String,
    pub outcome: &'a Outcome<T>,
}

impl From<eyre::Report> for Outcome<String> {
    fn from(error: eyre::Report) -> Self {
        Outcome {
            value: None,
            errors: vec![error],
            warnings: vec![],
        }
    }
}

impl Deref for Outcome<String> {
    type Target = Option<String>;

    fn deref(&self) -> &Self::Target {
        &self.value
    }
}

impl<T> Outcome<T> {
    pub fn new(value: T) -> Self {
        Outcome {
            value: Some(value),
            errors: vec![],
            warnings: vec![],
        }
    }

    pub fn empty() -> Self {
        Outcome {
            value: None,
            errors: vec![],
            warnings: vec![],
        }
    }

    pub fn add_error(&mut self, error: eyre::Report) {
        self.errors.push(error);
    }

    pub fn add_warning(&mut self, warning: eyre::Report) {
        self.warnings.push(warning);
    }

    pub fn labeled(&self, label: &str) -> LabeledOutcome<T> {
        LabeledOutcome {
            label: label.to_string(),
            outcome: self,
        }
    }
}

impl Draw for LabeledOutcome<'_, String> {
    fn draw_compact(&self, draw: &BrushContext<'_>) -> eyre::Result<()> {
        if let Some(value) = &self.outcome.value {
            draw.labeled(&self.label, value)?;
        } else {
            draw.labeled(&self.label, "Not set")?;
        }

        for error in &self.outcome.errors {
            draw.error_line(&error.to_string())?;
        }

        for warning in &self.outcome.warnings {
            draw.error_line(&warning.to_string())?;
        }

        Ok(())
    }

    fn draw_verbose(&self, draw: &BrushContext<'_>) -> eyre::Result<()> {
        if let Some(value) = &self.outcome.value {
            draw.labeled(&self.label, value)?;
        } else {
            draw.labeled(&self.label, "Not set")?;
        }

        for error in &self.outcome.errors {
            draw.error_line(&error.to_string())?;
        }

        for warning in &self.outcome.warnings {
            draw.error_line(&warning.to_string())?;
        }

        Ok(())
    }
}
