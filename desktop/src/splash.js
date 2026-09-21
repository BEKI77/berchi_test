// The only script on the waiting screen. It does one thing: if the salon
// system has not answered after 30 seconds, show the hint. The program itself
// (Rust) watches for the server and moves on to the cashier screens, so this
// page needs nothing from it -- it has no access to the computer at all.
setTimeout(() => {
  document.getElementById("hint").hidden = false;
}, 30_000);
