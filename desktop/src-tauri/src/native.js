// Runs in the cashier window before any page's own scripts, on every page it
// shows -- including the salon system, which is served from a web server and
// knows nothing about this program.
//
// Its whole job is to take away the handful of behaviours that give a web view
// away as a browser. It changes nothing about what the salon system *does*: no
// styling of the app, no intercepting of its events, nothing it could break by
// disagreeing with. It only stops the browser doing things a till should not do.
//
// Deliberately NOT taken away: reloading with F5 or Ctrl+R. It is the only way
// back from a page that has wedged, and the watching thread in lib.rs does not
// cover that -- it only notices the *server* going away. A till that cannot be
// un-stuck without the Task Manager is worse than one that feels slightly like
// a browser.
(() => {
  "use strict";

  // If anything here fails it must not take the salon system down with it: a
  // cashier who cannot ring up a sale is a much worse problem than a right-click
  // menu appearing.
  try {
    // ---------------------------------------------------------------------
    // The right-click menu
    // ---------------------------------------------------------------------
    // The web view's own menu offers Back, Reload, Save as and Print. None of
    // them belong on a till, and between them they say "this is a web page"
    // louder than anything else on screen.
    document.addEventListener("contextmenu", (event) => event.preventDefault());

    // ---------------------------------------------------------------------
    // Dropped files
    // ---------------------------------------------------------------------
    // Dropping a file on a page that does not handle it makes a browser open
    // the file. Tauri's own handler already swallows drops from Explorer; this
    // covers the rest.
    for (const name of ["dragover", "drop"]) {
      window.addEventListener(name, (event) => event.preventDefault());
    }

    // ---------------------------------------------------------------------
    // Browser furniture on the keyboard
    // ---------------------------------------------------------------------
    window.addEventListener("keydown", (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();

      // Ctrl+F opens the browser's find bar over the top of the till, and
      // Ctrl+P its print dialog -- the salon system has its own search boxes
      // and its own print buttons, which do the right thing with the receipt
      // printer. Ctrl+ +/-/0 zoom the whole page, which on a fixed till screen
      // only ever happens by accident. (The mouse wheel is turned off natively,
      // by zoom_hotkeys_enabled in lib.rs.)
      if (["f", "p", "+", "-", "=", "0"].includes(key)) {
        event.preventDefault();
      }
    });

    // ---------------------------------------------------------------------
    // Selecting text by dragging
    // ---------------------------------------------------------------------
    // Dragging across the screen turning labels and headings blue is the thing
    // that reads most like a web page. Fields keep their selection, so a phone
    // number or a reference can still be copied out of one, and anything the
    // salon system marks with data-selectable is left alone.
    const style = document.createElement("style");
    style.textContent = `
      html, body { overscroll-behavior: none; }
      body { -webkit-user-select: none; user-select: none; }
      input, textarea, select, [contenteditable="true"], [data-selectable],
      [data-selectable] * {
        -webkit-user-select: auto; user-select: auto;
      }

      /* A till's scrollbar rather than the browser's. Thin, and out of the way
         until there is something to scroll. */
      * { scrollbar-width: thin; scrollbar-color: rgba(15, 23, 42, 0.25) transparent; }
      ::-webkit-scrollbar { width: 10px; height: 10px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb {
        background: rgba(15, 23, 42, 0.22);
        border: 2px solid transparent;
        border-radius: 6px;
        background-clip: content-box;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: rgba(15, 23, 42, 0.34);
        background-clip: content-box;
      }

      /* Printing must not inherit any of this: the number slip and the receipt
         are printed through the web view when no receipt printer is set up. */
      @media print {
        body { -webkit-user-select: auto; user-select: auto; }
      }
    `;

    // This script runs before the document has been parsed, so there is often
    // no <head> to put the styles in yet.
    const attach = () => (document.head || document.documentElement)?.appendChild(style);
    if (document.head) {
      attach();
    } else {
      document.addEventListener("DOMContentLoaded", attach, { once: true });
    }
  } catch (error) {
    // Nowhere to report it to, and nothing that would be improved by stopping.
    console.error("berchi-cashier: could not settle the window in", error);
  }
})();
