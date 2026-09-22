# Berchi Cashier: the desktop window

A small [Tauri 2](https://tauri.app) program that gives the cashier a proper
window for the salon system, instead of a browser tab.

## What it is, and what it is not

**It is a shell.** The database and the server stay exactly where they are —
either the Docker stack on the cashier PC
([docs/CASHIER_PC.md](../docs/CASHIER_PC.md)) or a deployed domain. This program
only opens the cashier screens in its own window and looks after the moments a
browser handles badly:

- **The PC has just started** and the server is still coming up: it shows a
  *Starting the salon system* screen and carries on by itself when the server
  answers.
- **The server goes away** (an update, Docker restarting, the internet dropping):
  within about 10 seconds it goes back to that screen, instead of leaving a
  browser error page.
- **The number slip prints with no dialog**, straight to the default printer.
- **It cannot wander off:** the window only ever shows the salon server. The page
  it shows has no way to call into the program or the computer.
- **A second launch** brings the first window forward instead of opening another.

**It is not the offline rewrite.** The earlier plan for a Tauri app with its own
Rust backend and SQLite database has not been started. This window needs a salon
system answering somewhere: if that is the Docker stack and the PC is switched
off, or a deployed domain and the internet is down, so is everything.

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

The build bakes the `SALON_URL` repository secret in as the address the program
polls, so the installer it produces already points at the salon — see
[The deployed salon, on a domain](#the-deployed-salon-on-a-domain). Building by
hand does the same thing with an environment variable:

```powershell
$env:BERCHI_DEFAULT_URL = "https://salon.example.com"
npm run tauri build
```

## Settings

The salon's address can be written down in four places. The most specific one
that is not blank wins, so a single PC can be pointed somewhere else without
rebuilding anything, and a blank setting never counts as an address:

| Where | What it does |
|---|---|
| `BERCHI_URL` environment variable | Wins over everything. For trying an address without committing to it. |
| `berchi-url.txt` next to the program | First line that is not blank or `#`. For one PC set up differently. |
| `BERCHI_DEFAULT_URL` when the program is **built** | Baked in, so an installer arrives already pointing at the salon. The workflow fills this from the `SALON_URL` repository secret. |
| nothing set | `http://localhost:3000`, the cashier PC's own port. |

Other settings:

| Setting | What it does |
|---|---|
| `BERCHI_SILENT_PRINT=0` | Brings the print dialog back (for choosing a printer). Silent by default. |
| `BERCHI_WEBVIEW_ARGS` | Extra web view options, for diagnosing. |

`http://` and `https://` are both supported. If the address cannot be used, the
window says so instead of waiting forever.

## Connecting it to the salon system

The window does not start the salon system; it polls for one that is already
running, and shows *Starting the salon system* until it answers. It asks for
`/api/auth/csrf` rather than just opening a socket, because only that answers
when the whole system is up: Docker accepts connections on a published port
before the app inside is listening, and a load balancer in front of a deployed
salon answers long before the app behind it does.

Pick whichever of the three below matches where the salon actually runs.

### The deployed salon, on a domain

Set the address once in the repository and every installer built afterwards
points at it, with nothing to configure on the cashier PC:

1. On GitHub: **Settings → Secrets and variables → Actions → New repository
   secret**. Name it `SALON_URL` and set it to the full address including the
   scheme — `https://salon.example.com`, no trailing path.
2. Build it: push a tag (`git tag desktop-v0.1.0 && git push origin desktop-v0.1.0`)
   or run *Actions → Desktop app → Run workflow*. The address is compiled in, so
   it has to be set before the build, not after. A **tagged release** with no
   secret fails on purpose rather than shipping installers that point at
   `localhost`.
3. Install the `-setup.exe` from the release on the cashier PC and start it.

Two things to know before pointing the salon at a deployed domain:

- **It is a default, not a credential.** The secret keeps the domain out of this
  repository, but anyone holding the installer can read the address straight back
  out of the program. Put nothing private in it.
- **Checkout then needs the internet.** The whole point of the cashier-PC setup
  in [docs/CASHIER_PC.md](../docs/CASHIER_PC.md) is that the salon keeps trading
  when the line drops. Pointed at a deployed domain, no internet means no
  checkout: the window returns to *Starting the salon system* and waits. If that
  matters more than having one shared database, keep the salon on the PC and use
  the next two sections instead.

If the secret says `http://salon.example.com` and the server redirects to
`https://` on the same host, the window follows it — that is the same salon,
reached more safely. Any other jump is still refused.

### On the cashier PC itself

Nothing to configure, as long as no `SALON_URL` was baked in: the fallback is
`http://localhost:3000`, which is where the Docker stack publishes the app. Start
the stack first
(`docker compose -f docker-compose.cashier.yml --env-file .env.cashier up -d`)
and check `docker compose -f docker-compose.cashier.yml ps` says
`berchi-cashier-app` is `healthy`. Then install, start, and it connects on its own.

### On another PC on the salon network

Three things have to line up:

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

Before blaming the window, confirm the server answers the page it actually polls,
from the PC that is complaining:

```powershell
curl.exe -i https://salon.example.com/api/auth/csrf    # the deployed salon
curl.exe -i http://192.168.1.50:3000/api/auth/csrf     # one running in the salon
```

A 200 means the window will hand over from *Starting the salon system* within a
couple of seconds. Anything else — a redirect, a 502 from a load balancer, a
certificate complaint, a name that will not resolve — is what the window is
seeing too.

### When it stays on the Starting screen

| What you see | Usually means |
|---|---|
| *Starting the salon system* forever | Nothing answers that address. Run the `curl.exe` above. For a domain: is the site up, does the name resolve from this PC? For the salon PC: `docker compose ... ps`, the port, the firewall rule. The hint under the spinner appears after 30 seconds. |
| *Starting* forever, but the site opens fine in a browser | Usually the certificate. The check trusts the same Windows certificate store the browser does, so a private or self-signed certificate must be installed on that PC, not just clicked past. |
| "cannot be used" screen | The address is not a valid `http://` or `https://` URL. A bare `salon.example.com` with no scheme is the usual cause. |
| It went to the wrong salon | An address was set closer to the PC than the built-in one. `BERCHI_URL` beats `berchi-url.txt`, which beats what was baked in at build time. Delete the one you did not mean. |
| Connects, then a blank page on sign-in | The address spelling must match the one the app redirects to. The window only allows its own origin, so `http://localhost:3000` and `http://127.0.0.1:3000` are two different places — pick one and use it everywhere. (`http://` → `https://` on the *same host* is the one exception, and is allowed.) |
| It drops back to *Starting* mid-sale | The server stopped answering twice in a row (about 10 seconds). It returns by itself. On a domain that usually means the internet; on the salon PC, check `docker compose ... logs app --tail 50`. |
| Tablets work, this PC does not | Router AP/client isolation, or the salon network is set to *Public* on the cashier PC. |

`BERCHI_URL` overrides everything if you want to try an address without editing
or rebuilding anything. From the folder the shortcut points at:

```powershell
$env:BERCHI_URL = "https://salon.example.com"
.\berchi-cashier.exe
```

## Start with Windows

Press `Win + R`, type `shell:startup`, and put a shortcut to the program in the
folder that opens.

## Checking it

The unit tests cover choosing the address and the rules about where the window
may go. They need nothing running, and work on any platform:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml
```

Two are marked `#[ignore]` because they reach further than that:

```powershell
# needs the internet; proves https really works, rather than only compiling
cargo test --manifest-path src-tauri/Cargo.toml -- --ignored

# proves the build-time address is baked in and picked up
$env:BERCHI_DEFAULT_URL = "https://salon.example.test"
cargo test --manifest-path src-tauri/Cargo.toml -- --ignored
```

Then the whole program, end to end:

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
