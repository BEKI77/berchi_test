//! Talking to CUPS, the print system on Linux and macOS.
//!
//! The Windows half of printing reaches the spooler through its own API
//! ([`super::transport`]). There is no equivalent worth linking against here, so
//! this drives the `lp` and `lpstat` that every CUPS installation ships. That is
//! not a shortcut: they are the documented interface, they are what every other
//! program on the PC prints through, and using them means the salon's tickets
//! land in the same queue, with the same controls, as everything else.
//!
//! Three things are easy to get wrong, and are each handled once here rather
//! than at every call site:
//!
//! - **CUPS translates itself.** `lpstat` says *deaktiviert* on a German
//!   desktop, and the words that have to be read back -- `disabled`,
//!   `accepting` -- are among the translated ones. Every command is therefore
//!   run in the C locale, so the parsing holds on a salon PC set up in Amharic.
//! - **`lp` taking a ticket is not a printer printing it.** CUPS stops a queue
//!   when a job fails, and a stopped queue goes on accepting jobs without a
//!   word. A till whose printer jammed once would report every sale printed
//!   while nothing came out of the roll. [`refuse_if_stopped`] is what stands in
//!   the way of that, and it is the difference between a cashier who knows and
//!   one who finds out at closing time.
//! - **The ticket must go through untouched.** Without `-o raw`, CUPS decides
//!   for itself what the bytes are, calls them `text/plain`, and runs them
//!   through `texttotext` -- which paginates ESC/POS into pages of gibberish.

use std::process::Command;

/// What `lp` calls the job, which is what shows in the print queue. Without it
/// CUPS names every ticket after where it came from, and a queue full of jobs
/// called `(stdin)` tells whoever is looking at it nothing.
const JOB_NAME: &str = "Berchi ticket";

/// Why a CUPS program did not answer.
///
/// Worth telling apart: CUPS missing altogether is a thing to say plainly to
/// whoever is setting the PC up, while CUPS answering with a complaint is
/// usually about one queue and is better reported in its own words.
#[derive(Debug)]
pub enum NotRun {
    /// The program is not installed on this computer.
    Missing,
    /// It ran, and said no.
    Failed(String),
}

/// What to say when the PC has no CUPS at all. Named because both the settings
/// window and a failed print end up wanting it.
pub const NO_CUPS: &str =
    "This computer has no print system installed, so it has no print queues. \
     Install CUPS (on Fedora: sudo dnf install cups cups-client, then \
     sudo systemctl enable --now cups), or set the printer up by its network \
     address or device path instead.";

/// Runs a CUPS program and hands back what it said, in English.
pub fn run(program: &str, args: &[&str]) -> Result<String, NotRun> {
    let output = Command::new(program)
        .args(args)
        // The whole reason the output can be parsed at all. See the note at the
        // top of this file.
        .env("LC_ALL", "C")
        .env("LANG", "C")
        .output()
        .map_err(|err| match err.kind() {
            std::io::ErrorKind::NotFound => NotRun::Missing,
            _ => NotRun::Failed(format!("cannot run {program}: {err}")),
        })?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(NotRun::Failed(String::from_utf8_lossy(&output.stderr).trim().to_string()))
    }
}

// ---------------------------------------------------------------------------
// What queues this PC has
// ---------------------------------------------------------------------------

/// The print queues on this computer, by name.
pub fn queues() -> Result<Vec<String>, NotRun> {
    Ok(names_in(&run("lpstat", &["-a"])?))
}

/// Whichever queue CUPS treats as the default, if one is set.
pub fn default_queue() -> Option<String> {
    run("lpstat", &["-d"]).ok().as_deref().and_then(default_in)
}

/// The queues CUPS has stopped, by name.
///
/// Offered alongside the list in the settings window, because choosing a
/// stopped queue and then wondering why the test print vanished is the most
/// likely way to waste an afternoon here.
pub fn stopped_queues() -> Vec<String> {
    match run("lpstat", &["-p"]) {
        Ok(listing) => disabled_in(&listing),
        Err(_) => Vec::new(),
    }
}

/// Refuses to send a ticket to a queue CUPS has stopped.
///
/// The one check that turns "the app said it printed and nothing came out" into
/// a sentence naming the queue and the command that fixes it.
pub fn refuse_if_stopped(printer: &str) -> Result<(), String> {
    // Asked about the one queue being printed to rather than all of them: it is
    // the only one that matters, and a PC with a dozen queues should not pay for
    // the others on every sale.
    let Ok(listing) = run("lpstat", &["-p", printer]) else {
        // No lpstat, or it would not answer about this queue. Not a reason to
        // refuse the ticket: `lp` is about to say so, far more precisely.
        return Ok(());
    };

    match stopped_reason(&listing) {
        None => Ok(()),
        Some(why) => Err(stopped_message(printer, why.as_deref())),
    }
}

/// What the cashier reads when the queue is stopped.
///
/// Kept in one place, and deliberately ending in the command that fixes it: the
/// person standing at the till has to know what to do next, and "the queue is
/// stopped" on its own does not tell them.
fn stopped_message(printer: &str, why: Option<&str>) -> String {
    let because = match why {
        Some(why) => format!("because a job failed ({why})"),
        // Stopped by hand, or stopped with nothing recorded. Still stopped.
        None => "when a job failed".to_string(),
    };

    format!(
        "The print queue \"{printer}\" is stopped, so nothing sent to it will print. \
         CUPS stopped it {because}, and it stays stopped until it is started again. \
         Fix the printer, then run:  cupsenable {printer}"
    )
}

// ---------------------------------------------------------------------------
// Sending a ticket
// ---------------------------------------------------------------------------

/// Hands one finished ticket to a CUPS queue.
pub fn send(printer: &str, ticket: &[u8]) -> Result<(), String> {
    use std::io::Write;
    use std::process::Stdio;

    // Before anything is spooled: a stopped queue takes the job and prints
    // nothing, and the cashier deserves to hear that now rather than never.
    refuse_if_stopped(printer)?;

    let mut child = Command::new("lp")
        // -o raw hands the bytes to the printer untouched. Without it the
        // ticket is auto-typed as text/plain and filtered into pages of
        // gibberish, which is the single most confusing way this can fail.
        // -t names the job in the queue; without it every ticket is "(stdin)".
        .args(["-d", printer, "-t", JOB_NAME, "-o", "raw"])
        .env("LC_ALL", "C")
        .env("LANG", "C")
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|err| match err.kind() {
            std::io::ErrorKind::NotFound => NO_CUPS.to_string(),
            _ => format!("Cannot run lp to print to \"{printer}\": {err}"),
        })?;

    child
        .stdin
        .take()
        .ok_or_else(|| "lp would not take the ticket".to_string())?
        .write_all(ticket)
        .map_err(|err| format!("Cannot send the ticket to \"{printer}\": {err}"))?;

    let finished = child.wait_with_output().map_err(|err| format!("lp did not finish: {err}"))?;

    if finished.status.success() {
        Ok(())
    } else {
        Err(format!(
            "The print queue \"{printer}\" refused the ticket: {}",
            String::from_utf8_lossy(&finished.stderr).trim()
        ))
    }
}

// ---------------------------------------------------------------------------
// Reading what CUPS said
// ---------------------------------------------------------------------------
//
// Split out from the commands above so they can be tried against real `lpstat`
// output without a print system, a printer, or a particular PC.

/// The queue names out of `lpstat -a`.
///
/// Each line is `<name> accepting requests since <date>`, or `<name> not
/// accepting requests since <date>`. Both are queues, and both are worth
/// offering: one that is not accepting is still the printer the salon means.
fn names_in(listing: &str) -> Vec<String> {
    listing
        .lines()
        .filter_map(|line| line.split_whitespace().next())
        .filter(|name| !name.is_empty())
        .map(str::to_string)
        .collect()
}

/// The default queue out of `lpstat -d`.
///
/// Either `system default destination: <name>` or `no system default
/// destination`, which has no colon and so falls out by itself.
fn default_in(line: &str) -> Option<String> {
    line.split(':').nth(1).map(|name| name.trim().to_string()).filter(|name| !name.is_empty())
}

/// The stopped queues out of `lpstat -p`.
fn disabled_in(listing: &str) -> Vec<String> {
    listing
        .lines()
        .filter_map(|line| {
            let rest = line.strip_prefix("printer ")?;
            if rest.contains(" disabled since ") {
                rest.split_whitespace().next().map(str::to_string)
            } else {
                None
            }
        })
        .collect()
}

/// Whether `lpstat -p <name>` describes a stopped queue, and why it stopped.
///
/// `Some(None)` is a queue that is stopped with nothing said about it, which
/// happens when it was stopped by hand. That is still worth refusing over, so
/// it has to be told apart from a queue that is running.
fn stopped_reason(listing: &str) -> Option<Option<String>> {
    let mut lines = listing.lines();
    let state = lines.find(|line| line.contains(" disabled since "))?;

    // The reason sits after the last " - " on the state line, or on the
    // indented line under it. Either can be there, and either can be blank.
    let trailing = state.rsplit_once(" - ").map(|(_, why)| why.trim()).unwrap_or_default();
    if !trailing.is_empty() {
        return Some(Some(trailing.to_string()));
    }

    let continuation = lines.next().map(str::trim).unwrap_or_default();
    if continuation.is_empty() {
        Some(None)
    } else {
        Some(Some(continuation.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Both of these are copied verbatim from a Fedora 43 till running CUPS
    // 2.4.19, asked in the C locale -- which is how `run` asks. Made up output
    // would prove only that the parser agrees with whoever wrote the fixture.

    /// `lpstat -a`: three queues.
    const ACCEPTING: &str = "\
CUPS-BRF-Printer accepting requests since Wed Sep 23 00:35:57 2026
POS-80 accepting requests since Wed Sep 23 00:36:01 2026
Receipt-Printer accepting requests since Wed Sep 23 01:34:05 2026
";

    /// `lpstat -p` from the same till, after a job failed on the USB receipt
    /// printer and CUPS stopped its queue.
    ///
    /// Note the indented lines: a queue can carry a note whether or not it is
    /// stopped, so POS-80 has one here. Anything reading this has to skip them,
    /// or a note would be read back as a queue called "Waiting".
    const PRINTERS: &str = "\
printer CUPS-BRF-Printer is idle.  enabled since Wed Sep 23 00:35:57 2026
printer POS-80 now printing POS-80-524.  enabled since Wed Sep 23 00:36:01 2026
\tWaiting for printer to become available.
printer Receipt-Printer disabled since Wed Sep 23 01:34:05 2026 -
\tUnable to send data to printer.
";

    #[test]
    fn every_queue_is_offered_whether_or_not_it_is_accepting() {
        assert_eq!(names_in(ACCEPTING), ["CUPS-BRF-Printer", "POS-80", "Receipt-Printer"]);

        let paused = "Receipt-Printer not accepting requests since Wed 23 Sep 2026\n";
        assert_eq!(names_in(paused), ["Receipt-Printer"]);
    }

    #[test]
    fn a_pc_with_no_queues_offers_none_rather_than_a_blank_one() {
        assert!(names_in("").is_empty());
        assert!(names_in("\n\n").is_empty());
    }

    #[test]
    fn the_default_queue_is_read_out_of_lpstat() {
        assert_eq!(
            default_in("system default destination: Receipt-Printer\n").as_deref(),
            Some("Receipt-Printer")
        );
    }

    /// A PC with no default set says so in a sentence with no colon in it, and
    /// must not come back as a queue called "no system default destination".
    #[test]
    fn no_default_set_is_not_mistaken_for_a_queue() {
        assert_eq!(default_in("no system default destination\n"), None);
    }

    #[test]
    fn a_stopped_queue_is_picked_out_of_the_listing() {
        assert_eq!(disabled_in(PRINTERS), ["Receipt-Printer"]);
    }

    /// The reason CUPS stopped the queue is the most useful sentence available,
    /// and it is on the line underneath.
    #[test]
    fn the_reason_a_queue_stopped_is_carried_through() {
        assert_eq!(
            stopped_reason(PRINTERS),
            Some(Some("Unable to send data to printer.".to_string()))
        );
    }

    /// Stopped by hand: no reason anywhere, and still stopped.
    #[test]
    fn a_queue_stopped_with_nothing_said_still_counts_as_stopped() {
        let listing = "printer POS-80 disabled since Wed 23 Sep 2026 12:36:01 AM EAT -\n";
        assert_eq!(stopped_reason(listing), Some(None));
    }

    #[test]
    fn a_running_queue_is_not_reported_as_stopped() {
        let listing = "printer POS-80 is idle.  enabled since Wed 23 Sep 2026 12:36:01 AM EAT\n";
        assert_eq!(stopped_reason(listing), None);
        assert!(disabled_in(listing).is_empty());
    }

    /// The whole point of the check: the message has to name the queue and the
    /// command that starts it again, because that is what the person standing
    /// at the till needs to do next.
    #[test]
    fn refusing_a_stopped_queue_says_how_to_start_it_again() {
        let Some(why) = stopped_reason(PRINTERS) else { panic!("should be stopped") };
        let message = stopped_message("Receipt-Printer", why.as_deref());

        assert!(message.contains("Receipt-Printer"), "{message}");
        assert!(message.contains("cupsenable Receipt-Printer"), "{message}");
        assert!(message.contains("Unable to send data to printer."), "{message}");
    }

    /// A queue stopped by hand still has to name the command, even with no
    /// reason to quote.
    #[test]
    fn a_queue_stopped_by_hand_still_says_how_to_start_it() {
        let message = stopped_message("POS-80", None);
        assert!(message.contains("cupsenable POS-80"), "{message}");
    }

    /// Nothing here may assume the PC is in English. If this ever reads a
    /// translated word, a salon running its till in another language loses
    /// printing with no explanation.
    #[test]
    fn the_commands_ask_for_english() {
        let listing = run("sh", &["-c", "printf '%s' \"$LC_ALL\""]);
        assert!(matches!(listing.as_deref(), Ok("C")), "{listing:?}");
    }

    /// A program that is not installed has to be told apart from one that ran
    /// and complained, because only the first is worth telling the salon to
    /// install something over.
    #[test]
    fn a_missing_program_is_reported_as_missing() {
        assert!(matches!(run("berchi-no-such-program", &[]), Err(NotRun::Missing)));
    }
}
