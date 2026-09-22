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

  // Declared up here, not beside the code that uses it: the printer button is
  // added while this script is still running, so anything it touches has to
  // exist by then.
  const HOST_ID = "berchi-printer-setup";
  let complaintTimer = null;

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

      // The way to the printer setup that does not need the mouse.
      if (event.altKey && key === "p") {
        event.preventDefault();
        openPrinterSetup();
        return;
      }
      if (event.altKey) return;

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

    // ---------------------------------------------------------------------
    // The way in to the printer setup
    // ---------------------------------------------------------------------
    // On every screen, because there is no other reliable moment to catch. It
    // used to be offered only on the Starting screen, which is exactly the
    // screen that disappears by itself as soon as the salon system answers --
    // so on a PC that is working properly it was never there to press.
    //
    // Bottom left, which is the one corner nothing else uses: the salon system
    // puts its messages top right, and the checkout's total bar starts at the
    // edge of the sidebar.
    whenBodyExists(addPrinterButton);
  } catch (error) {
    // Nowhere to report it to, and nothing that would be improved by stopping.
    console.error("berchi-cashier: could not settle the window in", error);
  }

  // -----------------------------------------------------------------------

  function whenBodyExists(run) {
    if (document.body) {
      run();
    } else {
      document.addEventListener("DOMContentLoaded", run, { once: true });
    }
  }

  /// Opens the printer setup, and says so if it cannot.
  ///
  /// The way in is looked up when it is used, never kept from when this script
  /// ran: this runs before the page's own scripts, which is before Tauri's own
  /// API has been put on the window.
  function openPrinterSetup() {
    const invoke = window.__TAURI__?.core?.invoke;
    if (!invoke) {
      complain(
        "This window cannot reach the program. An older Berchi Cashier is " +
          "probably installed: close it completely and install the newest one.",
      );
      return;
    }
    invoke("open_printer_settings").catch((error) => complain(String(error)));
  }

  function complain(text) {
    const say = document.getElementById(HOST_ID)?.shadowRoot?.querySelector(".trouble");
    if (!say) {
      console.error("berchi-cashier:", text);
      return;
    }
    say.textContent = text;
    say.hidden = false;
    clearTimeout(complaintTimer);
    complaintTimer = setTimeout(() => (say.hidden = true), 12000);
  }

  function addPrinterButton() {
    // The print frame the salon system uses for the number slip gets this
    // script too, and a button printed onto a customer's slip would be a poor
    // joke. Top-level page only.
    if (window.top !== window.self) return;
    if (document.getElementById(HOST_ID)) return;

    const host = document.createElement("div");
    host.id = HOST_ID;

    // Its own shadow root, so the salon system's stylesheets cannot reach in
    // and this cannot leak out. Neither side has to know about the other.
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          position: fixed;
          left: 10px;
          bottom: 10px;
          z-index: 2147483000;
          font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
        }
        /* Never on paper: the slip and the receipt are printed through this
           window when no receipt printer is set up. */
        @media print { :host { display: none !important; } }

        button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 11px 6px 9px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.92);
          color: #475569;
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 1px 4px rgba(15, 23, 42, 0.12);
          opacity: 0.72;
          transition: opacity 0.15s, color 0.15s, border-color 0.15s;
        }
        button:hover, button:focus-visible {
          opacity: 1;
          color: #be185d;
          border-color: #f9a8d4;
          outline: none;
        }
        svg { width: 14px; height: 14px; }

        .trouble {
          max-width: 21rem;
          margin-bottom: 6px;
          padding: 8px 11px;
          border: 1px solid #fecaca;
          border-radius: 8px;
          background: #fef2f2;
          color: #991b1b;
          font-size: 12px;
          line-height: 1.45;
        }
        .trouble[hidden] { display: none; }
      </style>
      <p class="trouble" hidden></p>
      <button type="button" title="Printer setup (Ctrl+Alt+P)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M6 9V2h12v7" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <path d="M6 14h12v8H6z" />
        </svg>
        Printer
      </button>
    `;

    root.querySelector("button").addEventListener("click", openPrinterSetup);
    document.body.appendChild(host);
  }
})();
