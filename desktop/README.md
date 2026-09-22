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
- **Tickets print on a real receipt printer.** The number slip and the receipt
  are laid out for an 80 mm roll and sent as ESC/POS, so the paper is cut at the
  end and the cash drawer can be kicked on a cash sale. Which printer is chosen
  on this PC, in a window the program opens itself: see
  [Setting up the printer](#setting-up-the-printer).
- **With no printer set up it still prints**, the older way: the page goes
  straight to the computer's default printer. That is also what happens if the
  receipt printer is switched off or out of paper, so a half-finished setup
  never stops reception issuing tickets. **On Windows** it goes with no dialog.
  **On Linux and macOS** the web view has no silent-printing option, so that
  path stops to ask for every customer &mdash; which makes setting a printer up
  here the thing to do on those tills, not an optional extra.
- **It cannot wander off:** the window only ever shows the salon server. The
  only thing the salon's pages may ask the program to do is print a ticket,
  open the cash drawer or open the printer settings window &mdash; they cannot
  read or change the printer settings, or touch anything else on the PC.
- **It does not behave like a browser.** No right-click menu offering *Back*,
  *Reload* and *Save as*; no dragging labels blue; no find bar or print dialog
  over the top of the till; no zooming the whole screen by catching Ctrl and the
  wheel. Fields still select and copy normally, and **reloading still works** —
  F5 is the only way back from a page that has wedged, and the watching thread
  only notices the *server* going away. This is done by a script injected before
  each page runs (`src-tauri/src/native.js`), so it reaches the salon system
  without the salon system knowing anything about it.
- **A second launch** brings the first window forward instead of opening another.

**It is not the offline rewrite.** The earlier plan for a Tauri app with its own
Rust backend and SQLite database has not been started. This window needs a salon
system answering somewhere: if that is the Docker stack and the PC is switched
off, or a deployed domain and the internet is down, so is everything.

## Build and install

The same command builds it everywhere; what comes out is whatever that
operating system installs:

```bash
npm install
npm run tauri build
```

The first build takes several minutes. For development, `cd src-tauri; cargo
build` makes a faster debug build, on any platform.

### Windows

Needs Rust, the Visual Studio C++ build tools and the WebView2 runtime (all
already on the development PC). It produces:

- `src-tauri\target\release\berchi-cashier.exe`: the program on its own.
- `src-tauri\target\release\bundle\nsis\Berchi Cashier_0.1.0_x64-setup.exe`: an
  installer. It installs for the current Windows user only, so it needs no
  administrator rights.

The installer is not code-signed, so Windows SmartScreen may say "unknown
publisher": choose *More info*, then *Run anyway*.

### Linux

Needs Rust and the web view Tauri builds against. On Fedora:

```bash
sudo dnf install webkit2gtk4.1-devel libsoup3-devel gtk3-devel \
                 openssl-devel curl wget file
# and, to print at all:
sudo dnf install cups cups-client
sudo systemctl enable --now cups
```

On Debian and Ubuntu the same packages are `libwebkit2gtk-4.1-dev`,
`libsoup-3.0-dev`, `libgtk-3-dev`, `libssl-dev` and `cups`.

The build produces `src-tauri/target/release/berchi-cashier` and, under
`src-tauri/target/release/bundle/`, an `.rpm` and a `.deb`.

An AppImage is not built by default because on a current Fedora it fails: the
`strip` that `linuxdeploy` carries is older than the `.relr.dyn` section modern
libraries use, and it stops the whole build after the other bundles are already
made. Skipping the strip builds it fine, so it is one command away when it is
wanted:

```bash
NO_STRIP=true npm run tauri build -- --bundles appimage
```

**Put the cashier's account in the printer group**, once, on every Linux till:

```bash
sudo usermod -aG lp $USER    # then sign out and back in
```

Without it a receipt printer reached by device path (`/dev/usb/lp0`) is refused
with *permission denied*. Printing through a CUPS queue does not need it. The
*Add* list says which of the two a printer is, and says so against any device it
cannot write to.

### macOS

Needs Rust and the Xcode command line tools (`xcode-select --install`). The
build produces a `.app` and a `.dmg` under
`src-tauri/target/release/bundle/`. A USB receipt printer is added under *System
Settings → Printers & Scanners* first, and then appears under **Add**.

The Linux and macOS bundle targets are set in `src-tauri/tauri.linux.conf.json`
and `src-tauri/tauri.macos.conf.json`, which Tauri merges over
`tauri.conf.json` for the platform being built.

### Or let GitHub build it

`.github/workflows/desktop.yml` builds the same installer on a Windows runner, so
a PC without Rust can still get one.

- **Any push to a branch touching `desktop/`** builds it and replaces that
  branch's pre-release under *Releases* — `desktop-latest-main` for `main` — with
  the new installer, so the newest build of a branch is always one download
  away. *Actions* → *Desktop app* → *Run workflow* does the same on demand.
  Release assets are not in the account's artifact storage quota, so this keeps
  working when that is full.
- **A tag** publishes a release for that version with the installer attached.
  Unlike a branch's pre-release it stays put when later builds come along, which
  makes it the one to point the salon at:

  ```bash
  # the tag must match the version in src-tauri/tauri.conf.json, or the build stops
  git tag desktop-v0.1.0 && git push origin desktop-v0.1.0
  ```
- **A pull request touching `desktop/`** builds it but publishes no release; it
  tries to keep the installer under the run's *Artifacts* for 30 days instead.
  Artifact storage is a quota shared across the whole GitHub account, so that
  upload can be refused with *"Artifact storage quota has been hit"* — the build
  is still marked green, because it built.

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
| **Printer setup**, in the program | Which printer prints which ticket, the roll width, the cut and the cash drawer. Kept in `printers.json`; see [Setting up the printer](#setting-up-the-printer). This is the one to use. |
| `berchi-print.txt` next to the program | Only affects the older way of printing (a web page to the Windows default printer). `dialog` to print through the print dialog, `silent` to print by itself. Silent if the file is missing. |
| `BERCHI_SILENT_PRINT` | `0` for the dialog, `1` for silent. Beats the file, for trying one without committing to it. |
| `BERCHI_PRINTERS_FILE` | Points the printer settings at another file, for one run. Used by the tests so they cannot overwrite a real till's setup. |
| `BERCHI_WEBVIEW_ARGS` | Extra web view options, for diagnosing. |

`http://` and `https://` are both supported. If the address cannot be used, the
window says so instead of waiting forever.

A word nobody recognises in `berchi-print.txt` is passed over rather than guessed
at, so a typo cannot quietly stop the slip printing.

## Setting up the printer

Open **Printer setup** and the program does the rest. There are three ways in,
and the first works on **every screen**:

- The small **Printer** button in the bottom left corner, or **Ctrl+Alt+P**. The
  program puts it on every page it shows, including the salon system's own and
  the sign-in screen, so it is never more than one press away &mdash; and
  including while the salon system is **down**, which is when a printer is
  usually being set up.
- From the salon system: **Admin → Settings → Receipt printer**.

It used to be offered on the *Starting the salon system* screen only. That was a
mistake worth recording: that screen takes itself away the moment the salon
answers, so on a PC that was working properly the button was never there to
press.

The button is put there from outside the salon system, by a script the program
injects (`src-tauri/src/native.js`), in its own shadow root &mdash; so the salon
system's stylesheets cannot reach it and it cannot leak into them. It is not
added to the hidden frame the number slip prints from, and it is hidden when
printing, so it can never come out on a customer's slip.

The window has three parts: the printers this PC knows about, the settings for
the one being edited, and a preview of what will come out. The preview is laid
out by the same code that drives the printer, at the width set in the form, so a
service name that wraps awkwardly on screen wraps awkwardly on paper.

### Adding a printer

**Add** looks for what is attached and offers it. Between them these cover how a
receipt printer is actually wired:

| What is offered | When it is the right one |
|---|---|
| A printer installed on this computer | Its driver is installed and it has a print queue &mdash; *Printers & scanners* on Windows, a CUPS queue on Linux and macOS. The bytes go through the queue as a raw job, so the queue, the offline warning and every other program's access to it keep working. This is the usual answer, and the system default printer is offered first. |
| On the network | It has an Ethernet socket or Wi-Fi. Port 9100 on nearly every receipt printer. Set up by hand, because a printer on the network cannot be found by looking at this PC. |
| Plugged in by USB, no driver installed | **Windows only.** Windows picked it up with its own `usbprint.sys` class driver because nobody installed the disc. It has no print queue, but it is a perfectly good ESC/POS printer. On Linux the same printer is a device path; the option is greyed out there rather than hidden, so a settings file copied from a Windows till still reads correctly. |
| On a serial port | Older tills. `COM1` on Windows, `/dev/ttyUSB0` or `/dev/ttyS0` on Linux. The baud rate has to match the printer, which is usually set with dip switches underneath it. Linux declares 32 serial ports whether or not the hardware exists, so only the ones with a real UART behind them are offered. |
| A device path, or plugged in by USB on Linux | Written to directly as a file. On Windows this is the escape hatch. **On Linux it is a main road**: a USB receipt printer with no CUPS queue is `/dev/usb/lp0`, and for many tills it is the only thing that works. The list says when this account is not allowed to write to one. |

The words in the window follow the computer it is running on, so a Fedora till
is not told about *Printers & scanners* and a Windows one is not told about
`cupsenable`.

### The settings that matter

- **Roll width.** 80 mm is the usual one. Changing it fills in the usual number
  of characters per line (42 for 80 mm, 32 for 58 mm), which stays editable
  because a printer set to a smaller font fits more. The test print has a ruler
  across it for counting.
- **Cutting, and the cut amount.** The cut amount is how much paper is rolled
  out before the blade comes down. It is not decoration: the cutter sits above
  the print head by a centimetre or two, so with no feed the cut lands in the
  middle of the last line of the ticket. Too much and every sale throws paper
  away. Four lines suits most printers. Find the right number for yours by
  printing a test, looking at the paper, and moving the slider &mdash; the test
  prints the printer being edited, unsaved changes and all, so it is quick to go
  round a few times. A printer with no cutter is set to *tear it off by hand*,
  and then no cut command is sent at all.
- **Cash drawer.** Only a cash sale opens it; a card or transfer popping the
  drawer is how a till loses count of what should be in it.
- **What prints where.** The number slip and the receipt are assigned
  separately, because a salon may want the slip at reception and the receipt at
  the till. Both can be the same printer, and the first one added takes both.
  Anything left as *print through the window* keeps working the older way.

Settings are kept in `printers.json` in this program's own settings folder,
under the Windows user's profile. The window shows the full path along the
bottom. They belong to **this PC**: a second till is set up separately.

### Printing the older way

With no printer set up, the ticket is printed as a web page, straight to
**whichever printer Windows has as its default**, with no dialog &mdash;
reception cannot stop to answer one for every customer. The printer is then
chosen in Windows, under *Settings → Bluetooth & devices → Printers & scanners →
Set as default*, and it should be the receipt printer with its paper size set to
the 80 mm roll.

**Chromium flashes the print dialog up for about a second before printing
anyway** ([crbug.com/169004](https://crbug.com/169004)). A dialog that appears
and vanishes on its own is silent printing working, not a fault — it is just not
a chooser, so there is no printer list there to read.

To see the printers Windows offers, and pick one per print, put a file called
`berchi-print.txt` next to the program holding one line:

```
dialog
```

Restart the window and the full dialog stays open, with the printer list and the
paper settings. This is worth doing once while setting the PC up, to confirm the
right printer is the default and the slip comes out at the right width. Delete
the file (or change it to `silent`) before opening day, so reception is not
tapping Print for every customer.

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
2. Build it: push a tag (`git tag desktop-v0.1.0 && git push origin desktop-v0.1.0`),
   push to a branch, or run *Actions → Desktop app → Run workflow*. The address
   is compiled in, so it has to be set before the build, not after. Any build
   that would publish a release fails on purpose with no secret, rather than
   shipping installers that point at `localhost`.
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

### When printing goes wrong

| What you see | Usually means |
|---|---|
First, which way is it printing? If *Printer setup* has a printer assigned to
that ticket, it is going there as ESC/POS. If not, it is being printed as a web
page to the Windows default printer, and the rows about the dialog apply.

| What you see | Usually means |
|---|---|
| A message at the till naming the printer, and the slip came out of the *wrong* printer | The receipt printer could not be reached, so it fell back to the web view and the Windows default printer. The message says why. The slip still came out, which is the point. |
| The cut lands in the middle of the last line | The cut amount is too small. Raise it in *Printer setup* and print a test; the cutter sits above the print head, so some feed is always needed. |
| Every ticket wastes a hand's length of paper | The cut amount is too large. Lower it the same way. |
| Strange characters where a name should be | A thermal printer holds a 256-character table and **Amharic is in none of them**, on any printer. Names in Amharic print as `?`. Accented Latin letters print without their accents, so `René` comes out as `Rene`. |
| Nothing comes out, and the message mentions the print queue | *Settings → Printers & scanners* — the printer is offline, out of paper, or has a job stuck in its queue. |
| **Linux:** "The print queue … is stopped, so nothing sent to it will print" | CUPS stops a queue as soon as one job fails, and then goes on *accepting* jobs into the void. Fix whatever failed, then `cupsenable <queue>`. The *Add* list also marks a stopped queue, and a ticket is refused rather than silently swallowed. `lpstat -p` shows the state and `journalctl -u cups` the reason. |
| **Linux:** "This account is not allowed to use that printer" | A device path such as `/dev/usb/lp0` belongs to the `lp` group. `sudo usermod -aG lp $USER`, then sign out and back in — a new terminal is not enough, the group is read at login. |
| **Linux:** the ticket prints as pages of `ESC @` gibberish | Something sent it without `-o raw`, so CUPS ran it through the `texttotext` filter and typeset the ESC/POS. Printing from *Printer setup* always passes raw; printing the ticket by hand with `lp` does not unless you say so. |
| **Linux:** the printer disappears from *Add* after a failed job | The CUPS `usb` backend detaches the `usblp` kernel driver while it prints and sometimes fails to put it back, which takes `/dev/usb/lp0` with it. Unplugging and replugging the printer brings it back; so does `sudo modprobe -r usblp && sudo modprobe usblp`. |
| Nothing comes out, and the message mentions a port or an address | A network printer that is off or has changed address, or a USB printer another program is holding open. |
| The ticket prints as readable gibberish, full of `ESC` and `@` | The printer is being driven as a page rather than raw. For a Windows printer the job is sent as RAW, so this points at a driver that does not pass raw data through — set that printer up as *plugged in by USB* or *on the network* instead. |
| The ticket is too wide, or wraps in odd places | The characters per line is wrong for the roll. Print a test: it has a ruler across it, and if the last digits fall off the edge or wrap, the number is too high. |
| The print dialog appears and vanishes before you can read it, with no printer list | Printing the older way, working. Chromium flashes the dialog up for about a second before printing by itself ([crbug.com/169004](https://crbug.com/169004)). It is not a chooser: the ticket goes to the Windows default printer. |
| The dialog flashes and nothing comes out | The Windows default printer is the wrong one, offline, or out of paper. *Settings → Printers & scanners* shows which one is the default and whether it has a job stuck in its queue. |
| A printer list would help, but the file is ignored | `berchi-print.txt` has to sit **next to `berchi-cashier.exe`**, not in the folder the shortcut starts in, and the window has to be restarted. Check `BERCHI_SILENT_PRINT` is not also set, because it beats the file. |
| The slip prints the older way, but too wide or cut off | The default printer's paper size is not the 80 mm roll. Set it in the printer's Windows properties. For a 58 mm roll, change `PAPER_WIDTH_MM` in `src/app/slip/[orderId]/page.tsx` and rebuild the salon system. (Set up a printer properly instead and the roll width is a setting, with no rebuild.) |

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
returns to the Starting screen if it goes away again, copes with a bad address
or an address file, and takes the printing setting from `berchi-print.txt` (with
the environment variable beating it, and a typo left printing silently).

Sections **G** and **H** cover the printing added since: that the salon's own
pages may ask what this PC prints on, print a ticket and open the printer setup
— and may **not** read or change the printer settings — that printing with
nothing set up answers "not printed" with a reason rather than failing, and that
the printer setup opens from the *Starting* screen while the salon system is
down. They use `BERCHI_PRINTERS_FILE` so a run cannot scribble on the settings
of the PC it runs on. Run one on its own with `node scripts/verify-shell.mjs G`.

Section **I** checks the browser behaviours are gone — on the salon's own pages,
which is the point, since the script has to reach a page served from a web
server. It also checks the two things that must *not* be taken away: reloading,
and selecting text in a field.

The layout of a ticket, the cut, the character handling and the settings file
are covered by unit tests, which need no printer and run anywhere:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml printing
```

They check the real ESC/POS bytes — that a ticket starts by initialising, that
two copies really are two tickets, that a printer set to *tear it off by hand*
is never sent a cut — against a driver that keeps the bytes instead of printing
them.

**Not checked: a real printer.** Nothing automated puts ink on paper, because it
would print on whatever the PC has. Use *Print a test ticket* in *Printer setup*
with your own printer before relying on it, and judge the cut amount by the
paper rather than by the screen.

## Layout

- `src/`: the screens the program shows itself. `index.html` (*Starting*) and
  `problem.html` (bad address) are plain HTML with one small script (the 30
  second hint; the printer button is injected by the program, on every screen);
  `printers.html` with `printers.js` and `printers.css` is the printer setup.
  No network, no bundler, nothing fetched from anywhere.
- `src-tauri/src/lib.rs`: the shell itself: the address, the watching, the
  window, the rules about where it may go, and the permission that lets the
  salon's own pages print.
- `src-tauri/src/native.js`: injected into every page before its own scripts
  run, including the salon system's. Takes away the browser behaviours that have
  no place on a till, and puts the way in to the printer setup on every screen.
  Nothing else — it deliberately does not style or intercept anything the salon
  system does, so there is nothing for it to disagree with.
- `src-tauri/src/printing/`: everything about printing a ticket.
  - `settings.rs`: what this PC knows about its printers, and reading and
    writing `printers.json`.
  - `discovery.rs`: what printers this PC can see, on all three platforms.
  - `transport.rs`: getting bytes to a printer, including the Windows print
    spooler, which `escpos` has no driver for.
  - `cups.rs`: the Linux and macOS half of that — the `lp` and `lpstat`
    conversation, run in the C locale so it can be read back on a PC set up in
    any language, and the check that refuses a queue CUPS has stopped.
  - `doc.rs`: a ticket described rather than printed, and the column arithmetic.
  - `ticket.rs`: what the salon system sends, and the two templates.
  - `render.rs`: a described ticket as ESC/POS, or as characters for the
    preview — the same layout code either way.
  - `mod.rs`: the commands the rest of the program and the salon system call.
- `src-tauri/capabilities/`: what the program's own screens may do. What the
  *salon's* pages may do is granted at start-up instead, in
  `printing::salon_capability`, because the salon's address is not known until
  then.
- `scripts/verify-shell.mjs`: the check above.
