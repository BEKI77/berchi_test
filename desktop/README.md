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

### Or let GitHub build it

`.github/workflows/desktop.yml` builds the same installer on a Windows runner, so
a PC without Rust can still get one.

- **Any push or pull request touching `desktop/`** builds it and keeps the
  installer under the run's *Artifacts* for 30 days. *Actions* → *Desktop app* →
  *Run workflow* does the same on demand.
- **A tag** publishes a release with the installer attached, which is the easiest
  thing to point the salon at:

  ```bash
  # the tag must match the version in src-tauri/tauri.conf.json, or the build stops
  git tag desktop-v0.1.0 && git push origin desktop-v0.1.0
  ```

To release a new version, bump `version` in both `src-tauri/tauri.conf.json` and
`src-tauri/Cargo.toml` first, then tag.

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

## Connecting it to the salon system

The window does not start the salon system; it looks for one that is already
running. Start that first
(`docker compose -f docker-compose.cashier.yml --env-file .env.cashier up -d`,
see [docs/CASHIER_PC.md](../docs/CASHIER_PC.md)) and check
`docker compose -f docker-compose.cashier.yml ps` says `berchi-cashier-app` is
`healthy`.

**On the cashier PC itself** there is nothing to configure: the default address
is `http://localhost:3000`, which is where the Docker stack publishes the app.
Install, start, and it connects on its own.

**On another PC on the salon network**, three things have to line up:

1. Give the cashier PC a fixed address (reserve it in the router) and note it,
   e.g. `192.168.1.50`.
2. On the cashier PC, let that port through the Windows firewall, as an
   Administrator, with the salon network set to *Private*:

   ```powershell
   New-NetFirewallRule -DisplayName "Berchi salon" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private
   ```

3. Next to the installed program (*Start menu* → right-click *Berchi Cashier* →
   *Open file location* → right-click → *Open file location* again), create
   `berchi-url.txt` holding that address:

   ```
   # the salon computer
   http://192.168.1.50:3000
   ```

   Use the port from `APP_PORT` in `.env.cashier` if it is not 3000. Then start
   the program again: the address is read once, at start-up.

### Checking the connection

Before blaming the window, confirm the server answers the page it actually polls:

```powershell
curl.exe -i http://192.168.1.50:3000/api/auth/csrf     # expect 200
```

That page is used rather than a bare open port because Docker accepts
connections on a published port seconds before the app inside is listening. If it
answers 200, the window will hand over from *Starting the salon system* within a
couple of seconds.

### When it stays on the Starting screen

| What you see | Usually means |
|---|---|
| *Starting the salon system* forever | Nothing answers that address. Check `docker compose ... ps`, the port, and the firewall rule. The hint under the spinner appears after 30 seconds. |
| Blank or "cannot be used" screen | The address in `berchi-url.txt` is not a valid `http://` URL. `https://` is refused on purpose. |
| Connects, then a blank page on sign-in | The address spelling must match the one the app redirects to. The window only allows its own origin, so `http://localhost:3000` and `http://127.0.0.1:3000` are two different places — pick one and use it everywhere. |
| It drops back to *Starting* mid-sale | The server stopped answering twice in a row (about 10 seconds). It returns by itself; check `docker compose ... logs app --tail 50`. |
| Tablets work, this PC does not | Router AP/client isolation, or the salon network is set to *Public* on the cashier PC. |

`BERCHI_URL` overrides the file if you want to try an address without editing
anything. From the folder the shortcut points at:

```powershell
$env:BERCHI_URL = "http://192.168.1.50:3000"
.\berchi-cashier.exe
```

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
