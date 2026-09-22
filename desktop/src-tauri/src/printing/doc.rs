//! A ticket, described rather than printed.
//!
//! The templates in `ticket.rs` build a [`Doc`] -- a list of lines, rules, rows
//! and codes -- and `render.rs` turns that into either ESC/POS bytes for a
//! printer or plain text for the preview in the settings window. Keeping the
//! description separate from the bytes is what makes the preview honest: it is
//! the same ticket, laid out by the same code, so what is on screen is what
//! comes out of the printer, short of the printer's own font.
//!
//! Everything here counts in **characters**, not millimetres, because that is
//! how an ESC/POS printer thinks. A row of 80 mm paper is 42 characters wide.

/// How a line sits on the paper.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Align {
    Left,
    Center,
    Right,
}

/// How a line is printed. `width` and `height` are the ESC/POS character
/// multipliers, 1 to 8: a `width` of 2 means each character takes two columns,
/// so half as many fit on the line.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Style {
    pub align: Align,
    pub bold: bool,
    pub underline: bool,
    pub width: u8,
    pub height: u8,
}

impl Default for Style {
    fn default() -> Self {
        Self { align: Align::Left, bold: false, underline: false, width: 1, height: 1 }
    }
}

impl Style {
    pub fn centered() -> Self {
        Self { align: Align::Center, ..Self::default() }
    }

    pub fn bold(mut self) -> Self {
        self.bold = true;
        self
    }

    pub fn underline(mut self) -> Self {
        self.underline = true;
        self
    }

    /// Scales the character cell. Clamped to what ESC/POS can express, so a
    /// template asking for something impossible prints large rather than fails.
    pub fn scale(mut self, width: u8, height: u8) -> Self {
        self.width = width.clamp(1, 8);
        self.height = height.clamp(1, 8);
        self
    }

    /// How many of these characters fit across paper `paper_width` wide.
    pub fn columns_in(&self, paper_width: u8) -> u8 {
        (paper_width / self.width.max(1)).max(1)
    }
}

/// One piece of a ticket.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Block {
    /// Text, wrapped to the paper if it is too long.
    Line { text: String, style: Style },

    /// A label on the left and a value pinned to the right edge -- a service and
    /// its price, a total, "Paid by" and "Cash". The workhorse of a receipt.
    Row { left: String, right: String, style: Style },

    /// A horizontal rule drawn right across the paper.
    Rule { character: char },

    /// One empty line.
    Blank,

    /// A QR code, centred. `size` is the module size the printer uses, 1 to 16.
    Qr { data: String, size: u8 },

    /// Roll the paper on, without printing. What the "cut amount" becomes.
    Feed { lines: u8 },

    /// Kick the cash drawer open.
    OpenDrawer,
}

/// A ticket being built.
///
/// The methods are named for what they mean on a receipt rather than for what
/// they do to the printer, so a template reads roughly like the paper it
/// produces.
#[derive(Debug, Clone)]
pub struct Doc {
    /// Characters across, at normal size.
    pub width: u8,
    pub blocks: Vec<Block>,
}

impl Doc {
    pub fn new(width: u8) -> Self {
        Self { width: width.max(1), blocks: Vec::new() }
    }

    fn push(&mut self, block: Block) -> &mut Self {
        self.blocks.push(block);
        self
    }

    /// The salon's name at the top: as large as the paper takes, and centred.
    pub fn title(&mut self, text: &str) -> &mut Self {
        self.line(text, Style::centered().bold().scale(2, 2))
    }

    /// A line of ordinary text, left aligned.
    pub fn text(&mut self, text: &str) -> &mut Self {
        self.line(text, Style::default())
    }

    /// A line of ordinary text, centred.
    pub fn centered(&mut self, text: &str) -> &mut Self {
        self.line(text, Style::centered())
    }

    /// A small heading over a group of lines -- SERVICES, PRODUCTS.
    pub fn heading(&mut self, text: &str) -> &mut Self {
        self.line(text, Style::default().bold())
    }

    /// Text at whatever size is asked for. Used for the ticket number, which is
    /// the one thing on the slip that has to be readable across a room.
    pub fn line(&mut self, text: &str, style: Style) -> &mut Self {
        self.push(Block::Line { text: text.to_string(), style })
    }

    /// A label and a value, the value against the right edge.
    pub fn row(&mut self, left: &str, right: &str) -> &mut Self {
        self.styled_row(left, right, Style::default())
    }

    /// A row that matters -- the total. Double height, so it is the first thing
    /// the eye lands on, but single width so a four-figure sum still fits.
    pub fn total_row(&mut self, left: &str, right: &str) -> &mut Self {
        self.styled_row(left, right, Style::default().bold().scale(1, 2))
    }

    pub fn styled_row(&mut self, left: &str, right: &str, style: Style) -> &mut Self {
        self.push(Block::Row { left: left.to_string(), right: right.to_string(), style })
    }

    /// A light rule, for separating one part of the ticket from the next.
    pub fn rule(&mut self) -> &mut Self {
        self.push(Block::Rule { character: '-' })
    }

    /// A heavy rule, for the two places that end a section outright: under the
    /// salon's name, and around the total.
    pub fn heavy_rule(&mut self) -> &mut Self {
        self.push(Block::Rule { character: '=' })
    }

    pub fn blank(&mut self) -> &mut Self {
        self.push(Block::Blank)
    }

    pub fn qr(&mut self, data: &str, size: u8) -> &mut Self {
        self.push(Block::Qr { data: data.to_string(), size: size.clamp(1, 16) })
    }

    pub fn feed(&mut self, lines: u8) -> &mut Self {
        if lines == 0 {
            return self;
        }
        self.push(Block::Feed { lines })
    }

    pub fn open_drawer(&mut self) -> &mut Self {
        self.push(Block::OpenDrawer)
    }
}

// ---------------------------------------------------------------------------
// Laying text out in a fixed number of characters
// ---------------------------------------------------------------------------

/// Breaks text to fit, on spaces where it can and mid-word where it must.
///
/// A service can genuinely be called "Keratin treatment and blow dry", and a
/// customer can genuinely be called something longer than the paper is wide.
/// Neither may be silently cut short on a receipt, so both wrap.
pub fn wrap(text: &str, width: u8) -> Vec<String> {
    let width = width.max(1) as usize;
    let mut lines = Vec::new();
    let mut current = String::new();

    for word in text.split_whitespace() {
        // A single word too long for the paper is broken across lines; there is
        // nothing else to do with it.
        if word.chars().count() > width {
            if !current.is_empty() {
                lines.push(std::mem::take(&mut current));
            }
            let mut piece = String::new();
            for character in word.chars() {
                if piece.chars().count() == width {
                    lines.push(std::mem::take(&mut piece));
                }
                piece.push(character);
            }
            current = piece;
            continue;
        }

        let would_be = if current.is_empty() { word.chars().count() } else { current.chars().count() + 1 + word.chars().count() };
        if would_be > width {
            lines.push(std::mem::take(&mut current));
            current.push_str(word);
        } else {
            if !current.is_empty() {
                current.push(' ');
            }
            current.push_str(word);
        }
    }

    if !current.is_empty() {
        lines.push(current);
    }
    if lines.is_empty() {
        lines.push(String::new());
    }
    lines
}

/// Pads text out to sit where it should on a line of `width` characters.
///
/// Printers can centre and right-align themselves, and for a simple line they
/// are asked to. This is for the cases where the position has to be worked out
/// here instead: the preview, and the right-hand column of a row.
pub fn align(text: &str, width: u8, alignment: Align) -> String {
    let width = width.max(1) as usize;
    let length = text.chars().count();
    if length >= width {
        return text.to_string();
    }
    let spare = width - length;
    match alignment {
        Align::Left => text.to_string(),
        Align::Right => format!("{}{}", " ".repeat(spare), text),
        Align::Center => format!("{}{}", " ".repeat(spare / 2), text),
    }
}

/// A label on the left, a value against the right edge, dots of space between.
///
/// When the label is too long to share a line with its value, the label wraps
/// and the value sits alone on the last line, still against the right edge. A
/// price is never dropped and never pushed off the paper, which matters more
/// than the shape of the line: a receipt with a missing amount is an argument
/// at the till.
pub fn row(left: &str, right: &str, width: u8) -> Vec<String> {
    let width_usize = width.max(1) as usize;
    let right_length = right.chars().count();

    // Nothing on the right: an ordinary wrapped line.
    if right.is_empty() {
        return wrap(left, width);
    }

    // The value alone is wider than the paper. Give it its own line rather than
    // pretending to lay it out.
    if right_length >= width_usize {
        let mut lines = if left.is_empty() { Vec::new() } else { wrap(left, width) };
        lines.push(right.to_string());
        return lines;
    }

    // At least one space between the two, so they never run together.
    let room_for_left = width_usize - right_length - 1;
    let left_lines = wrap(left, room_for_left as u8);

    let mut lines = Vec::new();
    for line in &left_lines[..left_lines.len() - 1] {
        lines.push(line.clone());
    }

    let last = left_lines.last().cloned().unwrap_or_default();
    let gap = width_usize - last.chars().count() - right_length;
    lines.push(format!("{last}{}{right}", " ".repeat(gap)));
    lines
}

/// A rule right across the paper.
pub fn rule(character: char, width: u8) -> String {
    character.to_string().repeat(width.max(1) as usize)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn short_text_is_left_alone() {
        assert_eq!(wrap("Haircut", 42), vec!["Haircut"]);
    }

    #[test]
    fn long_text_breaks_on_spaces() {
        assert_eq!(
            wrap("Keratin treatment and blow dry", 16),
            vec!["Keratin", "treatment and", "blow dry"]
        );
    }

    /// A word with no spaces in it still has to fit on the paper.
    #[test]
    fn a_word_too_long_for_the_paper_is_broken() {
        assert_eq!(wrap("Aaaaaaaaaaaaaa", 5), vec!["Aaaaa", "aaaaa", "aaaa"]);
    }

    #[test]
    fn wrapping_nothing_gives_one_empty_line() {
        assert_eq!(wrap("", 42), vec![""]);
        assert_eq!(wrap("    ", 42), vec![""]);
    }

    #[test]
    fn a_row_puts_the_amount_against_the_right_edge() {
        let lines = row("Haircut", "350.00", 20);
        assert_eq!(lines, vec!["Haircut       350.00"]);
        assert_eq!(lines[0].chars().count(), 20);
    }

    /// The amount is the part that must not be lost, so a long name wraps
    /// around it rather than pushing it off the paper.
    #[test]
    fn a_long_name_wraps_and_the_amount_stays_put() {
        let lines = row("Keratin treatment and blow dry", "1,250.00", 24);
        assert_eq!(lines, vec!["Keratin", "treatment and", "blow dry        1,250.00"]);
        for line in &lines {
            assert!(line.chars().count() <= 24, "{line:?} is wider than the paper");
        }
        assert!(lines.last().unwrap().ends_with("1,250.00"));
    }

    /// An amount wider than the paper is a nonsense, but it is still the amount:
    /// give it a line of its own rather than mangling it.
    #[test]
    fn an_amount_wider_than_the_paper_gets_its_own_line() {
        let lines = row("Total", "123,456,789,012.00", 12);
        assert_eq!(lines, vec!["Total", "123,456,789,012.00"]);
    }

    #[test]
    fn rows_with_no_amount_are_just_wrapped_text() {
        assert_eq!(row("Thank you", "", 20), vec!["Thank you"]);
    }

    #[test]
    fn centring_splits_the_spare_room() {
        assert_eq!(align("abc", 9, Align::Center), "   abc");
        assert_eq!(align("abc", 9, Align::Right), "      abc");
        assert_eq!(align("abc", 9, Align::Left), "abc");
        // Nothing to do when it already fills the line.
        assert_eq!(align("abcdefghi", 9, Align::Center), "abcdefghi");
    }

    /// Double-width characters take two columns each, so half as many fit.
    #[test]
    fn scaling_up_halves_the_line() {
        assert_eq!(Style::default().scale(2, 2).columns_in(42), 21);
        assert_eq!(Style::default().columns_in(42), 42);
        // Asking for more than ESC/POS can express prints large, not broken.
        assert_eq!(Style::default().scale(99, 99).width, 8);
    }

    #[test]
    fn a_rule_fills_the_paper() {
        assert_eq!(rule('-', 5), "-----");
    }

    #[test]
    fn a_feed_of_nothing_is_not_recorded() {
        let mut doc = Doc::new(42);
        doc.feed(0);
        assert!(doc.blocks.is_empty());
    }
}
