// The only script on the waiting screen, and on the bad-address screen. It does
// two small things. The program itself (Rust) watches for the server and moves
// on to the cashier screens, so neither page needs telling when that happens.

// 1. If the salon system has not answered after 30 seconds, show the hint.
const hint = document.getElementById("hint");
if (hint) {
  setTimeout(() => {
    hint.hidden = false;
  }, 30_000);
}

// 2. Offer the printer setup.
//
// This is deliberately reachable from the screen shown when the salon system is
// *down*. Setting a printer up is work for before opening, often on a PC whose
// Docker stack is not running yet, and the rest of the setup lives behind a
// login on a server that may not be answering. Waiting for the salon to come up
// before the printer can be chosen would be the wrong way round.
// The button is always shown. An earlier version hid it unless the way into the
// program could be found, which turned "something is wrong" into "there is no
// such button" -- the one failure nobody can report, because there is nothing on
// screen to report. Better to offer it and say what went wrong when it is
// pressed.
const setup = document.getElementById("printer-setup");
const trouble = document.getElementById("printer-setup-trouble");

function explain(text) {
  if (!trouble) return;
  trouble.textContent = text;
  trouble.hidden = false;
}

if (setup) {
  setup.addEventListener("click", () => {
    const open = window.__TAURI__?.core?.invoke;
    if (!open) {
      explain(
        "This window cannot reach the program, so the printer setup cannot open. " +
          "That usually means an older Berchi Cashier is installed: close it completely " +
          "and install the newest one over the top.",
      );
      return;
    }
    open("open_printer_settings").catch((error) => {
      explain(`Could not open the printer setup: ${typeof error === "string" ? error : error}`);
    });
  });
}
