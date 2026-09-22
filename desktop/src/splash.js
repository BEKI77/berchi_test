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
const setup = document.getElementById("printer-setup");
if (setup) {
  // Only offered once it is known to work. On the off chance this page is ever
  // opened outside the program, a button that does nothing is worse than none.
  const open = window.__TAURI__?.core?.invoke;
  if (open) {
    setup.hidden = false;
    setup.addEventListener("click", () => {
      open("open_printer_settings").catch((error) => {
        setup.textContent = typeof error === "string" ? error : "Could not open the printer setup";
      });
    });
  }
}
