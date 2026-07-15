use console::StyledObject;

use super::BrushContext;

pub trait Draw {
    fn draw(&self, brush: &BrushContext<'_>) -> eyre::Result<()> {
        if brush.is_verbose() {
            self.draw_verbose(brush)
        } else {
            self.draw_compact(brush)
        }
    }

    fn draw_compact(&self, brush: &BrushContext<'_>) -> eyre::Result<()>;
    fn draw_verbose(&self, brush: &BrushContext<'_>) -> eyre::Result<()>;
}

impl Draw for &str {
    fn draw_compact(&self, draw: &BrushContext<'_>) -> eyre::Result<()> {
        draw.write_line(self)
    }

    fn draw_verbose(&self, draw: &BrushContext<'_>) -> eyre::Result<()> {
        draw.write_line(self)
    }
}

impl Draw for String {
    fn draw_compact(&self, draw: &BrushContext<'_>) -> eyre::Result<()> {
        draw.write_line(self)
    }

    fn draw_verbose(&self, draw: &BrushContext<'_>) -> eyre::Result<()> {
        draw.write_line(self)
    }
}

impl<T> Draw for StyledObject<T>
where
    T: std::fmt::Display,
{
    fn draw_compact(&self, draw: &BrushContext<'_>) -> eyre::Result<()> {
        self.to_string().draw_compact(draw)
    }

    fn draw_verbose(&self, draw: &BrushContext<'_>) -> eyre::Result<()> {
        self.to_string().draw_verbose(draw)
    }
}
