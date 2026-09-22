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

/// Print queues CUPS knows about.
///
/// The salon runs on Windows. This exists so the settings window can be built
/// and tried on the machine it is developed on.
#[cfg(not(windows))]
fn installed_printers() -> Result<Vec<Candidate>, String> {
    let listed = match run("lpstat", &["-a"]) {
        Ok(output) => output,
        // No CUPS on this machine is not a fault worth reporting: it just means
        // there are no queues to offer.
        Err(_) => return Ok(Vec::new()),
    };

    let default = run("lpstat", &["-d"]).ok().and_then(|line| {
        line.split(':').nth(1).map(|name| name.trim().to_string()).filter(|n| !n.is_empty())
    });

    Ok(listed
        .lines()
        .filter_map(|line| line.split_whitespace().next())
        .filter(|name| !name.is_empty())
        .map(|name| Candidate {
            is_default: default.as_deref() == Some(name),
            detail: Some("A print queue on this computer".into()),
            connection: Connection::SystemPrinter { name: name.to_string() },
            label: name.to_string(),
        })
        .collect())
}

#[cfg(not(windows))]
fn run(program: &str, args: &[&str]) -> Result<String, String> {
    let output = std::process::Command::new(program)
        .args(args)
        .output()
        .map_err(|err| format!("cannot run {program}: {err}"))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
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

#[cfg(not(windows))]
fn usb_printers() -> Result<Vec<Candidate>, String> {
    // The USB path is a Windows driver. On Linux the same printer appears as a
    // device file, which the device connection covers.
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
