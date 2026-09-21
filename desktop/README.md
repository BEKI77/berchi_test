# Berchi Cashier: the desktop window

A small [Tauri 2](https://tauri.app) program that gives the cashier a proper
window for the salon system, instead of a browser tab.

## What it is, and what it is not

**It is a shell.** The database and the server stay exactly where they are, in the
Docker stack on the cashier PC ([docs/CASHIER_PC.md](../docs/CASHIER_PC.md)). This
program only opens the cashier screens in its own window and looks after the
moments a browser handles badly:

- **The PC has just started** and the server is still coming up: it shows a
  *Starting the salon system* screen and carries on by itself when the server
  answers.
- **The server goes away** (an update, Docker restarting): within about 10 seconds
  it goes back to that screen, instead of leaving a browser error page.
- **The number slip prints with no dialog**, straight to the default printer.
- **It cannot wander off:** the window only ever shows the salon server. The page
  it shows has no way to call into the program or the computer.
- **A second launch** brings the first window forward instead of opening another.

**It is not the offline rewrite.** The earlier plan for a Tauri app with its own
Rust backend and SQLite database (no Docker) has not been started. The salon
system needs the Docker stack running on the PC, and this window needs the salon
system. If the PC is switched off, so is everything.

## Build and install

You need Rust, the Visual Studio C++ build tools and the WebView2 runtime (all
already on the development PC). From this folder:

```powershell
npm install
npm run tauri build
```

The first build takes several minutes. It produces:

- `src-tauri\target\release\berchi-cashier.exe`: the program on its own.
- `src-tauri\target\release\bundle\nsis\Berchi Cashier_0.1.0_x64-setup.exe`: an
  installer. It installs for the current Windows user only, so it needs no
  administrator rights.

The installer is not code-signed, so Windows SmartScreen may say "unknown
publisher": choose *More info*, then *Run anyway*.

For development, `cd src-tauri; cargo build` makes a faster debug build.

## Settings

| Setting | What it does |
|---|---|
| `berchi-url.txt` next to the program | The salon system's address, e.g. `http://localhost:3005`. First line that is not blank or `#`. Default is `http://localhost:3000`, the cashier PC's own port. |
| `BERCHI_URL` environment variable | Same as the file, and wins over it. |
| `BERCHI_SILENT_PRINT=0` | Brings the print dialog back (for choosing a printer). Silent by default. |
| `BERCHI_WEBVIEW_ARGS` | Extra web view options, for diagnosing. |

Only `http://` addresses are supported: the salon system runs on the salon's own
network. If the address cannot be used, the window says so instead of waiting
forever.

## Start with Windows

Press `Win + R`, type `shell:startup`, and put a shortcut to the program in the
folder that opens.

## Checking it

```powershell
cargo build --manifest-path src-tauri/Cargo.toml
$env:SALON_URL = "http://localhost:3000"     # the salon system must be running
npm run verify
```

This launches the real program and checks: it opens the salon system, is
maximized and titled, refuses to leave the salon server, passes the silent-print
option, opens only once, waits while the server is down, carries on when it comes back,
returns to the Starting screen if it goes away again, and copes with a bad address
or an address file.

**Not checked: a real printer.** The silent-print option is passed to the web
view, but the test does not print, because that would print on the default
printer. Try *Print again* on the reception screen with your printer before
relying on it.

## Layout

- `src/`: the two screens the program shows itself: `index.html` (*Starting*) and
  `problem.html` (bad address). Plain HTML, one line of script, no network.
- `src-tauri/src/lib.rs`: the whole program: the address, the watching, the
  window, the rules about where it may go.
- `scripts/verify-shell.mjs`: the check above.
