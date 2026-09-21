//! The Berchi cashier's desktop window.
//!
//! This is a thin shell around the salon system that runs on the same PC (see
//! docs/CASHIER_PC.md). The database and the server stay where they are; this
//! program gives the cashier a proper window instead of a browser tab, and looks
//! after the moments a browser handles badly:
//!
//! - The PC has just started and the server is still coming up: it shows a
//!   "Starting" screen and carries on by itself when the server answers.
//! - The server goes away (an update, Docker restarting): it goes back to that
//!   screen instead of leaving a browser error page for the cashier to puzzle over.
//! - The number slip at reception prints straight to the default printer, with no
//!   print dialog to tap through.
//! - It will not wander off: the window only ever shows the salon server.

use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

use tauri::{Manager, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

/// Where the salon system normally lives: the cashier PC's own port 3000.
const DEFAULT_SALON_URL: &str = "http://localhost:3000";

/// A file next to the program that can name a different address, for a PC set up
/// on another port. The BERCHI_URL environment variable does the same and wins.
const URL_FILE: &str = "berchi-url.txt";

/// A light page that only answers when the whole system is up, unlike a bare
/// open port (Docker accepts connections on a published port before the app
/// inside is listening).
const READY_PATH: &str = "/api/auth/csrf";

const POLL_WHILE_WAITING: Duration = Duration::from_secs(2);
const POLL_WHILE_SHOWING: Duration = Duration::from_secs(3);

/// Missed checks in a row, while showing the app, before going back to the
/// Starting screen. More than one, so a single slow answer does not interrupt a
/// sale.
const MISSES_BEFORE_STARTING_SCREEN: u32 = 2;

/// The address of the salon system, or why the one configured cannot be used.
fn salon_url() -> Result<Url, String> {
    let raw = std::env::var("BERCHI_URL")
        .ok()
        .filter(|v| !v.trim().is_empty())
        .or_else(read_url_file)
        .unwrap_or_else(|| DEFAULT_SALON_URL.to_string());

    let url = Url::parse(raw.trim()).map_err(|e| format!("\"{raw}\": {e}"))?;
    if url.scheme() != "http" || url.host_str().is_none() {
        return Err(format!(
            "\"{raw}\": only http:// addresses on the salon network are supported"
        ));
    }
    Ok(url)
}

/// First line of berchi-url.txt that is not blank or a # comment.
fn read_url_file() -> Option<String> {
    let path = std::env::current_exe().ok()?.parent()?.join(URL_FILE);
    let text = std::fs::read_to_string(path).ok()?;
    text.lines()
        .map(str::trim)
        .find(|line| !line.is_empty() && !line.starts_with('#'))
        .map(str::to_string)
}

/// True once the salon server answers a real request with a success status.
fn server_ready(salon: &Url) -> bool {
    let (Some(host), Some(port)) = (salon.host_str(), salon.port_or_known_default()) else {
        return false;
    };
    let Ok(addresses) = (host, port).to_socket_addrs() else {
        return false;
    };

    // "localhost" can resolve to both IPv6 and IPv4; try each, as a browser does.
    //
    // The connect limit is short on purpose. The server is on this PC or the salon
    // LAN, so a connection either succeeds in milliseconds or it is not there.
    // Windows takes about 2 seconds to report "refused" on a closed port, and with
    // two addresses that made every failed check cost ~4 seconds.
    for address in addresses {
        let Ok(mut stream) = TcpStream::connect_timeout(&address, Duration::from_secs(1)) else {
            continue;
        };
        let _ = stream.set_read_timeout(Some(Duration::from_secs(3)));
        let _ = stream.set_write_timeout(Some(Duration::from_secs(3)));

        let request =
            format!("GET {READY_PATH} HTTP/1.1\r\nHost: {host}:{port}\r\nConnection: close\r\n\r\n");
        if stream.write_all(request.as_bytes()).is_err() {
            continue;
        }

        // "HTTP/1.1 200": the status class is the ninth byte.
        let mut start = [0u8; 12];
        if stream.read_exact(&mut start).is_ok() && start.starts_with(b"HTTP/1.") && start[9] == b'2' {
            return true;
        }
    }
    false
}

/// The address of the Starting screen, read once it has actually loaded.
///
/// It cannot be read straight after the window is created: until the first page
/// arrives the web view reports "about:blank", and going "back" to that would
/// leave the cashier looking at an empty page.
fn starting_screen_address(window: &WebviewWindow) -> Option<Url> {
    for _ in 0..100 {
        match window.url() {
            Ok(url) if url.scheme() != "about" => return Some(url),
            Ok(_) => std::thread::sleep(Duration::from_millis(100)),
            Err(_) => return None, // the window was closed
        }
    }
    // Never expected: a bundled page loads in milliseconds. This is where
    // Windows serves the program's own screens.
    Url::parse("http://tauri.localhost/index.html").ok()
}

/// Watches the server for the life of the window: hands over from the Starting
/// screen once it answers, and comes back to it if it stops answering.
fn supervise(window: WebviewWindow, salon: Url) {
    let Some(starting_screen) = starting_screen_address(&window) else {
        return;
    };
    let mut showing_app = false;
    let mut misses = 0;

    loop {
        let up = server_ready(&salon);

        if !showing_app {
            if up {
                if window.navigate(salon.clone()).is_err() {
                    return; // the window was closed
                }
                showing_app = true;
                misses = 0;
            }
        } else if up {
            misses = 0;
        } else {
            misses += 1;
            if misses >= MISSES_BEFORE_STARTING_SCREEN {
                if window.navigate(starting_screen.clone()).is_err() {
                    return;
                }
                showing_app = false;
            }
        }

        std::thread::sleep(if showing_app { POLL_WHILE_SHOWING } else { POLL_WHILE_WAITING });
    }
}

/// Windows only: the web view's start-up options.
#[cfg(windows)]
fn browser_args() -> String {
    // Setting any option REPLACES Tauri's own defaults, so they are repeated.
    let mut args = String::from("--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection");

    // Print straight to the default printer, no dialog: the number slip has to
    // come out at reception without an extra tap. BERCHI_SILENT_PRINT=0 brings
    // the dialog back, for setting up a printer.
    if std::env::var("BERCHI_SILENT_PRINT").as_deref() != Ok("0") {
        args.push_str(" --kiosk-printing");
    }

    // For diagnosing: extra web view options, appended as given.
    if let Ok(extra) = std::env::var("BERCHI_WEBVIEW_ARGS") {
        args.push(' ');
        args.push_str(&extra);
    }
    args
}

/// The window may show the salon server and the program's own screens, nothing else.
fn navigation_allowed(target: &Url, salon: &Url) -> bool {
    target.origin() == salon.origin()
        || target.scheme() == "about"
        || target.scheme() == "tauri"
        // How Windows serves the program's own screens.
        || target.host_str() == Some("tauri.localhost")
}

pub fn run() {
    tauri::Builder::default()
        // A second launch (a double-click on the icon) brings the first window
        // forward instead of opening another cashier.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            let salon = salon_url();
            let first_screen = if salon.is_ok() { "index.html" } else { "problem.html" };

            let builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::App(first_screen.into()))
                .title("Berchi Cashier")
                .maximized(true)
                .min_inner_size(1024.0, 700.0);
            #[cfg(windows)]
            let builder = builder.additional_browser_args(&browser_args());

            match salon {
                Ok(salon) => {
                    let for_navigation = salon.clone();
                    let window = builder
                        .on_navigation(move |target| navigation_allowed(target, &for_navigation))
                        .build()?;
                    std::thread::spawn(move || supervise(window, salon));
                }
                Err(problem) => {
                    eprintln!("berchi-cashier: cannot use the configured address: {problem}");
                    builder.build()?;
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the Berchi cashier");
}
