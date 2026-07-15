use super::traits::Draw;

#[derive(Debug, Clone)]
pub enum Required<T> {
    Value(T),
    Missing(String),
}

impl<T> Required<T> {
    pub fn from_option(option: Option<T>, missing_message: impl Into<String>) -> Self {
        match option {
            Some(value) => Self::Value(value),
            None => Self::Missing(missing_message.into()),
        }
    }
}

impl Draw for Required<String> {
    fn draw_compact(&self, draw: &super::BrushContext<'_>) -> eyre::Result<()> {
        match self {
            Required::Value(value) => value.draw_compact(draw),
            Required::Missing(message) => draw.styles.error(message).draw_compact(draw),
        }
    }

    fn draw_verbose(&self, draw: &super::BrushContext<'_>) -> eyre::Result<()> {
        match self {
            Required::Value(value) => value.draw_verbose(draw),
            Required::Missing(message) => draw.styles.error(message).draw_verbose(draw),
        }
    }
}
