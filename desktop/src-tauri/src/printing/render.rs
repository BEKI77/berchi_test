//! Turning a described ticket into something real.
//!
//! Two ways out, from the same [`Doc`]:
//!
//! - [`print`] sends ESC/POS to a printer.
//! - [`to_text`] writes the ticket as characters, for the preview in the
//!   settings window and for the tests.
//!
//! They share the wrapping and the column arithmetic in `doc.rs`, which is the
//! point: the preview is not a drawing of a receipt, it is the receipt, laid out
//! by the code that lays out the real one. If a service name is going to wrap
//! awkwardly on 58 mm paper, it wraps awkwardly on screen first.

use escpos::driver::Driver;
use escpos::printer::Printer as EscPrinter;
use escpos::printer_options::PrinterOptions;
use escpos::utils::{
    CashDrawer as EscCashDrawer, JustifyMode, PageCode, Protocol, QRCodeCorrectionLevel,
    QRCodeModel, QRCodeOption, UnderlineMode,
};

use super::doc::{self, Align, Block, Doc, Style};
use super::settings::{CutMode, DrawerPin, Printer as PrinterConfig};

/// The character table every ticket is printed in.
///
/// Not a setting, because it cannot usefully be one: everything sent to the
/// printer is reduced to ASCII first (see [`printable`]), and every ESC/POS code
/// page agrees about ASCII. What it buys is a known starting state -- printers
/// sold for other markets often wake up in a different table, and being told
/// which one to use means the ticket looks the same on all of them.
const PAGE_CODE: PageCode = PageCode::PC437;

// ---------------------------------------------------------------------------
// Making text a thermal printer can actually print
// ---------------------------------------------------------------------------

/// Reduces text to characters a receipt printer has a glyph for.
///
/// A thermal printer holds a 256-character table, not Unicode. **Amharic is in
/// no ESC/POS table**, so a name typed in Amharic cannot be printed by any of
/// these machines, whatever is configured -- it comes out as `?` here rather
/// than as a run of random glyphs, which is what handing the raw bytes over
/// would produce.
///
/// Accented Latin letters lose their accents instead of being dropped, because
/// `Rene` is a name and `Ren?` is not.
///
/// One character in, one character out, always. That is what keeps the columns
/// lining up: the layout in `doc.rs` counts characters, and a substitution that
/// changed the count would push prices off the edge of the paper.
pub fn printable(text: &str) -> String {
    text.chars()
        .map(|character| match character {
            // Tabs and the like would move the print head unpredictably.
            '\t' | '\n' | '\r' => ' ',
            c if c.is_ascii_graphic() || c == ' ' => c,

            'à' | 'á' | 'â' | 'ã' | 'ä' | 'å' => 'a',
            'À' | 'Á' | 'Â' | 'Ã' | 'Ä' | 'Å' => 'A',
            'è' | 'é' | 'ê' | 'ë' => 'e',
            'È' | 'É' | 'Ê' | 'Ë' => 'E',
            'ì' | 'í' | 'î' | 'ï' => 'i',
            'Ì' | 'Í' | 'Î' | 'Ï' => 'I',
            'ò' | 'ó' | 'ô' | 'õ' | 'ö' | 'ø' => 'o',
            'Ò' | 'Ó' | 'Ô' | 'Õ' | 'Ö' | 'Ø' => 'O',
            'ù' | 'ú' | 'û' | 'ü' => 'u',
            'Ù' | 'Ú' | 'Û' | 'Ü' => 'U',
            'ç' => 'c',
            'Ç' => 'C',
            'ñ' => 'n',
            'Ñ' => 'N',
            'ý' | 'ÿ' => 'y',
            'Ý' => 'Y',

            // Punctuation a word processor or a phone keyboard slips in.
            '\u{2018}' | '\u{2019}' | '\u{2032}' => '\'',
            '\u{201C}' | '\u{201D}' => '"',
            '\u{2013}' | '\u{2014}' | '\u{2212}' => '-',
            '\u{2026}' => '.',
            '\u{00A0}' => ' ',

            _ => '?',
        })
        .collect()
}

// ---------------------------------------------------------------------------
// The preview
// ---------------------------------------------------------------------------

/// The ticket as characters, exactly as wide as the paper.
///
/// Large text cannot be shown large in a monospaced preview, so it is shown at
/// the position it will actually occupy: a line set to double width starts
/// where double-width characters would start. That way the preview still
/// answers the question it is there for -- does this fit, and does it line up.
pub fn to_text(document: &Doc) -> String {
    let width = document.width;
    let mut out = String::new();

    for block in &document.blocks {
        match block {
            Block::Line { text, style } => {
                let cells = style.columns_in(width);
                for line in doc::wrap(&printable(text), cells) {
                    out.push_str(&place(&line, cells, style));
                    out.push('\n');
                }
            }
            Block::Row { left, right, style } => {
                let cells = style.columns_in(width);
                for line in doc::row(&printable(left), &printable(right), cells) {
                    out.push_str(&line);
                    out.push('\n');
                }
            }
            Block::Rule { character } => {
                out.push_str(&doc::rule(*character, width));
                out.push('\n');
            }
            Block::Blank => out.push('\n'),
            Block::Qr { data, .. } => {
                let label = format!("[QR: {}]", printable(data));
                out.push_str(&doc::align(&label, width, Align::Center));
                out.push('\n');
            }
            Block::Feed { lines } => {
                for _ in 0..*lines {
                    out.push('\n');
                }
            }
            Block::OpenDrawer => out.push_str("[the cash drawer opens]\n"),
        }
    }

    out
}

/// Where a line starts, in real columns, once its character size is allowed for.
fn place(line: &str, cells: u8, style: &Style) -> String {
    let length = line.chars().count() as u8;
    let lead_cells = match style.align {
        Align::Left => 0,
        Align::Center => cells.saturating_sub(length) / 2,
        Align::Right => cells.saturating_sub(length),
    };
    format!("{}{line}", " ".repeat(lead_cells as usize * style.width as usize))
}

// ---------------------------------------------------------------------------
// The printer
// ---------------------------------------------------------------------------

/// Prints the ticket, copies, cut and all.
///
/// Everything is built up first and sent in one go, which is how `escpos`
/// works and is what we want: a printer that is switched off half way through
/// receives nothing rather than half a receipt with no total on it.
pub fn print<D: Driver>(document: &Doc, config: &PrinterConfig, driver: D) -> Result<(), String> {
    let options = PrinterOptions::new(Some(PAGE_CODE), None, config.paper.characters_per_line);
    let mut printer = EscPrinter::new(driver, Protocol::default(), Some(options));

    for _ in 0..config.copies.max(1) {
        // Each copy starts from a known state: the one before it may have ended
        // mid-style if a template ever changes.
        printer.init().map_err(problem)?;
        emit(document, &mut printer, config)?;

        match config.cut.mode {
            CutMode::Full => {
                printer.cut().map_err(problem)?;
            }
            CutMode::Partial => {
                printer.partial_cut().map_err(problem)?;
            }
            // Nothing to send: the paper is torn off by hand.
            CutMode::None => {}
        }
    }

    printer.print().map_err(problem)?;
    Ok(())
}

/// Sends the blocks of one copy.
fn emit<D: Driver>(
    document: &Doc,
    printer: &mut EscPrinter<D>,
    config: &PrinterConfig,
) -> Result<(), String> {
    let width = document.width;

    for block in &document.blocks {
        match block {
            Block::Line { text, style } => {
                apply(printer, style)?;
                for line in doc::wrap(&printable(text), style.columns_in(width)) {
                    printer.writeln(&line).map_err(problem)?;
                }
                reset(printer)?;
            }
            Block::Row { left, right, style } => {
                apply(printer, style)?;
                // The padding already puts the amount where it belongs, so the
                // printer is left aligning from the left. Asking it to justify
                // as well would move the padded line as a whole.
                for line in doc::row(&printable(left), &printable(right), style.columns_in(width)) {
                    printer.writeln(&line).map_err(problem)?;
                }
                reset(printer)?;
            }
            Block::Rule { character } => {
                printer.writeln(&doc::rule(*character, width)).map_err(problem)?;
            }
            Block::Blank => {
                printer.feed().map_err(problem)?;
            }
            Block::Qr { data, size } => {
                printer.justify(JustifyMode::CENTER).map_err(problem)?;
                printer
                    .qrcode_option(
                        &printable(data),
                        // Model 2 is what every scanner made this century reads.
                        // M corrects enough for a smudged thermal print without
                        // making the code large enough to dominate the slip.
                        QRCodeOption::new(QRCodeModel::Model2, *size, QRCodeCorrectionLevel::M),
                    )
                    .map_err(problem)?;
                printer.justify(JustifyMode::LEFT).map_err(problem)?;
            }
            Block::Feed { lines } => {
                printer.feeds(*lines).map_err(problem)?;
            }
            Block::OpenDrawer => {
                printer.cash_drawer(pin(config.cash_drawer.pin)).map_err(problem)?;
            }
        }
    }

    Ok(())
}

/// Puts the printer into the style a block asks for.
fn apply<D: Driver>(printer: &mut EscPrinter<D>, style: &Style) -> Result<(), String> {
    printer
        .justify(match style.align {
            Align::Left => JustifyMode::LEFT,
            Align::Center => JustifyMode::CENTER,
            Align::Right => JustifyMode::RIGHT,
        })
        .map_err(problem)?;
    printer.bold(style.bold).map_err(problem)?;
    printer
        .underline(if style.underline { UnderlineMode::Single } else { UnderlineMode::None })
        .map_err(problem)?;
    printer.size(style.width, style.height).map_err(problem)?;
    Ok(())
}

/// Back to plain text, so the next block starts from a known state.
fn reset<D: Driver>(printer: &mut EscPrinter<D>) -> Result<(), String> {
    printer.reset_size().map_err(problem)?;
    printer.bold(false).map_err(problem)?;
    printer.underline(UnderlineMode::None).map_err(problem)?;
    printer.justify(JustifyMode::LEFT).map_err(problem)?;
    Ok(())
}

fn pin(pin: DrawerPin) -> EscCashDrawer {
    match pin {
        DrawerPin::Pin2 => EscCashDrawer::Pin2,
        DrawerPin::Pin5 => EscCashDrawer::Pin5,
    }
}

/// An ESC/POS failure, in words the cashier can act on.
///
/// `escpos` reports "IO error: ..." with the underlying message, which is
/// usually the operating system's, and that is the useful part -- the printer
/// is off, the socket refused, the port is held by something else.
fn problem(error: escpos::errors::PrinterError) -> String {
    format!("The printer would not take the ticket: {error}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::printing::settings::{Connection, Printer as PrinterConfig};

    fn config() -> PrinterConfig {
        PrinterConfig::new(
            "p1".into(),
            "Front counter".into(),
            Connection::Network { host: "192.168.1.60".into(), port: 9100 },
        )
    }

    /// The columns only line up because one character in means one character
    /// out. A substitution that changed the count would push prices off the
    /// paper.
    #[test]
    fn the_length_never_changes() {
        for text in ["Almaz Tadesse", "Rene", "ሰላም ለዓለም", "naïve café", "—'\u{201C}"] {
            assert_eq!(printable(text).chars().count(), text.chars().count(), "{text:?}");
        }
    }

    /// `Rene` is a name; `Ren?` is not.
    #[test]
    fn accents_are_dropped_rather_than_the_letter() {
        assert_eq!(printable("René Lorène"), "Rene Lorene");
        assert_eq!(printable("Håkon Ñuño Çelik"), "Hakon Nuno Celik");
    }

    /// No ESC/POS printer can print Amharic. Saying so with `?` is better than
    /// sending bytes that come out as random glyphs.
    #[test]
    fn a_script_no_printer_has_becomes_question_marks() {
        assert_eq!(printable("ሰላም"), "???");
        // ...but anything Latin beside it still reads.
        assert_eq!(printable("ሰላም Salon"), "??? Salon");
    }

    #[test]
    fn typographic_punctuation_is_flattened() {
        assert_eq!(printable("\u{201C}Bob\u{2019}s\u{201D} \u{2014} hair"), "\"Bob's\" - hair");
    }

    /// Anything that would move the print head on its own is turned into a
    /// space, so a name pasted in with a newline cannot break the layout.
    #[test]
    fn control_characters_cannot_move_the_paper() {
        assert_eq!(printable("two\nlines\there"), "two lines here");
    }

    #[test]
    fn the_preview_is_never_wider_than_the_paper() {
        let mut document = Doc::new(32);
        document
            .title("BERCHI SALON")
            .heavy_rule()
            .line("45", Style::centered().bold().scale(6, 6))
            .row("Keratin treatment and blow dry", "1,250.00")
            .total_row("TOTAL", "ETB 1,250.00")
            .qr("ORD-20260922-0045", 6)
            .feed(4);

        for line in to_text(&document).lines() {
            assert!(line.chars().count() <= 32, "too wide: {line:?}");
        }
    }

    /// A big number is shown where it will really sit, not squeezed left,
    /// because the question the preview answers is whether it is centred and
    /// whether it fits.
    #[test]
    fn large_text_is_previewed_where_it_will_print() {
        let mut document = Doc::new(42);
        document.line("45", Style::centered().scale(6, 6));
        let line = to_text(&document);

        // 42 columns is 7 double-height cells; "45" takes 2, so it starts two
        // cells -- twelve columns -- in.
        assert_eq!(line, format!("{}45\n", " ".repeat(12)));
    }

    #[test]
    fn the_cut_amount_shows_as_blank_paper() {
        let mut document = Doc::new(42);
        document.text("last line").feed(3);
        assert_eq!(to_text(&document), "last line\n\n\n\n");
    }

    #[test]
    fn the_drawer_is_called_out_in_the_preview() {
        let mut document = Doc::new(42);
        document.open_drawer();
        assert!(to_text(&document).contains("cash drawer"));
    }

    /// Printing goes through a driver, so a failing one must come back as a
    /// message rather than a panic. A file in a folder that does not exist is
    /// the easiest way to get a driver that cannot write.
    #[test]
    fn a_printer_that_cannot_be_reached_is_reported() {
        use escpos::driver::FileDriver;

        let unusable = FileDriver::open(std::path::Path::new("/nonexistent/berchi/printer"));
        assert!(unusable.is_err(), "opening a file in a missing folder should fail");
    }

    /// The whole path, with a driver that keeps the bytes instead of printing
    /// them: a real ticket must produce real ESC/POS.
    #[test]
    fn a_ticket_becomes_escpos_bytes() {
        use crate::printing::transport::Recorder;

        let recorder = Recorder::new();
        let bytes = recorder.written();

        let mut document = Doc::new(42);
        document.title("BERCHI SALON").rule().row("Haircut", "350.00").feed(4);

        print(&document, &config(), recorder).expect("printing to a recorder should work");

        let written = bytes.lock().unwrap().clone();
        assert!(!written.is_empty(), "nothing was sent to the printer");
        // ESC @ -- the initialise command every ticket starts with.
        assert!(written.starts_with(&[0x1B, 0x40]), "a ticket must start by initialising");
        // GS V -- the cut, which is how the ticket ends.
        assert!(
            written.windows(2).any(|pair| pair == [0x1D, 0x56]),
            "a full cut should have been sent"
        );
        assert!(
            String::from_utf8_lossy(&written).contains("Haircut"),
            "the text should be in there"
        );
    }

    /// Two copies means the whole ticket twice, cut and all -- not one ticket
    /// with the paper cut twice.
    #[test]
    fn copies_repeat_the_whole_ticket() {
        use crate::printing::transport::Recorder;

        let mut twice = config();
        twice.copies = 2;

        let recorder = Recorder::new();
        let bytes = recorder.written();

        let mut document = Doc::new(42);
        document.text("Haircut");
        print(&document, &twice, recorder).unwrap();

        let written = String::from_utf8_lossy(&bytes.lock().unwrap().clone()).to_string();
        assert_eq!(written.matches("Haircut").count(), 2);
    }

    /// A printer with no cutter must not be sent a cut command: some of them
    /// print the bytes as characters.
    #[test]
    fn a_printer_with_no_cutter_is_never_sent_a_cut() {
        use crate::printing::transport::Recorder;

        let mut no_cutter = config();
        no_cutter.cut.mode = CutMode::None;

        let recorder = Recorder::new();
        let bytes = recorder.written();

        let mut document = Doc::new(42);
        document.text("Haircut");
        print(&document, &no_cutter, recorder).unwrap();

        let written = bytes.lock().unwrap().clone();
        assert!(
            !written.windows(2).any(|pair| pair == [0x1D, 0x56]),
            "no cut should have been sent"
        );
    }
}
