//! What printers this PC can see.
//!
//! The settings window asks for this and offers what comes back, so that setting
//! a till up is picking from a list rather than knowing a queue name or a device
//! path by heart. Nothing here opens a printer or prints anything: it only
//! reports what is attached.
//!
//! **Looking is allowed to go wrong in parts.** A PC with no serial ports, or
//! with a spooler that will not answer, should still offer its USB printers.
//! Anything that fails is reported alongside what was found rather than
//! replacing it -- see [`Found::problems`].

use serde::Serialize;

use super::settings::Connection;

/// One printer this PC can see, ready to be added.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Candidate {
    /// What to show in the list.
    pub label: String,
    /// The quieter second line: a port, a device path, an id.
    pub detail: Option<String>,
    /// How to reach it, ready to be saved as it stands.
    pub connection: Connection,
    /// Whether the operating system treats this as its default printer. The
    /// settings window leads with it, because on a till already set up the old
    /// way it is almost certainly the receipt printer.
    pub is_default: bool,
}

/// Everything the search turned up, and everything that went wrong doing it.
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Found {
    pub printers: Vec<Candidate>,
    /// In words, for showing under the list. Not fatal: the list is still good.
    pub problems: Vec<String>,
}

/// Looks for printers, everywhere this PC might have one.
pub fn look() -> Found {
    let mut found = Found::default();

    match installed_printers() {
        Ok(printers) => found.printers.extend(printers),
        Err(problem) => found.problems.push(problem),
    }

    match usb_printers() {
        Ok(printers) => found.printers.extend(printers),
        Err(problem) => found.problems.push(problem),
    }

    match serial_ports() {
        Ok(ports) => found.printers.extend(ports),
        Err(problem) => found.problems.push(problem),
    }

    // The default printer first: on a till set up the old way it is almost
    // certainly the receipt printer, so it is the one being looked for.
    found.printers.sort_by_key(|candidate| !candidate.is_default);
    found
}

// ---------------------------------------------------------------------------
// Printers installed in the operating system
// ---------------------------------------------------------------------------

/// Printers Windows has installed, from the spooler itself.
#[cfg(windows)]
fn installed_printers() -> Result<Vec<Candidate>, String> {
    use std::ptr;
    use windows_sys::Win32::Graphics::Printing::{
        EnumPrintersW, PRINTER_ENUM_CONNECTIONS, PRINTER_ENUM_LOCAL, PRINTER_INFO_4W,
    };

    use super::transport::from_wide;

    // Printers attached to this PC, and ones it has been connected to over the
    // network. Between them that is everything in "Printers & scanners".
    let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;
    // Level 4 is the fast one: it reads the names out of the registry without
    // waking each printer up, which matters when one of them is switched off.
    const LEVEL: u32 = 4;

    let mut needed = 0u32;
    let mut count = 0u32;

    // Asked with no buffer, Windows reports how big one has to be. It "fails"
    // with ERROR_INSUFFICIENT_BUFFER while doing so, which is not a failure.
    // SAFETY: a null buffer of length zero is exactly how this call is asked
    // for a size.
    unsafe { EnumPrintersW(flags, ptr::null(), LEVEL, ptr::null_mut(), 0, &mut needed, &mut count) };

    if needed == 0 {
        return Ok(Vec::new()); // no printers installed at all
    }

    // Held as u64 so the buffer is aligned well enough for the structs Windows
    // writes into it; a Vec<u8> is only guaranteed to be byte aligned.
    let mut buffer = vec![0u64; (needed as usize).div_ceil(8)];
    let bytes = buffer.as_mut_ptr() as *mut u8;

    // SAFETY: `bytes` points at `needed` writable bytes, which is what the
    // previous call asked for.
    if unsafe {
        EnumPrintersW(flags, ptr::null(), LEVEL, bytes, needed, &mut needed, &mut count)
    } == 0
    {
        return Err(format!(
            "Windows would not list the printers ({}).",
            std::io::Error::last_os_error()
        ));
    }

    let default = default_printer();
    let mut printers = Vec::with_capacity(count as usize);

    for index in 0..count as usize {
        // SAFETY: Windows wrote `count` PRINTER_INFO_4W into the buffer.
        let info = unsafe { &*(bytes as *const PRINTER_INFO_4W).add(index) };
        // SAFETY: the spooler's strings are null terminated and live in the
        // buffer above, which outlives this loop.
        let name = unsafe { from_wide(info.pPrinterName) };
        if name.is_empty() {
            continue;
        }

        printers.push(Candidate {
            is_default: default.as_deref() == Some(name.as_str()),
            detail: Some("Installed in Windows".into()),
            connection: Connection::SystemPrinter { name: name.clone() },
            label: name,
        });
    }

    Ok(printers)
}

/// Whichever printer Windows treats as the default, if any.
#[cfg(windows)]
fn default_printer() -> Option<String> {
    use windows_sys::Win32::Graphics::Printing::GetDefaultPrinterW;

    let mut length = 0u32;
    // SAFETY: as with EnumPrintersW, a null buffer asks for the size.
    unsafe { GetDefaultPrinterW(std::ptr::null_mut(), &mut length) };
    if length == 0 {
        return None;
    }

    let mut buffer = vec![0u16; length as usize];
    // SAFETY: the buffer holds `length` u16, which is what was asked for.
    if unsafe { GetDefaultPrinterW(buffer.as_mut_ptr(), &mut length) } == 0 {
        return None;
    }

    // SAFETY: Windows null-terminates what it wrote.
    let name = unsafe { super::transport::from_wide(buffer.as_ptr()) };
    if name.is_empty() {
        None
    } else {
        Some(name)
    }
}

/// Print queues CUPS knows about, on Linux and macOS.
///
/// The same idea as the Windows spooler above, and offered the same way: these
/// are the printers already set up on this computer, so picking one is picking
/// something that is known to work rather than typing a path from memory.
///
/// A queue CUPS has **stopped** is still offered, and said to be stopped. It is
/// very often the right printer -- a stopped queue is usually a working printer
/// that had one bad job -- and leaving it out of the list would look like the
/// printer had disappeared.
#[cfg(not(windows))]
fn installed_printers() -> Result<Vec<Candidate>, String> {
    use super::cups;

    let listed = match cups::queues() {
        Ok(names) => names,
        // Worth saying plainly rather than showing an empty list: a PC with no
        // print system is a thing somebody has to go and fix, and an empty list
        // looks like the printer is at fault.
        Err(cups::NotRun::Missing) => return Err(cups::NO_CUPS.into()),
        Err(cups::NotRun::Failed(why)) => {
            return Err(format!("The print system would not list its queues: {why}"))
        }
    };

    let default = cups::default_queue();
    let stopped = cups::stopped_queues();

    Ok(listed
        .into_iter()
        .map(|name| Candidate {
            is_default: default.as_deref() == Some(name.as_str()),
            detail: Some(if stopped.contains(&name) {
                "A print queue on this computer - stopped, needs cupsenable".to_string()
            } else {
                "A print queue on this computer".to_string()
            }),
            connection: Connection::SystemPrinter { name: name.clone() },
            label: name,
        })
        .collect())
}

// ---------------------------------------------------------------------------
// USB printers with no driver of their own
// ---------------------------------------------------------------------------

/// USB printers Windows picked up with its own class driver.
///
/// These are the ones that appear when a receipt printer is plugged in and
/// nobody installed the disc that came with it. They have no queue and no entry
/// worth having in *Printers & scanners*, so the spooler cannot reach them --
/// but they are perfectly good ESC/POS printers, and this finds them.
#[cfg(windows)]
fn usb_printers() -> Result<Vec<Candidate>, String> {
    let found = escpos::driver::WindowsUsbPrintDriver::list()
        .map_err(|err| format!("Cannot look for USB printers: {err}"))?;

    Ok(found
        .into_iter()
        .map(|printer| {
            let identity = match (printer.vendor_id, printer.product_id) {
                (Some(vendor), Some(product)) => {
                    format!("USB {vendor:04x}:{product:04x}")
                }
                _ => "USB printer".to_string(),
            };
            Candidate {
                label: identity.clone(),
                detail: Some(printer.device_path.clone()),
                connection: Connection::UsbClass { device_path: printer.device_path },
                is_default: false,
            }
        })
        .collect())
}

/// USB printers Linux picked up with its own kernel driver.
///
/// Exactly the Windows case above, arriving by a different road. `usblp` gives a
/// receipt printer a node under `/dev/usb/` the moment it is plugged in, with no
/// queue and no driver to install; `/dev/lp*` is the same for one on a parallel
/// port. Written to as a file, both are perfectly good ESC/POS printers.
///
/// Offering these matters more on Linux than the equivalent does on Windows.
/// A till whose printer has no CUPS queue -- because the vendor ships a Windows
/// driver and nothing else, which is most of them -- would otherwise find
/// *nothing* under **Add**, and have no way to know that typing `/dev/usb/lp0`
/// into a device path would have worked.
#[cfg(target_os = "linux")]
fn usb_printers() -> Result<Vec<Candidate>, String> {
    let mut found = Vec::new();

    // usblp, the driver a USB receipt printer gets with nothing installed.
    found.extend(nodes_in("/dev/usb", "lp", "Plugged in by USB"));
    // The parallel port, for an older till. Same driver interface.
    found.extend(nodes_in("/dev", "lp", "On a parallel port"));

    Ok(found)
}

/// Printer device nodes in one directory, as candidates.
///
/// A directory that is not there is not a fault: `/dev/usb` only exists once
/// something has been plugged in, which is the ordinary state of a PC with no
/// printer attached.
#[cfg(target_os = "linux")]
fn nodes_in(directory: &str, prefix: &str, how: &str) -> Vec<Candidate> {
    let Ok(entries) = std::fs::read_dir(directory) else {
        return Vec::new();
    };

    let mut found: Vec<Candidate> = entries
        .flatten()
        .filter_map(|entry| {
            let name = entry.file_name().into_string().ok()?;
            if !is_printer_node(&name, prefix) {
                return None;
            }

            let path = entry.path().to_string_lossy().to_string();
            let detail = match refused(&entry.path()) {
                None => how.to_string(),
                Some(why) => format!("{how} - {why}"),
            };

            Some(Candidate {
                label: path.clone(),
                detail: Some(detail),
                connection: Connection::Device { path },
                is_default: false,
            })
        })
        .collect();

    // read_dir hands them over in whatever order the filesystem likes, and a
    // list that reorders itself between two looks is unsettling to use.
    found.sort_by(|left, right| left.label.cmp(&right.label));
    found
}

/// Whether a name in `/dev` is a printer node: the prefix, then a number.
///
/// `lp0`, `lp1`, and not `lp` on its own or `lptest`. Matching on the prefix
/// alone would sweep up whatever else a distribution happens to keep there and
/// offer it to the salon as a printer.
#[cfg(target_os = "linux")]
fn is_printer_node(name: &str, prefix: &str) -> bool {
    match name.strip_prefix(prefix) {
        Some(number) => !number.is_empty() && number.bytes().all(|byte| byte.is_ascii_digit()),
        None => false,
    }
}

/// Why this program could not write to a device node, if it could not.
///
/// Worth finding out here rather than at the till: on Fedora, Debian and most
/// others these nodes belong to the `lp` group, and an account that is not in it
/// gets *permission denied* with nothing to suggest what to do about it. That is
/// the single most likely thing to stop a Linux till printing, and it is
/// invisible until somebody tries.
#[cfg(target_os = "linux")]
fn refused(path: &std::path::Path) -> Option<String> {
    use std::os::unix::fs::OpenOptionsExt;

    // O_NONBLOCK so that a printer which is switched off cannot leave the
    // settings window hanging on an open() that never returns. 0o4000 is the
    // Linux value; this function is Linux-only, so it needs no others.
    const O_NONBLOCK: i32 = 0o4000;

    match std::fs::OpenOptions::new().write(true).custom_flags(O_NONBLOCK).open(path) {
        Ok(_) => None,
        Err(err) if err.kind() == std::io::ErrorKind::PermissionDenied => {
            Some("not allowed: run  sudo usermod -aG lp $USER  and sign in again".to_string())
        }
        Err(err) => Some(format!("cannot be opened: {err}")),
    }
}

/// macOS has no printer device nodes: a USB printer there is reached through
/// CUPS, which [`installed_printers`] already offers.
#[cfg(all(unix, not(target_os = "linux")))]
fn usb_printers() -> Result<Vec<Candidate>, String> {
    Ok(Vec::new())
}

// ---------------------------------------------------------------------------
// Serial ports
// ---------------------------------------------------------------------------

/// Serial ports this PC has, for a till printer wired to one.
///
/// A port being listed does not mean a printer is on it -- these are ports, not
/// printers -- so they are offered plainly and the test print is what settles
/// it.
fn serial_ports() -> Result<Vec<Candidate>, String> {
    let ports = serialport::available_ports()
        .map_err(|err| format!("Cannot look for serial ports: {err}"))?;

    Ok(ports
        .into_iter()
        .filter(|port| real_serial_port(&port.port_name))
        .map(|port| Candidate {
            label: port.port_name.clone(),
            detail: Some(match port.port_type {
                serialport::SerialPortType::UsbPort(info) => {
                    let name = info.product.or(info.manufacturer);
                    match name {
                        Some(name) => format!("Serial port ({name})"),
                        None => "Serial port over USB".to_string(),
                    }
                }
                serialport::SerialPortType::BluetoothPort => "Serial port over Bluetooth".into(),
                serialport::SerialPortType::PciPort => "Serial port".into(),
                serialport::SerialPortType::Unknown => "Serial port".into(),
            }),
            connection: Connection::Serial { path: port.port_name, baud_rate: 9600 },
            is_default: false,
        })
        .collect())
}

/// Whether a serial port is a real one, or a ghost.
///
/// Linux declares `/dev/ttyS0` through `/dev/ttyS31` whether or not the PC has
/// the hardware, so a laptop with no serial port at all still lists thirty-two
/// of them. Offering those buries the printer somebody is actually looking for
/// under three screens of scrolling, which on a Linux till is the difference
/// between *Add* being useful and being unusable.
///
/// The kernel says which are real: `/sys/class/tty/ttySN/type` is `0`
/// (`PORT_UNKNOWN`) for a port with no UART behind it, and the chip number for
/// one with. Anything that is not a `ttyS` -- a USB adapter, a Bluetooth port --
/// only exists when it is plugged in, so it is taken at face value.
#[cfg(target_os = "linux")]
fn real_serial_port(port_name: &str) -> bool {
    let Some(tty) = port_name.strip_prefix("/dev/") else {
        return true;
    };
    if !tty.starts_with("ttyS") {
        return true;
    }

    match std::fs::read_to_string(format!("/sys/class/tty/{tty}/type")) {
        Ok(kind) => kind.trim() != "0",
        // No sysfs to ask: better to offer a port that is not there than to hide
        // one that is.
        Err(_) => true,
    }
}

/// Windows and macOS only list serial ports they actually have.
#[cfg(not(target_os = "linux"))]
fn real_serial_port(_port_name: &str) -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A PC with nothing attached is normal, and must not be an error: the
    /// settings window still has to open, so somebody can type in a network
    /// printer's address.
    #[test]
    fn looking_on_a_machine_with_nothing_attached_still_answers() {
        let found = look();
        // Whatever is or is not plugged into the machine running the tests, this
        // has to come back rather than fail.
        for candidate in &found.printers {
            assert!(!candidate.label.is_empty());
        }
    }

    /// A USB receipt printer on Linux is a device node, and `Add` has to offer
    /// it: with no CUPS queue -- which is the ordinary state of a printer whose
    /// vendor ships a Windows driver and nothing else -- it is the only way to
    /// reach it, and a list that leaves it out looks like a list with no
    /// printer in it.
    #[cfg(target_os = "linux")]
    #[test]
    fn a_printer_node_is_a_prefix_and_a_number() {
        assert!(is_printer_node("lp0", "lp"));
        assert!(is_printer_node("lp12", "lp"));

        // Not printers, whatever else they are.
        assert!(!is_printer_node("lp", "lp"));
        assert!(!is_printer_node("lptest", "lp"));
        assert!(!is_printer_node("loop0", "lp"));
        assert!(!is_printer_node("", "lp"));
    }

    /// Linux declares `/dev/ttyS0` to `/dev/ttyS31` whether or not the hardware
    /// is there. Offering all thirty-two buries the printer somebody came to
    /// find, so only the ones with a real UART behind them are kept -- and
    /// anything that is not a `ttyS` is taken at its word, because a USB or
    /// Bluetooth port only exists when it is really there.
    #[cfg(target_os = "linux")]
    #[test]
    fn a_usb_serial_adapter_is_never_mistaken_for_a_phantom_port() {
        assert!(real_serial_port("/dev/ttyUSB0"));
        assert!(real_serial_port("/dev/ttyACM0"));
        assert!(real_serial_port("/dev/rfcomm0"));
        // Not under /dev at all: nothing to check, so nothing is hidden.
        assert!(real_serial_port("COM1"));
    }

    /// Prints what this particular computer can see, for supporting a till from
    /// a distance. Ignored because the answer is different on every machine and
    /// there is nothing to assert about it -- the point is to read it:
    ///
    /// ```text
    /// cargo test --manifest-path src-tauri/Cargo.toml what_this_computer_can_see -- --ignored --nocapture
    /// ```
    #[test]
    #[ignore = "reports what is attached to this machine; nothing to assert"]
    fn what_this_computer_can_see() {
        let found = look();
        for candidate in &found.printers {
            println!(
                "{}  [{}]  {}",
                candidate.label,
                candidate.detail.as_deref().unwrap_or(""),
                candidate.connection.describe()
            );
        }
        for problem in &found.problems {
            println!("problem: {problem}");
        }
    }

    /// The default printer is what somebody setting up an existing till is
    /// looking for, so it has to be first.
    #[test]
    fn the_default_printer_is_offered_first() {
        let mut found = Found {
            printers: vec![
                Candidate {
                    label: "Second".into(),
                    detail: None,
                    connection: Connection::SystemPrinter { name: "Second".into() },
                    is_default: false,
                },
                Candidate {
                    label: "The usual one".into(),
                    detail: None,
                    connection: Connection::SystemPrinter { name: "The usual one".into() },
                    is_default: true,
                },
            ],
            problems: Vec::new(),
        };
        found.printers.sort_by_key(|candidate| !candidate.is_default);

        assert_eq!(found.printers[0].label, "The usual one");
    }
}
