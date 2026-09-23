//! The two tickets this salon prints, and what they look like.
//!
//! The types here are what the salon system hands over; the functions below turn
//! one into a [`Doc`] that `render.rs` can print or preview.
//!
//! **Dates and times arrive already written out.** The salon system knows its own
//! timezone (it is a setting, and the tablets and the web receipt all use it), so
//! it formats the moment and sends the words. The alternative -- sending an
//! instant and formatting it here -- would need a timezone database inside this
//! program and would give a different answer from the screen the cashier is
//! looking at, which is the one thing a receipt must never do.
//!
//! **Money arrives as whole santim**, the same integers the till computes in, and
//! is only turned into "1,840.00" at the last moment. See `src/lib/money.ts` in
//! the salon system for why nothing monetary is ever a fraction.

use serde::{Deserialize, Serialize};

use super::doc::{Doc, Style};
use super::settings::Printer;

/// The salon's own details, as they head the ticket.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Salon {
    pub name: String,
    #[serde(default)]
    pub address: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    /// "ETB". Shown against the total, where it settles what the figures mean.
    #[serde(default)]
    pub currency: Option<String>,
}

/// The number slip handed over at reception.
///
/// Its whole job is the number: the customer reads it, the stylist reads it off
/// the customer's hand across the salon, and whoever holds the lower one came
/// first. Everything else on the slip is supporting detail.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Slip {
    #[serde(default)]
    pub salon: Salon,
    /// The full ticket number, `ORD-20260922-0045`.
    pub order_number: String,
    /// The tail of it, `45`, which is what people actually say.
    #[serde(default)]
    pub short_number: String,
    #[serde(default)]
    pub customer: Option<String>,
    /// When they arrived, already written out by the salon system.
    #[serde(default)]
    pub arrived: Option<String>,
}

/// One service or product on a receipt.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Line {
    pub name: String,
    #[serde(default = "one")]
    pub quantity: u32,
    /// Santim.
    #[serde(default)]
    pub unit_price: i64,
    /// Santim. What this line adds to the bill.
    #[serde(default)]
    pub amount: i64,
}

fn one() -> u32 {
    1
}

/// How the customer paid.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Payment {
    /// "Cash", "Mobile money", "Bank transfer" -- already in words.
    pub method: String,
    /// Whether this was cash, which is the only thing that should kick the
    /// drawer open. A card sale popping the drawer is how a till loses count.
    #[serde(default)]
    pub is_cash: bool,
    #[serde(default)]
    pub reference: Option<String>,
}

/// The receipt handed over at checkout.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Receipt {
    #[serde(default)]
    pub salon: Salon,
    pub invoice_number: String,
    #[serde(default)]
    pub order_number: Option<String>,
    /// When it was rung up, already written out by the salon system.
    #[serde(default)]
    pub issued: Option<String>,
    #[serde(default)]
    pub customer: Option<String>,
    #[serde(default)]
    pub served_by: Option<String>,

    #[serde(default)]
    pub services: Vec<Line>,
    #[serde(default)]
    pub products: Vec<Line>,

    /// All santim.
    #[serde(default)]
    pub subtotal: i64,
    /// "Tax (15%)" -- the rate is worked out by the salon system, which holds it.
    #[serde(default)]
    pub tax_label: Option<String>,
    #[serde(default)]
    pub tax_amount: i64,
    #[serde(default)]
    pub discount_label: Option<String>,
    #[serde(default)]
    pub discount_amount: i64,
    #[serde(default)]
    pub tip_amount: i64,
    #[serde(default)]
    pub total: i64,

    #[serde(default)]
    pub payment: Option<Payment>,
    /// "PAID".
    #[serde(default)]
    pub status: Option<String>,
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/// Santim as "1,840.00" -- grouped, always two decimals.
///
/// This deliberately matches `formatMoney` in `src/lib/money.ts` character for
/// character. A receipt that disagrees with the screen it was printed from is
/// worse than no receipt.
pub fn money(santim: i64) -> String {
    let negative = santim < 0;
    let absolute = santim.unsigned_abs();
    let birr = absolute / 100;
    let cents = absolute % 100;

    let digits = birr.to_string();
    let mut grouped = String::new();
    for (index, character) in digits.chars().enumerate() {
        if index > 0 && (digits.len() - index) % 3 == 0 {
            grouped.push(',');
        }
        grouped.push(character);
    }

    format!("{}{grouped}.{cents:02}", if negative { "-" } else { "" })
}

// ---------------------------------------------------------------------------
// The templates
// ---------------------------------------------------------------------------

/// The salon's name, address and phone, and whatever extra lines this printer
/// was given. Both tickets start the same way.
fn letterhead(doc: &mut Doc, salon: &Salon, printer: &Printer) {
    let name = salon.name.trim();
    doc.title(if name.is_empty() { "BERCHI SALON" } else { name });

    if let Some(address) = non_empty(&salon.address) {
        doc.centered(address);
    }
    if let Some(phone) = non_empty(&salon.phone) {
        doc.centered(phone);
    }
    for line in &printer.header {
        doc.centered(line.trim());
    }
}

fn non_empty(value: &Option<String>) -> Option<&str> {
    value.as_deref().map(str::trim).filter(|text| !text.is_empty())
}

/// How large the ticket number can be printed.
///
/// As large as the paper allows, up to the point where it stops looking like a
/// number and starts looking like a mistake. A two-digit number on 80 mm paper
/// prints at 8x -- the most ESC/POS can express, about 4 cm tall -- which is
/// the point: it has to be readable at arm's length, held up across a busy salon.
fn number_size(number: &str, width: u8) -> u8 {
    let characters = number.chars().count().max(1) as u8;
    (width / characters).clamp(2, 8)
}

/// How large the full ticket number under it can be printed: double size when
/// it fits the paper, otherwise double height only so it never wraps.
fn full_number_style(number: &str, width: u8) -> Style {
    let characters = number.chars().count() as u8;
    if characters.saturating_mul(2) <= width {
        Style::centered().bold().scale(2, 2)
    } else {
        Style::centered().bold().scale(1, 2)
    }
}

/// The number slip.
pub fn slip(ticket: &Slip, printer: &Printer) -> Doc {
    let width = printer.paper.characters_per_line;
    let mut doc = Doc::new(width);

    letterhead(&mut doc, &ticket.salon, printer);
    doc.heavy_rule();

    doc.line("YOUR NUMBER", Style::centered().bold());
    doc.blank();

    // The one thing on this slip that matters from across the room.
    let short = if ticket.short_number.trim().is_empty() {
        short_from(&ticket.order_number)
    } else {
        ticket.short_number.trim().to_string()
    };
    doc.line(&short, Style::centered().bold().scale(number_size(&short, width), 8));

    doc.blank();
    let full = ticket.order_number.trim();
    doc.line(full, full_number_style(full, width));
    doc.rule();

    if let Some(customer) = non_empty(&ticket.customer) {
        doc.line(customer, Style::centered().bold().scale(2, 1));
    }
    if let Some(arrived) = non_empty(&ticket.arrived) {
        doc.centered(arrived);
    }

    doc.rule();
    doc.centered("Please give this number to your stylist.");
    doc.centered("Keep this slip until you pay.");

    // The full number as a code too, so the cashier can find the ticket by
    // scanning rather than typing it back in.
    doc.blank();
    doc.qr(ticket.order_number.trim(), 6);

    for line in &printer.footer {
        doc.centered(line.trim());
    }

    finish(&mut doc, printer);
    doc
}

/// `ORD-20260922-0045` reads as "45". The salon system normally sends this
/// already worked out; this is the fallback when it does not.
fn short_from(order_number: &str) -> String {
    let tail = order_number.rsplit('-').next().unwrap_or(order_number);
    let trimmed = tail.trim_start_matches('0');
    if trimmed.is_empty() { tail.to_string() } else { trimmed.to_string() }
}

/// One service or product line: name on the left, what it adds on the right,
/// with the arithmetic underneath when there is more than one of them.
fn item(doc: &mut Doc, line: &Line) {
    doc.row(line.name.trim(), &money(line.amount));
    if line.quantity > 1 {
        doc.text(&format!("  {} x {}", line.quantity, money(line.unit_price)));
    }
}

/// The receipt.
pub fn receipt(ticket: &Receipt, printer: &Printer) -> Doc {
    let width = printer.paper.characters_per_line;
    let mut doc = Doc::new(width);

    letterhead(&mut doc, &ticket.salon, printer);
    doc.heavy_rule();

    doc.row("Receipt", ticket.invoice_number.trim());
    if let Some(issued) = non_empty(&ticket.issued) {
        doc.row("Date", issued);
    }
    if let Some(order) = non_empty(&ticket.order_number) {
        doc.row("Ticket", order);
    }
    if let Some(customer) = non_empty(&ticket.customer) {
        doc.row("Customer", customer);
    }
    if let Some(server) = non_empty(&ticket.served_by) {
        doc.row("Served by", server);
    }

    if !ticket.services.is_empty() {
        doc.rule();
        doc.heading("SERVICES");
        for line in &ticket.services {
            item(&mut doc, line);
        }
    }

    if !ticket.products.is_empty() {
        doc.rule();
        doc.heading("PRODUCTS");
        for line in &ticket.products {
            item(&mut doc, line);
        }
    }

    doc.rule();
    doc.row("Subtotal", &money(ticket.subtotal));
    if ticket.tax_amount != 0 {
        doc.row(non_empty(&ticket.tax_label).unwrap_or("Tax"), &money(ticket.tax_amount));
    }
    if ticket.discount_amount != 0 {
        // Shown as what it takes off, because that is what the customer is
        // checking when they run a finger down the column.
        doc.row(
            non_empty(&ticket.discount_label).unwrap_or("Discount"),
            &format!("-{}", money(ticket.discount_amount.abs())),
        );
    }
    if ticket.tip_amount != 0 {
        doc.row("Tip", &money(ticket.tip_amount));
    }

    doc.heavy_rule();
    let currency = ticket.salon.currency.as_deref().unwrap_or("ETB").trim();
    doc.total_row("TOTAL", &format!("{currency} {}", money(ticket.total)));
    doc.heavy_rule();

    if let Some(payment) = &ticket.payment {
        doc.row("Paid by", payment.method.trim());
        if let Some(reference) = non_empty(&payment.reference) {
            doc.row("Reference", reference);
        }
    }
    if let Some(status) = non_empty(&ticket.status) {
        doc.blank();
        doc.line(status, Style::centered().bold());
    }

    doc.rule();
    doc.centered("Thank you for visiting!");
    doc.centered("We look forward to seeing you again.");

    for line in &printer.footer {
        doc.centered(line.trim());
    }

    doc.blank();
    doc.qr(ticket.invoice_number.trim(), 5);

    // Cash only. A card or transfer popping the drawer is how a till loses count
    // of what should be in it.
    if printer.cash_drawer.open_on_cash_sale && ticket.payment.as_ref().is_some_and(|p| p.is_cash) {
        doc.open_drawer();
    }

    finish(&mut doc, printer);
    doc
}

/// A ticket showing what this printer is set to, for proving the setup.
///
/// It is deliberately made of the same pieces as a real ticket -- the same
/// letterhead, rules, rows, total and cut -- because the question it answers is
/// "will a receipt come out right", not "does anything come out at all".
pub fn test_page(printer: &Printer) -> Doc {
    let width = printer.paper.characters_per_line;
    let mut doc = Doc::new(width);

    let salon = Salon {
        name: "BERCHI SALON".into(),
        address: Some("Test print".into()),
        phone: None,
        currency: Some("ETB".into()),
    };
    letterhead(&mut doc, &salon, printer);
    doc.heavy_rule();

    doc.row("Printer", printer.name.trim());
    doc.row("Wired as", &printer.connection.describe());
    doc.row("Paper", &format!("{} mm", printer.paper.width_mm));
    doc.row("Per line", &format!("{} characters", width));
    doc.row("Cut", &printer.cut.mode.to_string());
    doc.row("Cut amount", &format!("{} lines fed", printer.cut.feed_lines));
    doc.row("Copies", &printer.copies.to_string());

    doc.rule();
    doc.heading("THE WHOLE LINE");
    // If the printer is set to more characters than the paper takes, this line
    // is where it shows: the last digits fall off the edge or wrap.
    doc.text(&ruler(width));
    doc.text("The quick brown fox jumps over the lazy dog, twice over.");

    doc.rule();
    doc.heading("SERVICES");
    item(&mut doc, &Line { name: "Haircut".into(), quantity: 1, unit_price: 35000, amount: 35000 });
    item(&mut doc, &Line {
        name: "Keratin treatment and blow dry".into(),
        quantity: 2,
        unit_price: 62500,
        amount: 125000,
    });

    doc.rule();
    doc.row("Subtotal", &money(160000));
    doc.row("Tax (15%)", &money(24000));
    doc.heavy_rule();
    doc.total_row("TOTAL", &format!("ETB {}", money(184000)));
    doc.heavy_rule();

    doc.centered("If this reads cleanly, the printer is set up.");
    doc.blank();
    doc.qr("BERCHI-TEST-PRINT", 5);

    finish(&mut doc, printer);
    doc
}

/// `1234567890...` across the paper, so the width setting can be checked by
/// counting rather than by guessing.
fn ruler(width: u8) -> String {
    (1..=width).map(|column| char::from_digit((column % 10) as u32, 10).unwrap_or('0')).collect()
}

/// How every ticket ends: roll the paper on by the cut amount, then cut.
///
/// The feed is not decoration. The cutter sits above the print head, so without
/// it the blade lands in the middle of the last line that was printed.
fn finish(doc: &mut Doc, printer: &Printer) {
    doc.feed(printer.cut.feed_lines);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::printing::settings::{Connection, CutMode};

    fn printer() -> Printer {
        Printer::new(
            "p1".into(),
            "Front counter".into(),
            Connection::Network { host: "192.168.1.60".into(), port: 9100 },
        )
    }

    /// The same figures as `src/lib/money.ts`. A receipt that disagrees with the
    /// screen it was printed from is worse than no receipt.
    #[test]
    fn money_reads_the_way_the_till_does() {
        assert_eq!(money(184000), "1,840.00");
        assert_eq!(money(0), "0.00");
        assert_eq!(money(5), "0.05");
        assert_eq!(money(50), "0.50");
        assert_eq!(money(100), "1.00");
        assert_eq!(money(-2550), "-25.50");
        assert_eq!(money(123456789), "1,234,567.89");
        assert_eq!(money(100000000), "1,000,000.00");
    }

    #[test]
    fn the_number_is_printed_as_large_as_the_paper_takes() {
        // Two digits on 80 mm paper: as large as ESC/POS goes.
        assert_eq!(number_size("45", 42), 8);
        assert_eq!(number_size("1234", 42), 8);
        // A long number shrinks rather than running off the edge.
        assert_eq!(number_size("12345678", 42), 5);
        assert!(number_size("12345678", 42) * 8 <= 42);
        // Narrow paper, and it still fits.
        assert!(number_size("1234", 32) * 4 <= 32);
    }

    #[test]
    fn a_slip_leads_with_the_number() {
        let ticket = Slip {
            order_number: "ORD-20260922-0045".into(),
            short_number: "45".into(),
            customer: Some("Almaz Tadesse".into()),
            arrived: Some("22 Sep 2026 14:32".into()),
            salon: Salon { name: "Berchi Salon".into(), ..Salon::default() },
        };
        let doc = slip(&ticket, &printer());
        let text = crate::printing::render::to_text(&doc);

        assert!(text.contains("45"), "{text}");
        assert!(text.contains("ORD-20260922-0045"), "{text}");
        assert!(text.contains("Almaz Tadesse"), "{text}");
        assert!(text.contains("YOUR NUMBER"), "{text}");
    }

    /// A name is asked for at reception but not insisted on, so the slip has to
    /// work without one.
    #[test]
    fn a_slip_works_for_someone_who_gave_no_name() {
        let ticket = Slip {
            order_number: "ORD-20260922-0045".into(),
            short_number: "45".into(),
            ..Slip::default()
        };
        let text = crate::printing::render::to_text(&slip(&ticket, &printer()));
        assert!(text.contains("45"));
    }

    /// The salon system normally sends the short number; if it ever does not,
    /// the slip must not come out blank where the number should be.
    #[test]
    fn the_short_number_can_be_worked_out_from_the_long_one() {
        assert_eq!(short_from("ORD-20260922-0045"), "45");
        assert_eq!(short_from("ORD-20260922-0000"), "0000");
        assert_eq!(short_from("weird"), "weird");
    }

    #[test]
    fn a_receipt_adds_up_on_paper() {
        let ticket = Receipt {
            invoice_number: "INV-0001".into(),
            order_number: Some("ORD-20260922-0045".into()),
            customer: Some("Almaz Tadesse".into()),
            served_by: Some("Sara".into()),
            services: vec![Line {
                name: "Haircut".into(),
                quantity: 1,
                unit_price: 35000,
                amount: 35000,
            }],
            products: vec![Line {
                name: "Shampoo 500ml".into(),
                quantity: 2,
                unit_price: 9000,
                amount: 18000,
            }],
            subtotal: 53000,
            tax_label: Some("Tax (15%)".into()),
            tax_amount: 7950,
            discount_amount: 5000,
            discount_label: Some("Discount (10%)".into()),
            tip_amount: 2000,
            total: 57950,
            payment: Some(Payment { method: "Cash".into(), is_cash: true, reference: None }),
            status: Some("PAID".into()),
            salon: Salon { name: "Berchi Salon".into(), currency: Some("ETB".into()), ..Salon::default() },
            ..Receipt::default()
        };
        let text = crate::printing::render::to_text(&receipt(&ticket, &printer()));

        assert!(text.contains("INV-0001"), "{text}");
        assert!(text.contains("Haircut"), "{text}");
        assert!(text.contains("350.00"), "{text}");
        assert!(text.contains("2 x 90.00"), "{text}");
        assert!(text.contains("ETB 579.50"), "{text}");
        assert!(text.contains("-50.00"), "{text}");
        assert!(text.contains("Paid by"), "{text}");
        // Nothing may run off the edge of the paper.
        for line in text.lines() {
            assert!(line.chars().count() <= 42, "too wide: {line:?}");
        }
    }

    /// A receipt with nothing on it should still be a receipt, not a panic.
    #[test]
    fn an_empty_receipt_still_prints() {
        let text = crate::printing::render::to_text(&receipt(&Receipt::default(), &printer()));
        assert!(text.contains("TOTAL"));
    }

    /// A card sale popping the drawer is how a till loses count of its cash.
    #[test]
    fn only_a_cash_sale_kicks_the_drawer() {
        let mut p = printer();
        p.cash_drawer.open_on_cash_sale = true;

        let cash = Receipt {
            payment: Some(Payment { method: "Cash".into(), is_cash: true, reference: None }),
            ..Receipt::default()
        };
        assert!(receipt(&cash, &p).blocks.contains(&crate::printing::doc::Block::OpenDrawer));

        let card = Receipt {
            payment: Some(Payment { method: "Bank transfer".into(), is_cash: false, reference: None }),
            ..Receipt::default()
        };
        assert!(!receipt(&card, &p).blocks.contains(&crate::printing::doc::Block::OpenDrawer));

        // And never when the salon has not asked for it.
        assert!(!receipt(&cash, &printer()).blocks.contains(&crate::printing::doc::Block::OpenDrawer));
    }

    /// The cut amount is the setting most likely to be wrong on a new printer,
    /// so the ticket must actually carry it.
    #[test]
    fn the_cut_amount_reaches_the_paper() {
        let mut p = printer();
        p.cut.feed_lines = 7;
        let doc = slip(&Slip::default(), &p);
        assert_eq!(doc.blocks.last(), Some(&crate::printing::doc::Block::Feed { lines: 7 }));

        // Asking for no feed at all leaves nothing behind.
        p.cut.feed_lines = 0;
        p.cut.mode = CutMode::None;
        let doc = slip(&Slip::default(), &p);
        assert!(!doc.blocks.iter().any(|b| matches!(b, crate::printing::doc::Block::Feed { .. })));
    }

    /// The test print exists to prove the width setting, so it has to be laid
    /// out at that width.
    #[test]
    fn the_test_print_measures_the_paper() {
        let mut p = printer();
        p.paper.characters_per_line = 32;
        let text = crate::printing::render::to_text(&test_page(&p));

        assert!(text.contains("12345678901234567890123456789012"), "{text}");
        assert!(text.contains("Cut amount"), "{text}");
        for line in text.lines() {
            assert!(line.chars().count() <= 32, "too wide: {line:?}");
        }
    }

    #[test]
    fn extra_header_and_footer_lines_reach_the_paper() {
        let mut p = printer();
        p.header = vec!["Licence 12/345".into()];
        p.footer = vec!["Open 9 to 7, Tuesday to Sunday".into()];
        let text = crate::printing::render::to_text(&slip(&Slip::default(), &p));

        assert!(text.contains("Licence 12/345"), "{text}");
        assert!(text.contains("Open 9 to 7"), "{text}");
    }
}
