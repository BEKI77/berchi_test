//! What this cashier PC knows about its printers.
//!
//! One file, `printers.json`, sitting in this program's own settings folder. It
//! belongs to the PC and not to the salon database on purpose: which printer is
//! on the counter, how it is wired and where the paper is cut are facts about
//! *this* counter, and a second till in the same salon will answer differently.
//!
//! Nothing here talks to a printer. It only records what was chosen, and refuses
//! to record something a printer could not act on -- see [`Settings::tidied`].

use std::fmt;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

/// The file, inside the folder Tauri gives this program for its settings.
const FILE_NAME: &str = "printers.json";

/// Points the settings somewhere else for one run. The verification script uses
/// it so a test cannot overwrite the settings of the PC it runs on.
const FILE_ENV: &str = "BERCHI_PRINTERS_FILE";

/// Written into every saved file, so a later version can tell what it is reading.
pub const CURRENT_VERSION: u32 = 1;

/// The most paper a cut is allowed to waste. Twenty lines is already about
/// 7 cm; beyond that a mis-typed setting is eating the roll.
const MAX_FEED_LINES: u8 = 20;

/// Both sides of a single sale: the customer's copy and the salon's.
const MAX_COPIES: u8 = 3;

/// Narrower than this and a price no longer fits beside its service.
const MIN_CHARACTERS_PER_LINE: u8 = 24;
const MAX_CHARACTERS_PER_LINE: u8 = 64;

// ---------------------------------------------------------------------------
// How the printer is wired
// ---------------------------------------------------------------------------

/// How this PC reaches the printer.
///
/// These are the four ways a receipt printer is actually attached in a salon,
/// plus a raw device path for anything unusual. Which one to choose is not a
/// taste: it follows from how the printer was installed, which is why the
/// settings window offers the ones it can see rather than asking.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Connection {
    /// A printer installed in Windows the ordinary way, with its own driver.
    /// The bytes go to the print spooler as a RAW job, so the queue, the
    /// offline warning and "Printers & scanners" all keep working.
    #[serde(rename_all = "camelCase")]
    SystemPrinter { name: String },

    /// A printer with a network socket, which is nearly always port 9100.
    #[serde(rename_all = "camelCase")]
    Network {
        host: String,
        #[serde(default = "default_network_port")]
        port: u16,
    },

    /// A USB printer that Windows picked up with its own class driver
    /// (`usbprint.sys`) because no vendor driver was installed.
    #[serde(rename_all = "camelCase")]
    UsbClass { device_path: String },

    /// A printer on a serial (COM) port. The baud rate has to match the one set
    /// on the printer itself, usually with dip switches underneath it.
    #[serde(rename_all = "camelCase")]
    Serial {
        path: String,
        #[serde(default = "default_baud_rate")]
        baud_rate: u32,
    },

    /// A raw device path, opened and written to as a file. This is the escape
    /// hatch: `/dev/usb/lp0` on Linux, or a share name on Windows.
    #[serde(rename_all = "camelCase")]
    Device { path: String },
}

fn default_network_port() -> u16 {
    9100
}

fn default_baud_rate() -> u32 {
    9600
}

impl Connection {
    /// How the connection reads on screen and in an error message.
    pub fn describe(&self) -> String {
        match self {
            Connection::SystemPrinter { name } => format!("Windows printer \"{name}\""),
            Connection::Network { host, port } => format!("{host} on port {port}"),
            Connection::UsbClass { device_path } => format!("USB printer ({device_path})"),
            Connection::Serial { path, baud_rate } => format!("{path} at {baud_rate} baud"),
            Connection::Device { path } => format!("device {path}"),
        }
    }

    /// Why this connection could never be opened, if so. Checked when settings
    /// are saved, so the trouble is reported over the form that caused it
    /// rather than at the counter on a Saturday.
    fn problem(&self) -> Option<String> {
        match self {
            Connection::SystemPrinter { name } if name.trim().is_empty() => {
                Some("Choose which Windows printer to use.".into())
            }
            Connection::Network { host, .. } if host.trim().is_empty() => {
                Some("Give the printer's address on the network.".into())
            }
            Connection::Network { port, .. } if *port == 0 => {
                Some("Port 0 is not a port. Receipt printers normally use 9100.".into())
            }
            Connection::UsbClass { device_path } if device_path.trim().is_empty() => {
                Some("Choose which USB printer to use.".into())
            }
            Connection::Serial { path, .. } if path.trim().is_empty() => {
                Some("Give the serial port, for example COM1.".into())
            }
            Connection::Serial { baud_rate, .. } if *baud_rate == 0 => {
                Some("Give the printer's baud rate, usually 9600 or 19200.".into())
            }
            Connection::Device { path } if path.trim().is_empty() => {
                Some("Give the path of the device to write to.".into())
            }
            _ => None,
        }
    }
}

// ---------------------------------------------------------------------------
// Paper, cutting, the drawer
// ---------------------------------------------------------------------------

/// The roll in the printer.
///
/// `characters_per_line` is the number that matters -- an ESC/POS printer lays
/// out in characters, not millimetres -- but nobody buys paper in characters, so
/// the width is kept beside it and the settings window suggests one from the
/// other. 80 mm is 42 characters and 58 mm is 32 on almost every printer sold.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Paper {
    pub width_mm: u8,
    pub characters_per_line: u8,
}

impl Default for Paper {
    fn default() -> Self {
        Self { width_mm: 80, characters_per_line: 42 }
    }
}

impl Paper {
    /// The usual character count for a roll width, offered as a starting point.
    /// A printer set to a smaller font fits more, which is why this is only a
    /// suggestion and the number stays editable.
    pub fn characters_for_width(width_mm: u8) -> u8 {
        if width_mm <= 58 {
            32
        } else {
            42
        }
    }
}

/// What happens to the paper at the end of a ticket.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CutMode {
    /// Right through. The ticket falls free.
    Full,
    /// Leaves a small tab of paper holding the ticket on, so a customer can
    /// tear it off but a draught cannot take it. Many printers do this more
    /// reliably than a full cut.
    Partial,
    /// No cut at all, for a printer with no cutter: the paper is torn off
    /// against the bar.
    None,
}

impl fmt::Display for CutMode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CutMode::Full => write!(f, "cut right through"),
            CutMode::Partial => write!(f, "leave a tab"),
            CutMode::None => write!(f, "tear off by hand"),
        }
    }
}

/// How the ticket ends.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Cut {
    pub mode: CutMode,

    /// **The cut amount**: blank lines rolled out before the blade comes down.
    ///
    /// This is not decoration. The cutter sits above the print head by a
    /// centimetre or two, so without a feed the cut lands in the middle of the
    /// last line of the ticket. Too little and the footer is sliced; too much
    /// and every sale throws away paper. Four lines suits most printers and the
    /// right number for a particular one is found by looking at what comes out
    /// -- which is what the test print in the settings window is for.
    pub feed_lines: u8,
}

impl Default for Cut {
    fn default() -> Self {
        Self { mode: CutMode::Full, feed_lines: 4 }
    }
}

/// Which pin the drawer is wired to. Printers expose two; a drawer plugged into
/// the printer's RJ11 socket is nearly always pin 2, and pin 5 is there for the
/// ones that are not.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DrawerPin {
    Pin2,
    Pin5,
}

/// The cash drawer hanging off the printer, if there is one.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CashDrawer {
    /// Kick the drawer open as the receipt prints. Wanted for cash, and a
    /// nuisance for a card or transfer, so the drawer is only kicked when the
    /// sale was actually paid in cash -- see `render::receipt`.
    pub open_on_cash_sale: bool,
    pub pin: DrawerPin,
}

impl Default for CashDrawer {
    fn default() -> Self {
        Self { open_on_cash_sale: false, pin: DrawerPin::Pin2 }
    }
}

// ---------------------------------------------------------------------------
// A printer, and what each ticket goes to
// ---------------------------------------------------------------------------

/// One printer, as set up on this PC.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Printer {
    /// Made up when the printer is added and never shown. The job assignments
    /// below point at this, so renaming a printer does not unassign it.
    pub id: String,

    /// What it is called on screen -- "Front counter", not "EPSON TM-T20III".
    pub name: String,

    pub connection: Connection,

    #[serde(default)]
    pub paper: Paper,

    #[serde(default)]
    pub cut: Cut,

    #[serde(default)]
    pub cash_drawer: CashDrawer,

    /// How many copies of a receipt to print. Two is the usual reason: one for
    /// the customer and one that stays in the till.
    #[serde(default = "default_copies")]
    pub copies: u8,

    /// Extra lines under the salon's name on every ticket -- a licence number,
    /// a slogan, a second phone number.
    #[serde(default)]
    pub header: Vec<String>,

    /// Extra lines at the very bottom, under the thank-you.
    #[serde(default)]
    pub footer: Vec<String>,
}

fn default_copies() -> u8 {
    1
}

impl Printer {
    /// A printer with sensible settings, ready to be named and wired up.
    pub fn new(id: String, name: String, connection: Connection) -> Self {
        Self {
            id,
            name,
            connection,
            paper: Paper::default(),
            cut: Cut::default(),
            cash_drawer: CashDrawer::default(),
            copies: default_copies(),
            header: Vec::new(),
            footer: Vec::new(),
        }
    }
}

/// The two things this system prints, and which printer each one goes to.
///
/// They are separate because a salon may well want them separate: the number
/// slip belongs at reception where the customer is standing, and the receipt
/// belongs at the till. Pointing both at the same printer is normal too, and is
/// what the settings window does when only one printer is set up.
///
/// `None` means "not set up" -- and that is a working answer, not a fault. The
/// salon system then prints that ticket through the web view and the Windows
/// default printer, exactly as it did before any of this existed.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Jobs {
    /// The number slip handed over at reception.
    pub slip: Option<String>,
    /// The receipt handed over at checkout.
    pub receipt: Option<String>,
}

/// Which of the two tickets is being printed. Used to look up the printer and
/// to choose the template.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Job {
    Slip,
    Receipt,
}

impl Job {
    pub fn label(self) -> &'static str {
        match self {
            Job::Slip => "number slip",
            Job::Receipt => "receipt",
        }
    }
}

/// Everything this PC has been told about printing.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    #[serde(default = "current_version")]
    pub version: u32,

    #[serde(default)]
    pub printers: Vec<Printer>,

    #[serde(default)]
    pub jobs: Jobs,
}

fn current_version() -> u32 {
    CURRENT_VERSION
}

impl Default for Settings {
    /// Nothing set up. This is what a PC that has never opened the settings
    /// window has, and it prints through the web view, as before.
    fn default() -> Self {
        Self { version: CURRENT_VERSION, printers: Vec::new(), jobs: Jobs::default() }
    }
}

impl Settings {
    /// The printer a ticket should go to, or `None` if none was assigned.
    pub fn printer_for(&self, job: Job) -> Option<&Printer> {
        let id = match job {
            Job::Slip => self.jobs.slip.as_deref(),
            Job::Receipt => self.jobs.receipt.as_deref(),
        }?;
        self.printer(id)
    }

    pub fn printer(&self, id: &str) -> Option<&Printer> {
        self.printers.iter().find(|printer| printer.id == id)
    }

    /// The settings as they will be saved, or why they cannot be.
    ///
    /// Numbers are clamped rather than refused, because a slider that snaps back
    /// to 20 explains itself and an error message about `feedLines` does not.
    /// The things that are genuinely a choice gone wrong -- a printer with no
    /// name, two printers sharing an id, a ticket pointed at a printer that was
    /// deleted -- are refused and named.
    pub fn tidied(mut self) -> Result<Self, String> {
        self.version = CURRENT_VERSION;

        let mut seen: Vec<&str> = Vec::new();
        for printer in &mut self.printers {
            printer.id = printer.id.trim().to_string();
            printer.name = printer.name.trim().to_string();

            if printer.id.is_empty() {
                return Err("A printer was saved without an id. Close the window and try again.".into());
            }
            if printer.name.is_empty() {
                return Err("Give every printer a name, so the list means something later.".into());
            }
            if let Some(problem) = printer.connection.problem() {
                return Err(format!("{}: {problem}", printer.name));
            }

            printer.paper.characters_per_line = printer
                .paper
                .characters_per_line
                .clamp(MIN_CHARACTERS_PER_LINE, MAX_CHARACTERS_PER_LINE);
            printer.cut.feed_lines = printer.cut.feed_lines.min(MAX_FEED_LINES);
            printer.copies = printer.copies.clamp(1, MAX_COPIES);
            printer.header.retain(|line| !line.trim().is_empty());
            printer.footer.retain(|line| !line.trim().is_empty());

            if seen.contains(&printer.id.as_str()) {
                return Err(format!("Two printers are saved as \"{}\".", printer.name));
            }
            seen.push(&printer.id);
        }

        // A ticket pointed at a printer that is no longer in the list would
        // silently stop printing, so say so instead.
        for (assigned, job) in [(&self.jobs.slip, Job::Slip), (&self.jobs.receipt, Job::Receipt)] {
            if let Some(id) = assigned {
                if !self.printers.iter().any(|printer| &printer.id == id) {
                    return Err(format!(
                        "The {} is set to print on a printer that is no longer in the list.",
                        job.label()
                    ));
                }
            }
        }

        Ok(self)
    }
}

// ---------------------------------------------------------------------------
// Reading and writing the file
// ---------------------------------------------------------------------------

/// Where the settings live on this PC.
///
/// `config_dir` is the folder Tauri hands the program for exactly this, under
/// the user's own profile, so writing there needs no administrator rights and
/// survives reinstalling the program.
pub fn path_in(config_dir: &Path) -> PathBuf {
    if let Some(overridden) = std::env::var_os(FILE_ENV) {
        if !overridden.is_empty() {
            return PathBuf::from(overridden);
        }
    }
    config_dir.join(FILE_NAME)
}

/// Reads the settings, or hands back the empty ones.
///
/// A missing file is not a fault: it is a PC where nobody has opened the
/// settings window yet. A file that cannot be understood *is* reported, because
/// quietly replacing it with the defaults would throw away a setup somebody
/// made and leave no sign of why printing stopped.
pub fn load(path: &Path) -> Result<Settings, String> {
    let text = match std::fs::read_to_string(path) {
        Ok(text) => text,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(Settings::default()),
        Err(err) => return Err(format!("Cannot read {}: {err}", path.display())),
    };

    serde_json::from_str(&text)
        .map_err(|err| format!("{} is not settings this program understands: {err}", path.display()))
}

/// Writes the settings, creating the folder if this is the first time.
///
/// The write goes to a neighbouring file and is then renamed over the real one.
/// A rename is atomic, so a power cut at the salon -- which is the reason half
/// of this program exists -- leaves either the old settings or the new ones,
/// never half a file that fails to parse on the next start.
pub fn save(path: &Path, settings: &Settings) -> Result<(), String> {
    if let Some(folder) = path.parent() {
        std::fs::create_dir_all(folder)
            .map_err(|err| format!("Cannot create {}: {err}", folder.display()))?;
    }

    let json = serde_json::to_string_pretty(settings)
        .map_err(|err| format!("Cannot write the settings out: {err}"))?;

    let temporary = path.with_extension("json.new");
    std::fs::write(&temporary, json)
        .map_err(|err| format!("Cannot write {}: {err}", temporary.display()))?;
    std::fs::rename(&temporary, path)
        .map_err(|err| format!("Cannot save {}: {err}", path.display()))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn printer() -> Printer {
        Printer::new(
            "p1".into(),
            "Front counter".into(),
            Connection::Network { host: "192.168.1.60".into(), port: 9100 },
        )
    }

    /// A PC nobody has set up prints through the web view, as it always did.
    /// That is the answer, not an error.
    #[test]
    fn nothing_set_up_is_a_working_answer() {
        let settings = Settings::default();
        assert!(settings.printer_for(Job::Slip).is_none());
        assert!(settings.printer_for(Job::Receipt).is_none());
        assert!(settings.tidied().is_ok());
    }

    #[test]
    fn a_missing_file_is_not_a_fault() {
        let missing = PathBuf::from("/nonexistent-folder-for-a-test/printers.json");
        assert_eq!(load(&missing).unwrap(), Settings::default());
    }

    /// Replacing an unreadable file with the defaults would throw away a setup
    /// somebody made and leave nothing on screen to say why printing stopped.
    #[test]
    fn a_file_that_cannot_be_understood_is_reported() {
        let dir = std::env::temp_dir().join("berchi-printers-broken");
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("printers.json");
        std::fs::write(&path, "{ this is not json").unwrap();

        assert!(load(&path).is_err());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn settings_survive_being_written_and_read_back() {
        let dir = std::env::temp_dir().join("berchi-printers-roundtrip");
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("printers.json");

        let settings = Settings {
            version: CURRENT_VERSION,
            printers: vec![printer()],
            jobs: Jobs { slip: Some("p1".into()), receipt: Some("p1".into()) },
        };
        save(&path, &settings).unwrap();
        assert_eq!(load(&path).unwrap(), settings);

        std::fs::remove_dir_all(&dir).ok();
    }

    /// A setting nobody can act on is pulled back to one they can, rather than
    /// refused: a number that snaps back to 20 explains itself.
    #[test]
    fn a_cut_that_would_eat_the_roll_is_pulled_back() {
        let mut settings = Settings::default();
        let mut p = printer();
        p.cut.feed_lines = 200;
        p.copies = 99;
        p.paper.characters_per_line = 2;
        settings.printers.push(p);

        let tidied = settings.tidied().unwrap();
        assert_eq!(tidied.printers[0].cut.feed_lines, MAX_FEED_LINES);
        assert_eq!(tidied.printers[0].copies, MAX_COPIES);
        assert_eq!(tidied.printers[0].paper.characters_per_line, MIN_CHARACTERS_PER_LINE);
    }

    /// A ticket pointed at a deleted printer would stop printing with nothing
    /// on screen to explain it.
    #[test]
    fn a_ticket_cannot_point_at_a_printer_that_is_gone() {
        let settings = Settings {
            version: CURRENT_VERSION,
            printers: vec![],
            jobs: Jobs { slip: Some("deleted".into()), receipt: None },
        };
        let problem = settings.tidied().unwrap_err();
        assert!(problem.contains("number slip"), "{problem}");
    }

    #[test]
    fn a_printer_needs_a_name_and_somewhere_to_send_to() {
        let mut nameless = Settings::default();
        nameless.printers.push(Printer::new("p1".into(), "   ".into(), Connection::Network {
            host: "192.168.1.60".into(),
            port: 9100,
        }));
        assert!(nameless.tidied().is_err());

        let mut nowhere = Settings::default();
        nowhere.printers.push(Printer::new(
            "p1".into(),
            "Front counter".into(),
            Connection::Network { host: "  ".into(), port: 9100 },
        ));
        assert!(nowhere.tidied().is_err());
    }

    #[test]
    fn the_usual_rolls_suggest_the_usual_widths() {
        assert_eq!(Paper::characters_for_width(80), 42);
        assert_eq!(Paper::characters_for_width(58), 32);
    }

    /// Settings written by this version must still be readable when a later one
    /// adds a field, so every added field carries a default.
    #[test]
    fn an_older_file_missing_the_newer_fields_still_loads() {
        let json = r#"{
            "version": 1,
            "printers": [{
                "id": "p1",
                "name": "Front counter",
                "connection": { "kind": "network", "host": "192.168.1.60" }
            }],
            "jobs": { "slip": "p1" }
        }"#;
        let settings: Settings = serde_json::from_str(json).unwrap();
        let printer = &settings.printers[0];

        assert_eq!(printer.connection, Connection::Network {
            host: "192.168.1.60".into(),
            port: 9100,
        });
        assert_eq!(printer.paper, Paper::default());
        assert_eq!(printer.cut, Cut::default());
        assert_eq!(printer.copies, 1);
        assert_eq!(settings.jobs.receipt, None);
    }
}
