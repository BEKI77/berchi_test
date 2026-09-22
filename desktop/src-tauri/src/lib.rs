//! The Berchi cashier's desktop window.
//!
//! This is a thin shell around the salon system, whether that runs on the same PC
//! (see docs/CASHIER_PC.md) or on a deployed domain. The database and the server
//! stay where they are; this program gives the cashier a proper window instead of
//! a browser tab, and looks after the moments a browser handles badly:
//!
//! - The PC has just started and the server is still coming up: it shows a
//!   "Starting" screen and carries on by itself when the server answers.
//! - The server goes away (an update, Docker restarting, the internet dropping):
//!   it goes back to that screen instead of leaving a browser error page for the
//!   cashier to puzzle over.
//! - The number slip at reception prints straight to the default printer, with no
//!   print dialog to tap through. There is no printer chooser: the printer is the
//!   Windows default one, and berchi-print.txt brings the dialog back for the one
//!   time somebody needs to see the list.
//! - It will not wander off: the window only ever shows the salon server.

use std::time::Duration;

use tauri::{Manager, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

/// The address baked in when the program was built, from the BERCHI_DEFAULT_URL
/// environment variable. The GitHub workflow passes the SALON_URL secret, so an
/// installer downloaded from a release already points at the deployed salon and
/// the cashier PC has nothing to configure.
///
/// Note this is a default, not a secret: anyone holding the installer can read
/// the address out of it. It is a domain name, so that is fine -- but do not put
/// anything private in it.
const BAKED_IN_SALON_URL: Option<&str> = option_env!("BERCHI_DEFAULT_URL");

/// Where the salon system lives when nothing else says otherwise: the cashier
/// PC's own port 3000, which is what a developer running the Docker stack wants.
const FALLBACK_SALON_URL: &str = "http://localhost:3000";

/// A file next to the program that can name a different address, for a PC set up
/// on another port. The BERCHI_URL environment variable does the same and wins.
const URL_FILE: &str = "berchi-url.txt";

/// A file next to the program that chooses whether the slip prints by itself or
/// the cashier gets the print dialog. The BERCHI_SILENT_PRINT environment
/// variable does the same and wins.
///
/// It exists because an installed program is started from the Start menu, where
/// there is nowhere to put an environment variable. Seeing which printers
/// Windows offers should not need one.
const PRINT_FILE: &str = "berchi-print.txt";

/// A light page that only answers when the whole system is up, unlike a bare
/// open port: Docker accepts connections on a published port before the app
/// inside is listening, and a load balancer in front of a deployed salon answers
/// long before the app behind it does.
const READY_PATH: &str = "/api/auth/csrf";

/// How long one check may take, in total: name lookup, connecting, the TLS
/// handshake and the answer. Generous enough for a deployed domain over the
/// salon's internet connection, short enough that a dead address does not freeze
/// the loop.
const PROBE_TIMEOUT: Duration = Duration::from_secs(4);

const POLL_WHILE_WAITING: Duration = Duration::from_secs(2);
const POLL_WHILE_SHOWING: Duration = Duration::from_secs(3);

/// Missed checks in a row, while showing the app, before going back to the
/// Starting screen. More than one, so a single slow answer does not interrupt a
/// sale.
const MISSES_BEFORE_STARTING_SCREEN: u32 = 2;

/// The address of the salon system, or why the one configured cannot be used.
///
/// Most specific wins: the environment variable, then the file next to the
/// program, then whatever was baked in at build time, then this PC's own port
/// 3000. A setting that is present but blank counts as not set, so an unset
/// GitHub secret cannot bake an empty address into a build.
fn salon_url() -> Result<Url, String> {
    let raw = choose_salon_url(
        std::env::var("BERCHI_URL").ok(),
        read_setting_file(URL_FILE),
        BAKED_IN_SALON_URL,
    );
    parse_salon_url(&raw)
}

/// Picks the address to use out of the places one can be written down.
fn choose_salon_url(
    from_env: Option<String>,
    from_file: Option<String>,
    baked_in: Option<&str>,
) -> String {
    [from_env, from_file, baked_in.map(str::to_string)]
        .into_iter()
        .flatten()
        .map(|value| value.trim().to_string())
        .find(|value| !value.is_empty())
        .unwrap_or_else(|| FALLBACK_SALON_URL.to_string())
}

/// An address this program is willing to point the window at.
fn parse_salon_url(raw: &str) -> Result<Url, String> {
    let url = Url::parse(raw).map_err(|e| format!("\"{raw}\": {e}"))?;
    if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none() {
        return Err(format!(
            "\"{raw}\": only http:// and https:// addresses are supported"
        ));
    }
    Ok(url)
}

/// First line of a settings file next to the program that is not blank or a
/// # comment.
fn read_setting_file(name: &str) -> Option<String> {
    let path = std::env::current_exe().ok()?.parent()?.join(name);
    let text = std::fs::read_to_string(path).ok()?;
    text.lines()
        .map(str::trim)
        .find(|line| !line.is_empty() && !line.starts_with('#'))
        .map(str::to_string)
}

/// The client used for every check.
///
/// One agent for the life of the program, so a deployed salon is not made to
/// repeat DNS and a TLS handshake every few seconds. Redirects are followed,
/// because a salon configured as `http://` that sends visitors to `https://` is
/// up, not down. Non-2xx answers arrive as ordinary responses rather than
/// errors, so the status can simply be read.
fn probe_client() -> ureq::Agent {
    ureq::Agent::config_builder()
        .timeout_global(Some(PROBE_TIMEOUT))
        .http_status_as_error(false)
        .user_agent("berchi-cashier")
        // The operating system's own certificate store (SChannel on Windows)
        // rather than a set of roots bundled into this program, so the salon's
        // certificate is trusted on exactly the same terms as in the web view.
        .tls_config(
            ureq::tls::TlsConfig::builder()
                .provider(ureq::tls::TlsProvider::NativeTls)
                .build(),
        )
        .build()
        .into()
}

/// True once the salon system answers a real request with a success status.
fn server_ready(client: &ureq::Agent, salon: &Url) -> bool {
    let Ok(probe) = salon.join(READY_PATH) else {
        return false;
    };
    match client.get(probe.as_str()).call() {
        Ok(response) => {
            let ready = response.status().is_success();
            // Drain the body so the connection can go back in the pool. ureq
            // drops one whose body was never read, and the next check a few
            // seconds later would pay for DNS and the TLS handshake again.
            let _ = response.into_body().read_to_string();
            ready
        }
        // No answer at all: the PC is still starting, Docker is restarting, the
        // internet is down, or the name does not resolve. All the same to us.
        Err(_) => false,
    }
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
    let client = probe_client();
    let mut showing_app = false;
    let mut misses = 0;

    loop {
        let up = server_ready(&client, &salon);

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

/// Whether the web view prints straight to the default printer.
///
/// Silent unless something says otherwise: the number slip has to come out at
/// reception without an extra tap. Most specific wins, as with the address --
/// the environment variable, then the file next to the program.
///
/// Turning it off is how a printer gets chosen on this PC. There is no printer
/// chooser inside the salon system: with the dialog back, Windows lists the
/// printers it knows and the cashier picks one per print.
#[cfg_attr(not(windows), allow(dead_code))]
fn silent_printing() -> bool {
    choose_silent_printing(
        std::env::var("BERCHI_SILENT_PRINT").ok(),
        read_setting_file(PRINT_FILE),
    )
}

/// Reads the printing setting out of the places one can be written down.
///
/// A value nobody recognises is passed over rather than guessed at, so a typo in
/// the file cannot quietly stop the slip printing: the next place down is tried,
/// and failing that it stays silent, which is what reception needs.
#[cfg_attr(not(windows), allow(dead_code))]
fn choose_silent_printing(from_env: Option<String>, from_file: Option<String>) -> bool {
    [from_env, from_file]
        .into_iter()
        .flatten()
        .find_map(|value| match value.trim().to_ascii_lowercase().as_str() {
            "0" | "dialog" | "off" | "false" | "no" => Some(false),
            "1" | "silent" | "on" | "true" | "yes" => Some(true),
            _ => None,
        })
        .unwrap_or(true)
}

/// Windows only: the web view's start-up options.
#[cfg(windows)]
fn browser_args() -> String {
    // Setting any option REPLACES Tauri's own defaults, so they are repeated.
    let mut args = String::from("--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection");

    // Print straight to the default printer, no dialog: the number slip has to
    // come out at reception without an extra tap.
    //
    // Chromium flashes the print dialog up for about a second before printing
    // anyway (crbug.com/169004), so a dialog that appears and vanishes by itself
    // is this option working, not a fault. What it is not is a printer chooser:
    // the printer is whichever one Windows has as the default. berchi-print.txt
    // saying "dialog" brings the chooser back, which is how a printer is picked
    // while setting the PC up.
    if silent_printing() {
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
        || is_https_upgrade(target, salon)
        || target.scheme() == "about"
        || target.scheme() == "tauri"
        // How Windows serves the program's own screens.
        || target.host_str() == Some("tauri.localhost")
}

/// A salon written down as `http://` that redirects to `https://` on the same
/// host, which is what a deployed salon behind a load balancer normally does.
///
/// Strictly the same place, reached more safely. Without this the window would
/// refuse its own server's redirect and sit on the Starting screen forever, with
/// nothing on screen to explain why. Only the bare domain is covered: an address
/// carrying a port was written deliberately and is left alone.
fn is_https_upgrade(target: &Url, salon: &Url) -> bool {
    salon.scheme() == "http"
        && target.scheme() == "https"
        && salon.host_str().is_some()
        && target.host_str() == salon.host_str()
        && salon.port().is_none()
        && target.port().is_none()
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

#[cfg(test)]
mod tests {
    use super::*;

    fn url(raw: &str) -> Url {
        Url::parse(raw).expect(raw)
    }

    #[test]
    fn takes_a_lan_address_or_a_deployed_domain() {
        assert!(parse_salon_url("http://localhost:3000").is_ok());
        assert!(parse_salon_url("http://192.168.1.50:3000").is_ok());
        assert!(parse_salon_url("https://salon.example.com").is_ok());
    }

    #[test]
    fn refuses_what_it_cannot_show() {
        assert!(parse_salon_url("").is_err());
        assert!(parse_salon_url("not an address").is_err());
        assert!(parse_salon_url("salon.example.com").is_err()); // no scheme
        assert!(parse_salon_url("file:///C:/salon").is_err());
    }

    /// Nothing written down anywhere means the slip prints by itself. Reception
    /// depends on that: a dialog waiting for a tap holds up the queue.
    #[test]
    fn prints_by_itself_unless_told_otherwise() {
        assert!(choose_silent_printing(None, None));
    }

    /// Asking for the dialog is how a printer is chosen on the PC, so both
    /// places have to be able to ask for it.
    #[test]
    fn either_place_can_ask_for_the_print_dialog() {
        assert!(!choose_silent_printing(Some("0".into()), None));
        assert!(!choose_silent_printing(None, Some("dialog".into())));
        // The words people actually write, however they cased them, and with the
        // trailing newline a text editor leaves behind.
        assert!(!choose_silent_printing(None, Some("Dialog\n".into())));
        assert!(!choose_silent_printing(None, Some("  OFF  ".into())));
        assert!(!choose_silent_printing(None, Some("no".into())));
    }

    #[test]
    fn the_most_specific_printing_setting_wins() {
        // The variable is set for one run, to try the dialog on a PC whose file
        // says silent -- and the other way about.
        assert!(!choose_silent_printing(Some("0".into()), Some("silent".into())));
        assert!(choose_silent_printing(Some("1".into()), Some("dialog".into())));
    }

    /// A typo must not quietly stop the slip printing: reception would go on
    /// tapping the button with nothing coming out and no reason on screen.
    #[test]
    fn a_setting_nobody_recognises_is_passed_over() {
        assert!(choose_silent_printing(Some("maybe".into()), None));
        assert!(choose_silent_printing(None, Some("dailog".into())));
        assert!(choose_silent_printing(Some("".into()), None));
        // An unreadable variable still lets the file underneath be heard.
        assert!(!choose_silent_printing(Some("maybe".into()), Some("dialog".into())));
    }

    #[test]
    fn the_window_stays_on_the_salon() {
        let salon = url("https://salon.example.com");
        assert!(navigation_allowed(&url("https://salon.example.com/checkout"), &salon));
        assert!(!navigation_allowed(&url("https://example.com/"), &salon));
        // A look-alike host is somebody else.
        assert!(!navigation_allowed(&url("https://salon.example.com.evil.test/"), &salon));
    }

    #[test]
    fn follows_its_own_servers_jump_to_https() {
        let insecure = url("http://salon.example.com");
        assert!(navigation_allowed(&url("https://salon.example.com/login"), &insecure));
        assert!(!navigation_allowed(&url("https://elsewhere.example.com/"), &insecure));

        // Never the other way round: a salon reached over https is not allowed
        // to be dragged back down to http.
        let secure = url("https://salon.example.com");
        assert!(!navigation_allowed(&url("http://salon.example.com/"), &secure));
    }

    #[test]
    fn an_address_with_a_port_is_left_alone() {
        let salon = url("http://192.168.1.50:3000");
        assert!(!navigation_allowed(&url("https://192.168.1.50/"), &salon));
    }

    #[test]
    fn the_most_specific_address_wins() {
        let env = || Some("http://from-env:3000".to_string());
        let file = || Some("http://from-file:3000".to_string());
        let baked = Some("https://salon.example.com");

        assert_eq!(choose_salon_url(env(), file(), baked), "http://from-env:3000");
        assert_eq!(choose_salon_url(None, file(), baked), "http://from-file:3000");
        assert_eq!(choose_salon_url(None, None, baked), "https://salon.example.com");
        assert_eq!(choose_salon_url(None, None, None), FALLBACK_SALON_URL);
    }

    /// An unset GitHub secret arrives as an empty string, not as "no value". If
    /// that counted as an address, every installer built without the secret
    /// would fail to start instead of falling back.
    #[test]
    fn a_blank_setting_counts_as_unset() {
        assert_eq!(choose_salon_url(None, None, Some("")), FALLBACK_SALON_URL);
        assert_eq!(choose_salon_url(Some("   ".into()), None, None), FALLBACK_SALON_URL);
        assert_eq!(
            choose_salon_url(Some("".into()), None, Some("https://salon.example.com")),
            "https://salon.example.com"
        );
        // Surrounding whitespace is trimmed, not treated as part of the address.
        assert_eq!(
            choose_salon_url(None, None, Some("  https://salon.example.com\n")),
            "https://salon.example.com"
        );
    }

    /// Checks the whole build-time path, not just the picking logic. Only
    /// meaningful when the address was actually baked in:
    ///
    ///     BERCHI_DEFAULT_URL=https://salon.example.test cargo test -- --ignored
    #[test]
    #[ignore = "only meaningful when built with BERCHI_DEFAULT_URL set"]
    fn uses_the_address_baked_in_at_build_time() {
        let Some(baked) = BAKED_IN_SALON_URL else {
            eprintln!("skipped: nothing was baked in, so there is nothing to check");
            return;
        };
        std::env::remove_var("BERCHI_URL");
        let chosen = salon_url().expect("the baked-in address should be usable");
        assert_eq!(chosen.host_str(), parse_salon_url(baked).unwrap().host_str());
    }

    /// "localhost" resolves to both ::1 and 127.0.0.1, and the salon system may
    /// be listening on only one of them. The check has to try each, as a browser
    /// does, or the window waits forever in front of a server that is up.
    #[test]
    fn copes_with_localhost_resolving_to_ipv6_first() {
        use std::io::{Read, Write};
        use std::net::TcpListener;

        let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
        let port = listener.local_addr().unwrap().port();
        std::thread::spawn(move || {
            for stream in listener.incoming().flatten() {
                let mut stream = stream;
                let _ = stream.read(&mut [0u8; 1024]);
                let _ = stream.write_all(
                    b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok",
                );
            }
        });

        let client = probe_client();
        assert!(
            server_ready(&client, &url(&format!("http://localhost:{port}"))),
            "must try every address localhost resolves to, not just the first"
        );
    }

    /// Proves the TLS provider is really wired up. With the wrong feature set
    /// ureq still compiles and then panics on the first https request, which
    /// would only show up on the cashier PC. Needs the internet, so it is not
    /// part of an ordinary run:
    ///
    ///     cargo test -- --ignored
    #[test]
    #[ignore = "needs the internet"]
    fn really_speaks_https() {
        let client = probe_client();
        let answer = client
            .get("https://example.com/")
            .call()
            .expect("https request failed");
        assert!(answer.status().is_success(), "status {}", answer.status());
    }
}
