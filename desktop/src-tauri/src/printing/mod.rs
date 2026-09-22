//! Printing tickets on a real receipt printer.
//!
//! Before this, the number slip was printed by asking the web view to print the
//! page, with no dialog, to whichever printer Windows had as its default. That
//! works, and it is still what happens when nothing here is set up -- but it
//! gives the salon no say in *which* printer, prints a web page rather than a
//! receipt, and has no way to cut the paper or open the cash drawer.
//!
//! What is here instead: the PC is told which printer to use for which ticket
//! ([`settings`]), the ticket is laid out for a receipt printer ([`ticket`],
//! [`doc`]) and sent as ESC/POS ([`render`]) down whichever wire that printer is
//! on ([`transport`]).
//!
//! **Nothing here is compulsory.** A PC with no printer set up answers
//! "not printed, nothing is set up" and the salon system falls back to printing
//! through the web view exactly as before. That matters: this is a working
//! salon, and a half-finished printer setup must not stop reception issuing
//! tickets.
//!
//! ## Who may ask for a print
//!
//! The salon system is a web page loaded from a server, so by default it cannot
//! call into this program at all -- Tauri refuses IPC from a remote page unless
//! a capability explicitly allows it. [`salon_capability`] grants exactly the
//! five printing commands to exactly the salon's own address, at start-up, once
//! that address is known. Settings cannot be read or changed from the salon
//! page: that belongs to the PC, and is done in the window this program opens
//! itself.

/// Linux and macOS reach a printer through CUPS. Windows has its own spooler
/// API and never needs this.
#[cfg(not(windows))]
pub mod cups;
pub mod discovery;
pub mod doc;
pub mod render;
pub mod settings;
pub mod ticket;
pub mod transport;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use settings::{Job, Printer, Settings};

/// The window the settings manager lives in.
const SETTINGS_WINDOW: &str = "printers";
const SETTINGS_PAGE: &str = "printers.html";

// ---------------------------------------------------------------------------
// What the commands hand back
// ---------------------------------------------------------------------------

/// The settings, and where they are kept.
///
/// The path is shown in the settings window on purpose. When something is wrong
/// it is the first thing worth knowing, and it saves a support conversation
/// that starts "where does it keep that?".
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Stored {
    pub settings: Settings,
    pub path: String,
    /// Which operating system this till runs.
    ///
    /// The settings window uses it to say the true thing: *Printers & scanners*
    /// on Windows, a print queue on Linux, `COM1` against `/dev/ttyUSB0`. The
    /// alternative is one set of words that is wrong on two platforms out of
    /// three, which is how a salon comes to believe the program does not
    /// support its computer.
    pub platform: &'static str,
}

/// Which operating system this is, in one word, for the settings window.
pub fn platform() -> &'static str {
    if cfg!(windows) {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    }
}

/// What happened when a ticket was sent.
///
/// A failure is reported here rather than as an error, because the salon system
/// has somewhere to go when printing does not work: it prints the ticket through
/// the web view instead. Reception gets paper either way, and `reason` is shown
/// so the salon knows the receipt printer needs attention rather than finding
/// out weeks later.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Outcome {
    pub printed: bool,
    /// Which printer took it, when one did.
    pub printer: Option<String>,
    /// Why it did not print, when it did not.
    pub reason: Option<String>,
}

impl Outcome {
    fn printed(printer: &Printer) -> Self {
        Self { printed: true, printer: Some(printer.name.clone()), reason: None }
    }

    fn not_printed(reason: impl Into<String>) -> Self {
        Self { printed: false, printer: None, reason: Some(reason.into()) }
    }
}

/// What the salon system asks before it prints, so it knows whether to expect a
/// receipt printer or to use the web view.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    /// Always true: being able to ask at all means the desktop window is here.
    pub desktop: bool,
    /// The printer the number slip goes to, by name, if one is set up.
    pub slip: Option<String>,
    /// The printer the receipt goes to, by name, if one is set up.
    pub receipt: Option<String>,
}

/// Which ticket to show in the preview.
#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Sample {
    Slip,
    Receipt,
    /// The test print: the settings written out, and a ruler across the paper.
    Test,
}

// ---------------------------------------------------------------------------
// Reading and writing the settings
// ---------------------------------------------------------------------------

/// Where this program keeps its settings on this PC.
fn settings_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let folder = app
        .path()
        .app_config_dir()
        .map_err(|err| format!("Cannot find where to keep the settings: {err}"))?;
    Ok(settings::path_in(&folder))
}

fn read(app: &AppHandle) -> Result<Settings, String> {
    settings::load(&settings_path(app)?)
}

// ---------------------------------------------------------------------------
// The commands
// ---------------------------------------------------------------------------

/// What printers this PC can see. For the settings window's "add a printer".
#[tauri::command]
pub fn list_printers() -> discovery::Found {
    discovery::look()
}

/// The settings as they stand.
#[tauri::command]
pub fn printer_settings(app: AppHandle) -> Result<Stored, String> {
    let path = settings_path(&app)?;
    Ok(Stored {
        settings: settings::load(&path)?,
        path: path.display().to_string(),
        platform: platform(),
    })
}

/// Saves the settings, having first checked a printer could act on them.
#[tauri::command]
pub fn save_printer_settings(app: AppHandle, settings: Settings) -> Result<Stored, String> {
    let path = settings_path(&app)?;
    let tidied = settings.tidied()?;
    settings::save(&path, &tidied)?;
    Ok(Stored { settings: tidied, path: path.display().to_string(), platform: platform() })
}

/// The ticket as characters, for the preview beside the settings form.
///
/// It takes the printer as it is being edited rather than as it was saved, so
/// the preview answers for what is on screen. Changing the paper width from 80
/// to 58 shows the receipt reflow before anything is committed.
#[tauri::command]
pub fn preview_ticket(printer: Printer, sample: Sample) -> String {
    render::to_text(&sample_ticket(&printer, sample))
}

/// Prints a test ticket on the printer being edited.
///
/// Also takes the unsaved printer, for the same reason: the way to find the
/// right cut amount is to change it, print, look at the paper, and change it
/// again. Making that a save-then-print round trip would make it tedious enough
/// that nobody does it, and the cut amount would stay wrong.
#[tauri::command]
pub fn test_print(printer: Printer) -> Result<(), String> {
    let transport = transport::open(&printer.connection)?;
    render::print(&ticket::test_page(&printer), &printer, transport)
}

/// Prints the number slip handed over at reception.
#[tauri::command]
pub fn print_slip(app: AppHandle, slip: ticket::Slip) -> Outcome {
    send(&app, Job::Slip, |printer| ticket::slip(&slip, printer))
}

/// Prints the receipt handed over at checkout.
#[tauri::command]
pub fn print_receipt(app: AppHandle, receipt: ticket::Receipt) -> Outcome {
    send(&app, Job::Receipt, |printer| ticket::receipt(&receipt, printer))
}

/// Lays out a ticket and sends it to whichever printer that job is assigned to.
///
/// The one place a print can fail, and the one place it is turned into something
/// the salon system can act on rather than an error that stops the sale.
fn send(app: &AppHandle, job: Job, build: impl FnOnce(&Printer) -> doc::Doc) -> Outcome {
    let settings = match read(app) {
        Ok(settings) => settings,
        Err(problem) => return Outcome::not_printed(problem),
    };

    let Some(printer) = settings.printer_for(job) else {
        return Outcome::not_printed(format!(
            "No printer is set up for the {} on this PC.",
            job.label()
        ));
    };

    let transport = match transport::open(&printer.connection) {
        Ok(transport) => transport,
        Err(problem) => return Outcome::not_printed(problem),
    };

    match render::print(&build(printer), printer, transport) {
        Ok(()) => Outcome::printed(printer),
        Err(problem) => Outcome::not_printed(problem),
    }
}

/// Kicks the cash drawer open, without printing anything.
///
/// For the times the drawer has to be opened outside a sale -- making change,
/// counting up at close. Which printer the drawer hangs off is a setting, and
/// with nothing said it is the receipt printer's, because that is where a
/// drawer is plugged in.
#[tauri::command]
pub fn open_cash_drawer(app: AppHandle, printer_id: Option<String>) -> Result<(), String> {
    let settings = read(&app)?;

    let printer = match printer_id.as_deref() {
        Some(id) => settings
            .printer(id)
            .ok_or_else(|| "That printer is no longer set up on this PC.".to_string())?,
        None => settings
            .printer_for(Job::Receipt)
            .ok_or_else(|| "No receipt printer is set up on this PC.".to_string())?,
    };

    let transport = transport::open(&printer.connection)?;

    let mut kick = doc::Doc::new(printer.paper.characters_per_line);
    kick.open_drawer();

    // Never a cut: nothing was printed, so there is nothing to cut off, and a
    // drawer opened at closing time should not spit out a strip of paper.
    let mut silent = printer.clone();
    silent.cut.mode = settings::CutMode::None;
    silent.cut.feed_lines = 0;
    silent.copies = 1;

    render::print(&kick, &silent, transport)
}

/// Whether this PC prints tickets itself, and on what.
#[tauri::command]
pub fn printing_status(app: AppHandle) -> Status {
    let settings = read(&app).unwrap_or_default();
    Status {
        desktop: true,
        slip: settings.printer_for(Job::Slip).map(|printer| printer.name.clone()),
        receipt: settings.printer_for(Job::Receipt).map(|printer| printer.name.clone()),
    }
}

/// Opens the printer settings window, or brings it forward if it is already up.
#[tauri::command]
pub fn open_printer_settings(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(SETTINGS_WINDOW) {
        let _ = window.unminimize();
        let _ = window.set_focus();
        return Ok(());
    }

    WebviewWindowBuilder::new(&app, SETTINGS_WINDOW, WebviewUrl::App(SETTINGS_PAGE.into()))
        .title("Printer setup - Berchi Cashier")
        .inner_size(1060.0, 820.0)
        .min_inner_size(760.0, 560.0)
        .build()
        .map(|_| ())
        .map_err(|err| format!("Cannot open the printer settings: {err}"))
}

// ---------------------------------------------------------------------------
// Letting the salon's own pages print
// ---------------------------------------------------------------------------

/// The permission that lets the salon system ask this program to print.
///
/// Tauri refuses IPC from a page loaded over the network unless a capability
/// names its address, which is the behaviour we want: without this, the salon
/// system -- or anything that managed to get itself loaded in the window --
/// could not reach the printer at all.
///
/// Two things keep it tight:
///
/// - **Only the salon.** The addresses are the same ones `navigation_allowed`
///   lets the window visit, so nothing else can be showing when a command
///   arrives.
/// - **Only printing.** Reading or changing the printer settings is not in the
///   list. Those belong to the PC and are done in the window this program opens
///   itself, so a salon server that was tampered with cannot quietly point the
///   till's receipts somewhere else.
pub fn salon_capability(addresses: &[String]) -> String {
    let urls: Vec<String> = addresses.iter().map(|origin| format!("{origin}/*")).collect();

    serde_json::json!({
        "identifier": "salon-printing",
        "description": "Lets the salon system print tickets on this PC's receipt printer.",
        "windows": ["main"],
        "remote": { "urls": urls },
        "local": false,
        "permissions": [
            "allow-print-slip",
            "allow-print-receipt",
            "allow-open-cash-drawer",
            "allow-printing-status",
            "allow-open-printer-settings",
        ],
    })
    .to_string()
}

// ---------------------------------------------------------------------------
// The sample tickets behind the preview
// ---------------------------------------------------------------------------

/// A believable ticket to lay out in the preview.
///
/// Deliberately awkward: a service name long enough to wrap, a quantity above
/// one, a discount and a tip. A preview made of short tidy names would look
/// right at any paper width and would prove nothing.
fn sample_ticket(printer: &Printer, sample: Sample) -> doc::Doc {
    let salon = ticket::Salon {
        name: "Berchi Salon".into(),
        address: Some("Bole Road, Addis Ababa".into()),
        phone: Some("+251 91 234 5678".into()),
        currency: Some("ETB".into()),
    };

    match sample {
        Sample::Test => ticket::test_page(printer),

        Sample::Slip => ticket::slip(
            &ticket::Slip {
                salon,
                order_number: "ORD-20260922-0045".into(),
                short_number: "45".into(),
                customer: Some("Almaz Tadesse".into()),
                arrived: Some("22 Sep 2026 14:32".into()),
            },
            printer,
        ),

        Sample::Receipt => ticket::receipt(
            &ticket::Receipt {
                salon,
                invoice_number: "INV-20260922-0031".into(),
                order_number: Some("ORD-20260922-0045".into()),
                issued: Some("22 Sep 2026 16:05".into()),
                customer: Some("Almaz Tadesse".into()),
                served_by: Some("Sara Bekele".into()),
                services: vec![
                    ticket::Line {
                        name: "Haircut and style".into(),
                        quantity: 1,
                        unit_price: 35000,
                        amount: 35000,
                    },
                    ticket::Line {
                        name: "Keratin treatment and blow dry".into(),
                        quantity: 2,
                        unit_price: 62500,
                        amount: 125000,
                    },
                ],
                products: vec![ticket::Line {
                    name: "Argan oil shampoo 500ml".into(),
                    quantity: 1,
                    unit_price: 18000,
                    amount: 18000,
                }],
                subtotal: 178000,
                tax_label: Some("Tax (15%)".into()),
                tax_amount: 26700,
                discount_label: Some("Discount (10%)".into()),
                discount_amount: 17800,
                tip_amount: 5000,
                total: 191900,
                payment: Some(ticket::Payment {
                    method: "Cash".into(),
                    is_cash: true,
                    reference: None,
                }),
                status: Some("PAID".into()),
            },
            printer,
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use settings::Connection;

    fn printer() -> Printer {
        Printer::new(
            "p1".into(),
            "Front counter".into(),
            Connection::Network { host: "192.168.1.60".into(), port: 9100 },
        )
    }

    /// The permission must name the salon and nothing else, and must not carry
    /// the settings commands: the till's own setup is not the server's business.
    #[test]
    fn the_salon_may_print_and_nothing_more() {
        let capability = salon_capability(&["https://salon.example.com".to_string()]);
        let parsed: serde_json::Value = serde_json::from_str(&capability).unwrap();

        assert_eq!(parsed["remote"]["urls"][0], "https://salon.example.com/*");
        assert_eq!(parsed["local"], false);
        assert_eq!(parsed["windows"][0], "main");

        let allowed = parsed["permissions"].as_array().unwrap();
        assert!(allowed.iter().any(|p| p == "allow-print-slip"));
        assert!(allowed.iter().any(|p| p == "allow-print-receipt"));
        // The settings belong to the PC.
        assert!(!allowed.iter().any(|p| p == "allow-save-printer-settings"));
        assert!(!allowed.iter().any(|p| p == "allow-printer-settings"));
        assert!(!allowed.iter().any(|p| p == "allow-list-printers"));
        assert!(!allowed.iter().any(|p| p == "allow-test-print"));
    }

    /// A salon written down as http:// that redirects to https:// is the same
    /// salon, and the window follows it, so the permission has to cover both or
    /// printing stops working the moment it does.
    #[test]
    fn every_address_the_window_may_show_can_print() {
        let capability = salon_capability(&[
            "http://salon.example.com".to_string(),
            "https://salon.example.com".to_string(),
        ]);
        let parsed: serde_json::Value = serde_json::from_str(&capability).unwrap();
        let urls = parsed["remote"]["urls"].as_array().unwrap();

        assert_eq!(urls.len(), 2);
        assert!(urls.iter().any(|u| u == "http://salon.example.com/*"));
        assert!(urls.iter().any(|u| u == "https://salon.example.com/*"));
    }

    /// The preview has to show wrapping, so its sample must contain something
    /// that wraps on the narrow roll.
    #[test]
    fn the_sample_receipt_is_awkward_enough_to_be_useful() {
        let mut narrow = printer();
        narrow.paper.characters_per_line = 32;
        let text = render::to_text(&sample_ticket(&narrow, Sample::Receipt));

        assert!(text.contains("Keratin"), "{text}");
        assert!(text.lines().count() > 20, "a receipt should be longer than that");
        for line in text.lines() {
            assert!(line.chars().count() <= 32, "too wide: {line:?}");
        }
    }

    #[test]
    fn every_sample_lays_out_on_either_roll() {
        for width in [32u8, 42] {
            let mut config = printer();
            config.paper.characters_per_line = width;

            for sample in [Sample::Slip, Sample::Receipt, Sample::Test] {
                let text = render::to_text(&sample_ticket(&config, sample));
                assert!(!text.is_empty());
                for line in text.lines() {
                    assert!(line.chars().count() <= width as usize, "too wide: {line:?}");
                }
            }
        }
    }

    /// Nothing set up must be an answer, not a failure: reception has to keep
    /// issuing tickets through the web view.
    #[test]
    fn a_ticket_with_nowhere_to_go_says_so_plainly() {
        let outcome = Outcome::not_printed("No printer is set up for the number slip on this PC.");
        assert!(!outcome.printed);
        assert!(outcome.reason.unwrap().contains("number slip"));
    }
}
