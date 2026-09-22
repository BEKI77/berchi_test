//! Getting the bytes to the printer.
//!
//! `escpos` writes ESC/POS through a [`Driver`]; this is where the drivers come
//! from. Three of them are the library's own (network, serial, a device file)
//! and one is written here, because the library has nothing for the case that
//! matters most on a Windows till: a printer **installed in Windows with its own
//! driver**. Those are reached through the print spooler, and the spooler is the
//! right place to reach them -- the queue, the "printer is offline" warning and
//! everything else in *Printers & scanners* keep working, and other programs can
//! still print to the same machine.

use std::sync::Mutex;

use escpos::driver::{Driver, FileDriver, NetworkDriver, SerialPortDriver};
use escpos::errors::{PrinterError, Result as EscResult};

use super::settings::Connection;

/// How long to wait for a printer on the network before giving up. Long enough
/// for a busy printer on the salon's own switch, short enough that the cashier
/// is not left watching a spinner when it is switched off.
const NETWORK_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(5);

/// The name Windows shows in the print queue for one of our tickets. (On Linux
/// the queue is CUPS, which names the job itself.)
#[cfg_attr(not(windows), allow(dead_code))]
const JOB_NAME: &str = "Berchi ticket";

/// Any of the ways a printer can be attached, as one type.
///
/// An enum rather than a boxed trait object so the compiler still sees through
/// to the real driver, and so that adding a way to attach a printer is a change
/// the compiler insists is finished everywhere.
pub enum Transport {
    Spooler(Spooler),
    Network(NetworkDriver),
    Serial(SerialPortDriver),
    Device(FileDriver),
    #[cfg(windows)]
    UsbClass(escpos::driver::WindowsUsbPrintDriver),
}

/// Shown as how the printer is attached, which is the only interesting thing
/// about a driver and the thing worth having in a message about one.
impl std::fmt::Debug for Transport {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.name())
    }
}

impl Driver for Transport {
    fn name(&self) -> String {
        match self {
            Transport::Spooler(driver) => driver.name(),
            Transport::Network(driver) => driver.name(),
            Transport::Serial(driver) => driver.name(),
            Transport::Device(driver) => driver.name(),
            #[cfg(windows)]
            Transport::UsbClass(driver) => driver.name(),
        }
    }

    fn write(&self, data: &[u8]) -> EscResult<()> {
        match self {
            Transport::Spooler(driver) => driver.write(data),
            Transport::Network(driver) => driver.write(data),
            Transport::Serial(driver) => driver.write(data),
            Transport::Device(driver) => driver.write(data),
            #[cfg(windows)]
            Transport::UsbClass(driver) => driver.write(data),
        }
    }

    fn read(&self, buffer: &mut [u8]) -> EscResult<usize> {
        match self {
            Transport::Spooler(driver) => driver.read(buffer),
            Transport::Network(driver) => driver.read(buffer),
            Transport::Serial(driver) => driver.read(buffer),
            Transport::Device(driver) => driver.read(buffer),
            #[cfg(windows)]
            Transport::UsbClass(driver) => driver.read(buffer),
        }
    }

    fn flush(&self) -> EscResult<()> {
        match self {
            Transport::Spooler(driver) => driver.flush(),
            Transport::Network(driver) => driver.flush(),
            Transport::Serial(driver) => driver.flush(),
            Transport::Device(driver) => driver.flush(),
            #[cfg(windows)]
            Transport::UsbClass(driver) => driver.flush(),
        }
    }
}

/// Opens the printer described by a connection.
///
/// This is where "the printer is off" is found out, so the message has to say
/// which printer and what was tried -- it is read by whoever is standing at the
/// till, not by a developer.
pub fn open(connection: &Connection) -> Result<Transport, String> {
    match connection {
        Connection::SystemPrinter { name } => Ok(Transport::Spooler(Spooler::new(name.clone()))),

        Connection::Network { host, port } => NetworkDriver::open(host, *port, Some(NETWORK_TIMEOUT))
            .map(Transport::Network)
            .map_err(|err| {
                format!("No answer from the printer at {host} on port {port}: {err}")
            }),

        Connection::Serial { path, baud_rate } => {
            SerialPortDriver::open(path, *baud_rate, Some(NETWORK_TIMEOUT))
                .map(Transport::Serial)
                .map_err(|err| format!("Cannot open {path} at {baud_rate} baud: {err}"))
        }

        Connection::Device { path } => FileDriver::open(std::path::Path::new(path))
            .map(Transport::Device)
            .map_err(|err| format!("Cannot write to {path}: {err}")),

        #[cfg(windows)]
        Connection::UsbClass { device_path } => {
            escpos::driver::WindowsUsbPrintDriver::open(device_path)
                .map(Transport::UsbClass)
                .map_err(|err| {
                    format!(
                        "Cannot open the USB printer. Is it switched on, and is another program \
                         holding it open? ({err})"
                    )
                })
        }

        #[cfg(not(windows))]
        Connection::UsbClass { .. } => Err(
            "USB printers are reached through a Windows driver, and this is not Windows. \
             Use the device path instead."
                .into(),
        ),
    }
}

// ---------------------------------------------------------------------------
// The print spooler
// ---------------------------------------------------------------------------

/// A printer installed in the operating system, reached through its print queue.
///
/// The bytes are collected as the ticket is built and sent as a single job when
/// `escpos` flushes. That is deliberate: one job per ticket is one line in the
/// print queue, one thing to cancel when a receipt goes wrong, and no chance of
/// a half-written ticket being spooled if the ticket cannot be finished.
///
/// The job is sent as **RAW**, which tells the spooler to hand the bytes to the
/// printer untouched instead of rendering them as a page. Without that, the
/// driver would treat ESC/POS as text to be typeset and print it as gibberish.
pub struct Spooler {
    printer: String,
    pending: Mutex<Vec<u8>>,
}

impl Spooler {
    pub fn new(printer: String) -> Self {
        Self { printer, pending: Mutex::new(Vec::new()) }
    }
}

impl Driver for Spooler {
    fn name(&self) -> String {
        format!("print queue \"{}\"", self.printer)
    }

    fn write(&self, data: &[u8]) -> EscResult<()> {
        self.pending.lock()?.extend_from_slice(data);
        Ok(())
    }

    /// Nothing comes back from a print queue. A spooled job is accepted or
    /// refused; the printer's own answers do not travel back up it, which is why
    /// the real-time status commands are not offered for this kind of printer.
    fn read(&self, _buffer: &mut [u8]) -> EscResult<usize> {
        Ok(0)
    }

    fn flush(&self) -> EscResult<()> {
        let ticket = std::mem::take(&mut *self.pending.lock()?);
        if ticket.is_empty() {
            return Ok(());
        }
        send_to_queue(&self.printer, &ticket).map_err(PrinterError::Io)
    }
}

/// Hands one finished ticket to the operating system's print queue.
#[cfg(windows)]
fn send_to_queue(printer: &str, ticket: &[u8]) -> Result<(), String> {
    use std::ptr;
    use windows_sys::Win32::Graphics::Printing::{
        ClosePrinter, OpenPrinterW, DOC_INFO_1W, PRINTER_HANDLE,
    };

    let name = wide(printer);
    let mut handle = PRINTER_HANDLE { Value: ptr::null_mut() };

    // SAFETY: `name` is a null-terminated wide string that outlives the call,
    // and `handle` is a valid place to put the result.
    if unsafe { OpenPrinterW(name.as_ptr(), &mut handle, ptr::null()) } == 0 {
        return Err(format!(
            "Windows will not open the printer \"{printer}\" ({}). \
             Check it is still listed under Printers & scanners.",
            std::io::Error::last_os_error()
        ));
    }

    let mut job_name = wide(JOB_NAME);
    let mut datatype = wide("RAW");
    let document = DOC_INFO_1W {
        pDocName: job_name.as_mut_ptr(),
        pOutputFile: ptr::null_mut(),
        pDatatype: datatype.as_mut_ptr(),
    };

    // SAFETY: the handle came from OpenPrinterW above and is closed below on
    // every path, including the error ones.
    let outcome = unsafe { write_job(handle, &document, ticket) };

    // SAFETY: closing a handle OpenPrinterW gave us, exactly once.
    unsafe { ClosePrinter(handle) };

    outcome.map_err(|problem| format!("Windows would not print to \"{printer}\": {problem}"))
}

/// The spooler conversation itself: start a document, write it, end it.
///
/// Split out so that [`send_to_queue`] can close the printer handle on every
/// path without repeating itself.
#[cfg(windows)]
unsafe fn write_job(
    handle: windows_sys::Win32::Graphics::Printing::PRINTER_HANDLE,
    document: &windows_sys::Win32::Graphics::Printing::DOC_INFO_1W,
    ticket: &[u8],
) -> Result<(), String> {
    use windows_sys::Win32::Graphics::Printing::{
        EndDocPrinter, EndPagePrinter, StartDocPrinterW, StartPagePrinter, WritePrinter,
    };

    if unsafe { StartDocPrinterW(handle, 1, document) } == 0 {
        return Err(format!("the job was refused ({})", std::io::Error::last_os_error()));
    }

    let result = (|| {
        if unsafe { StartPagePrinter(handle) } == 0 {
            return Err(format!("the page was refused ({})", std::io::Error::last_os_error()));
        }

        // WritePrinter may take fewer bytes than it was offered, so keep going
        // until the whole ticket is in. A short write that went unnoticed would
        // cut a receipt off half way down with nothing to say why.
        let mut sent = 0usize;
        while sent < ticket.len() {
            let remaining = &ticket[sent..];
            let length = u32::try_from(remaining.len()).unwrap_or(u32::MAX);
            let mut written = 0u32;

            if unsafe {
                WritePrinter(
                    handle,
                    remaining.as_ptr() as *const core::ffi::c_void,
                    length,
                    &mut written,
                )
            } == 0
            {
                return Err(format!(
                    "only {sent} of {} bytes were accepted ({})",
                    ticket.len(),
                    std::io::Error::last_os_error()
                ));
            }

            if written == 0 {
                return Err(format!("the printer stopped accepting data after {sent} bytes"));
            }
            sent += written as usize;
        }

        if unsafe { EndPagePrinter(handle) } == 0 {
            return Err(format!("the page would not close ({})", std::io::Error::last_os_error()));
        }
        Ok(())
    })();

    // The document has to be ended whether or not the writing worked, or the
    // job is left half open in the queue and the printer waits for more.
    if unsafe { EndDocPrinter(handle) } == 0 && result.is_ok() {
        return Err(format!("the job would not close ({})", std::io::Error::last_os_error()));
    }

    result
}

/// Hands one finished ticket to CUPS.
///
/// The salon runs on Windows; this exists so the whole printing path can be
/// built and tried on the machine it is developed on, rather than only being
/// discovered to be wrong once it is on a till.
#[cfg(not(windows))]
fn send_to_queue(printer: &str, ticket: &[u8]) -> Result<(), String> {
    use std::io::Write;
    use std::process::{Command, Stdio};

    let mut child = Command::new("lp")
        .args(["-d", printer, "-o", "raw"])
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|err| format!("Cannot run lp to print to \"{printer}\": {err}"))?;

    child
        .stdin
        .take()
        .ok_or_else(|| "lp would not take the ticket".to_string())?
        .write_all(ticket)
        .map_err(|err| format!("Cannot send the ticket to \"{printer}\": {err}"))?;

    let finished = child
        .wait_with_output()
        .map_err(|err| format!("lp did not finish: {err}"))?;

    if finished.status.success() {
        Ok(())
    } else {
        Err(format!(
            "lp refused the ticket: {}",
            String::from_utf8_lossy(&finished.stderr).trim()
        ))
    }
}

/// A Rust string as Windows wants it: UTF-16, null terminated.
#[cfg(windows)]
pub(super) fn wide(text: &str) -> Vec<u16> {
    use std::os::windows::ffi::OsStrExt;
    std::ffi::OsStr::new(text).encode_wide().chain(std::iter::once(0)).collect()
}

/// A null-terminated wide string from Windows, as a Rust string.
///
/// # Safety
///
/// `pointer` must be null, or point at a null-terminated UTF-16 string that
/// stays put for the length of the call.
#[cfg(windows)]
pub(super) unsafe fn from_wide(pointer: *const u16) -> String {
    if pointer.is_null() {
        return String::new();
    }
    let mut length = 0usize;
    // SAFETY: the caller promises a null terminator, so this stops.
    while unsafe { *pointer.add(length) } != 0 {
        length += 1;
    }
    // SAFETY: `length` characters were just walked, so the range is readable.
    String::from_utf16_lossy(unsafe { std::slice::from_raw_parts(pointer, length) })
}

// ---------------------------------------------------------------------------
// For the tests
// ---------------------------------------------------------------------------

/// A printer that keeps what it was sent instead of printing it.
///
/// Lets the tests check the actual ESC/POS bytes -- that a ticket starts by
/// initialising, that a cut is only sent to a printer with a cutter, that two
/// copies really are two tickets -- without a printer, and on any platform.
#[cfg(test)]
pub struct Recorder {
    written: std::sync::Arc<Mutex<Vec<u8>>>,
}

#[cfg(test)]
impl Default for Recorder {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
impl Recorder {
    pub fn new() -> Self {
        Self { written: std::sync::Arc::new(Mutex::new(Vec::new())) }
    }

    /// A handle on what gets written, to be taken before the recorder is handed
    /// to the printer.
    pub fn written(&self) -> std::sync::Arc<Mutex<Vec<u8>>> {
        std::sync::Arc::clone(&self.written)
    }
}

#[cfg(test)]
impl Driver for Recorder {
    fn name(&self) -> String {
        "recorder".into()
    }

    fn write(&self, data: &[u8]) -> EscResult<()> {
        self.written.lock()?.extend_from_slice(data);
        Ok(())
    }

    fn read(&self, _buffer: &mut [u8]) -> EscResult<usize> {
        Ok(0)
    }

    fn flush(&self) -> EscResult<()> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A queue driver holds the ticket until the end, so that one ticket is one
    /// job: one line in the print queue, one thing to cancel.
    #[test]
    fn the_queue_driver_keeps_the_ticket_until_it_is_finished() {
        let spooler = Spooler::new("Nothing At All".into());
        spooler.write(b"ESC/POS").unwrap();
        spooler.write(b" more").unwrap();

        assert_eq!(&*spooler.pending.lock().unwrap(), b"ESC/POS more");
    }

    /// Flushing an empty ticket must not start a job, or every start-up would
    /// put a blank page in the queue.
    #[test]
    fn an_empty_ticket_is_not_sent_anywhere() {
        let spooler = Spooler::new("Nothing At All".into());
        assert!(spooler.flush().is_ok());
    }

    #[test]
    fn a_missing_device_is_reported_rather_than_panicking() {
        let problem = open(&Connection::Device { path: "/nonexistent/berchi/lp0".into() })
            .expect_err("opening a device that is not there should fail");
        assert!(problem.contains("/nonexistent/berchi/lp0"), "{problem}");
    }

    /// The message is read by whoever is standing at the till, so it has to name
    /// the printer and say what was tried.
    #[test]
    fn a_printer_that_does_not_answer_names_itself() {
        // 192.0.2.0/24 is reserved for documentation and routes nowhere.
        let problem = open(&Connection::Network { host: "192.0.2.1".into(), port: 9100 })
            .expect_err("a printer that is not there should not open");
        assert!(problem.contains("192.0.2.1"), "{problem}");
        assert!(problem.contains("9100"), "{problem}");
    }

    #[cfg(not(windows))]
    #[test]
    fn usb_printers_say_why_they_are_not_available_here() {
        let problem = open(&Connection::UsbClass { device_path: "whatever".into() })
            .expect_err("USB is a Windows path only");
        assert!(problem.contains("Windows"), "{problem}");
    }
}
