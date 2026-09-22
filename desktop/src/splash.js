// The only script on the waiting screen. It does one thing: if the salon
// system has not answered after 30 seconds, show the hint. The program itself
// (Rust) watches for the server and moves on to the cashier screens, so this
// page needs nothing from it.
//
// The way in to the printer setup is not here. It used to be, and that was the
// mistake: this screen disappears by itself the moment the salon system answers,
// so on a PC that is working properly the button was never there to press. The
// program now puts it on every screen instead -- see src-tauri/src/native.js.
setTimeout(() => {
  document.getElementById("hint").hidden = false;
}, 30_000);
