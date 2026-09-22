// The printer settings window.
//
// It talks to the Rust side (src-tauri/src/printing/) for everything real:
// finding printers, reading and writing the settings file, laying a ticket out,
// and printing a test. Nothing about a ticket is worked out here -- the preview
// is rendered by the same code that drives the printer, so that what is on
// screen is what comes out of the roll.
//
// Plain script, no bundler and nothing fetched from the network: this page is
// served from inside the program and has to work on a salon PC with no internet.

const invoke = window.__TAURI__.core.invoke;

/** Everything on screen. `settings` is edited in place as the form is used. */
const state = {
  settings: { version: 1, printers: [], jobs: { slip: null, receipt: null } },
  path: "",
  chosen: null, // printer id
  sample: "receipt",
  unsaved: false,
  // Until the program says otherwise. Asked for in start(), and every word on
  // this page that differs between operating systems comes from it.
  platform: "windows",
};

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// The words for this computer
// ---------------------------------------------------------------------------

// The same window runs on a Windows till, a Fedora one and a Mac, and the three
// do not share a vocabulary. A printer is installed in *Printers & scanners* or
// it is a CUPS queue; a serial port is COM1 or /dev/ttyUSB0; a USB printer with
// no driver is a Windows class-driver device or a node under /dev/usb.
//
// Getting this wrong is not cosmetic. A page that says "Windows" on a Fedora PC
// reads as a program that does not support the computer it is running on, and
// the setting somebody needed -- a device path -- is the one they never try.
const WORDS = {
  windows: {
    systemPrinter: "A printer installed in Windows",
    describeSystem: (name) => `Windows printer "${name}"`,
    systemHint:
      "Exactly as it is spelt in Windows, under Printers & scanners. " +
      "Add is the easier way to get this right.",
    defaultBadge: "Windows default",
    serial: "On a serial (COM) port",
    serialPlaceholder: "COM1",
    serialHint: "COM1, COM3, and so on.",
    device: "A device path",
    devicePlaceholder: "\\\\.\\LPT1",
    deviceHint: "Written to directly, as a file.",
    nothingFound:
      "Nothing found attached to this computer. A printer on the network is set up by hand.",
    noPrinters:
      "No printer set up yet. Until one is, tickets print the old way — through the " +
      "window, to whichever printer Windows has as its default.",
  },

  linux: {
    systemPrinter: "A print queue on this computer (CUPS)",
    describeSystem: (name) => `print queue "${name}"`,
    systemHint:
      "The queue name, exactly as CUPS spells it -- lpstat -a lists them. " +
      "Add is the easier way to get this right.",
    defaultBadge: "System default",
    serial: "On a serial port",
    serialPlaceholder: "/dev/ttyUSB0",
    serialHint: "/dev/ttyUSB0 for a USB adapter, /dev/ttyS0 for a built-in port.",
    // On Linux this is not the escape hatch it is on Windows: a receipt printer
    // plugged in with no CUPS queue is reached exactly this way, and for many
    // tills it is the only way that works.
    device: "Plugged in by USB, or another device path",
    devicePlaceholder: "/dev/usb/lp0",
    deviceHint:
      "/dev/usb/lp0 for a USB receipt printer with no queue. If printing is refused, " +
      "this account needs the printer group:  sudo usermod -aG lp $USER  then sign in again.",
    nothingFound:
      "Nothing found attached to this computer. Check the printer is switched on and plugged " +
      "in, or set one up by hand from its network address or device path.",
    // Worth saying outright rather than leaving to be discovered: silent
    // printing through the window is a Windows-only web view option, so on
    // Linux the fallback stops to ask which printer, for every customer.
    noPrinters:
      "No printer set up yet, so tickets fall back to printing through the window — which " +
      "on Linux stops to ask, for every customer. Set a printer up here and they print by " +
      "themselves.",
  },

  macos: {
    systemPrinter: "A printer set up on this Mac",
    describeSystem: (name) => `print queue "${name}"`,
    systemHint:
      "The queue name, as it appears under System Settings -> Printers & Scanners. " +
      "Add is the easier way to get this right.",
    defaultBadge: "System default",
    serial: "On a serial port",
    serialPlaceholder: "/dev/cu.usbserial",
    serialHint: "Usually /dev/cu.something for a USB adapter.",
    device: "A device path",
    devicePlaceholder: "/dev/cu.usbmodem",
    deviceHint: "Written to directly, as a file.",
    nothingFound:
      "Nothing found attached to this computer. A USB receipt printer on macOS is added under " +
      "System Settings -> Printers & Scanners first, or set one up by its network address.",
    noPrinters:
      "No printer set up yet, so tickets fall back to printing through the window — which " +
      "on macOS stops to ask, for every customer. Set a printer up here and they print by " +
      "themselves.",
  },
};

/** The words for the computer this is running on. */
const words = () => WORDS[state.platform] ?? WORDS.windows;

// ---------------------------------------------------------------------------
// Talking to the program
// ---------------------------------------------------------------------------

/** The message out of a failed command, which Rust sends as a plain string. */
const reason = (error) => (typeof error === "string" ? error : error?.message ?? String(error));

let toastTimer = null;
function say(message, tone = "") {
  const toast = $("toast");
  toast.textContent = message;
  toast.className = `toast ${tone}`.trim();
  toast.hidden = false;
  clearTimeout(toastTimer);
  // Long enough to read a printer error, which is the longest thing shown here.
  toastTimer = setTimeout(() => (toast.hidden = true), tone === "bad" ? 9000 : 3500);
}

// ---------------------------------------------------------------------------
// Drawing the page
// ---------------------------------------------------------------------------

const chosenPrinter = () => state.settings.printers.find((p) => p.id === state.chosen) ?? null;

/** How a connection reads in the list, in the same words the program uses. */
function describe(connection) {
  switch (connection.kind) {
    case "systemPrinter":
      return words().describeSystem(connection.name);
    case "network":
      return `${connection.host} on port ${connection.port}`;
    case "usbClass":
      return "Plugged in by USB";
    case "serial":
      return `${connection.path} at ${connection.baudRate} baud`;
    case "device":
      return connection.path;
    default:
      return "Set up by hand";
  }
}

function drawPrinterList() {
  const list = $("printer-list");
  list.replaceChildren();

  for (const printer of state.settings.printers) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-current", String(printer.id === state.chosen));

    const who = document.createElement("span");
    who.className = "who";
    who.textContent = printer.name || "Unnamed printer";

    const how = document.createElement("span");
    how.className = "how";
    how.textContent = describe(printer.connection);

    button.append(who, how);
    button.addEventListener("click", () => {
      state.chosen = printer.id;
      draw();
    });

    const item = document.createElement("li");
    item.append(button);
    list.append(item);
  }

  $("no-printers").hidden = state.settings.printers.length > 0;
}

function drawJobs() {
  for (const [job, id] of [
    ["slip", "job-slip"],
    ["receipt", "job-receipt"],
  ]) {
    const select = $(id);
    select.replaceChildren();

    const none = document.createElement("option");
    none.value = "";
    none.textContent = "Print through the window (as before)";
    select.append(none);

    for (const printer of state.settings.printers) {
      const option = document.createElement("option");
      option.value = printer.id;
      option.textContent = printer.name || "Unnamed printer";
      select.append(option);
    }

    select.value = state.settings.jobs[job] ?? "";
  }
}

/** The fields that only make sense for one way of attaching a printer. */
function drawConnectionFields() {
  const printer = chosenPrinter();
  const holder = $("connection-fields");
  holder.replaceChildren();
  if (!printer) return;

  const connection = printer.connection;

  const text = (label, key, hint, attributes = {}) => {
    const field = document.createElement("label");
    field.className = "field";

    const caption = document.createElement("span");
    caption.textContent = label;

    const input = document.createElement("input");
    input.type = attributes.type ?? "text";
    input.value = connection[key] ?? "";
    for (const [name, value] of Object.entries(attributes)) input.setAttribute(name, value);
    input.addEventListener("input", () => {
      connection[key] = input.type === "number" ? Number(input.value) : input.value;
      touched();
    });

    field.append(caption, input);
    if (hint) {
      const small = document.createElement("small");
      small.textContent = hint;
      field.append(small);
    }
    holder.append(field);
    return input;
  };

  switch (connection.kind) {
    case "systemPrinter":
      text("Printer name", "name", words().systemHint);
      break;

    case "network":
      text("Address", "host", "The printer's own address on the salon network.", {
        placeholder: "192.168.1.60",
      });
      text("Port", "port", "9100 on nearly every receipt printer.", {
        type: "number",
        min: 1,
        max: 65535,
      });
      break;

    case "usbClass":
      text(
        "Device path",
        "devicePath",
        "Windows works this out. Use Add rather than typing it.",
      );
      break;

    case "serial":
      text("Port", "path", words().serialHint, { placeholder: words().serialPlaceholder });
      text(
        "Baud rate",
        "baudRate",
        "Has to match the printer, which is usually set with dip switches underneath it.",
        { type: "number", min: 300, max: 921600 },
      );
      break;

    case "device":
      text("Path", "path", words().deviceHint, { placeholder: words().devicePlaceholder });
      break;
  }
}

function drawEditor() {
  const printer = chosenPrinter();
  $("editor").hidden = !printer;
  $("empty").hidden = Boolean(printer) || state.settings.printers.length === 0;
  if (!printer) return;

  $("name").value = printer.name;
  $("connection-kind").value = printer.connection.kind;
  $("paper-width").value = String(printer.paper.widthMm);
  $("characters").value = printer.paper.charactersPerLine;
  $("cut-mode").value = printer.cut.mode;
  $("feed-lines").value = printer.cut.feedLines;
  $("feed-value").textContent = `${printer.cut.feedLines} line${printer.cut.feedLines === 1 ? "" : "s"}`;
  $("drawer-open").checked = printer.cashDrawer.openOnCashSale;
  $("drawer-pin").value = printer.cashDrawer.pin;
  $("copies").value = printer.copies;
  $("header").value = printer.header.join("\n");
  $("footer").value = printer.footer.join("\n");

  drawConnectionFields();
}

function drawSavedState() {
  const label = $("saved-state");
  label.textContent = state.unsaved ? "Not saved yet" : "";
  label.className = state.unsaved ? "saved-state unsaved" : "saved-state";
  $("save").disabled = !state.unsaved;
}

function drawTabs() {
  for (const tab of $("preview-tabs").querySelectorAll("button")) {
    tab.setAttribute("aria-selected", String(tab.dataset.sample === state.sample));
  }
}

function draw() {
  drawPrinterList();
  drawJobs();
  drawEditor();
  drawSavedState();
  drawTabs();
  drawPreview();
}

// ---------------------------------------------------------------------------
// The preview
// ---------------------------------------------------------------------------

let previewTimer = null;

/** Redraws the paper, a moment after the last keystroke rather than on each. */
function drawPreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(async () => {
    const printer = chosenPrinter();
    if (!printer) {
      $("preview").textContent = "";
      return;
    }
    try {
      $("preview").textContent = await invoke("preview_ticket", {
        printer,
        sample: state.sample,
      });
    } catch (error) {
      $("preview").textContent = reason(error);
    }
  }, 120);
}

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

/** Something changed: the Save button wakes up and the paper is redrawn. */
function touched({ redrawList = false } = {}) {
  state.unsaved = true;
  drawSavedState();
  if (redrawList) {
    drawPrinterList();
    drawJobs();
  }
  drawPreview();
}

/** Wires one form control to one field of the chosen printer. */
function bind(id, apply, options = {}) {
  const element = $(id);
  element.addEventListener(options.event ?? "input", () => {
    const printer = chosenPrinter();
    if (!printer) return;
    apply(printer, element);
    touched(options);
  });
}

function newId() {
  return crypto.randomUUID?.() ?? `printer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Adds a printer and selects it, ready to be named. */
function add(connection, name) {
  const printer = {
    id: newId(),
    name,
    connection,
    paper: { widthMm: 80, charactersPerLine: 42 },
    cut: { mode: "full", feedLines: 4 },
    cashDrawer: { openOnCashSale: false, pin: "pin2" },
    copies: 1,
    header: [],
    footer: [],
  };

  state.settings.printers.push(printer);
  state.chosen = printer.id;

  // The first printer set up takes both tickets. That is what a salon with one
  // receipt printer wants, and it saves a step nobody would understand skipping.
  if (state.settings.printers.length === 1) {
    state.settings.jobs.slip = printer.id;
    state.settings.jobs.receipt = printer.id;
  }

  state.unsaved = true;
  draw();
  $("name").focus();
  $("name").select();
}

// ---------------------------------------------------------------------------
// Finding printers
// ---------------------------------------------------------------------------

async function openAddDialog() {
  const dialog = $("add-dialog");
  const list = $("candidates");
  list.replaceChildren();
  $("looking").hidden = false;
  $("candidate-problems").hidden = true;
  dialog.showModal();

  let found;
  try {
    found = await invoke("list_printers");
  } catch (error) {
    $("looking").hidden = true;
    $("candidate-problems").textContent = reason(error);
    $("candidate-problems").hidden = false;
    return;
  }

  $("looking").hidden = true;

  if (found.problems.length > 0) {
    $("candidate-problems").textContent = found.problems.join(" ");
    $("candidate-problems").hidden = false;
  }

  if (found.printers.length === 0) {
    $("looking").textContent = words().nothingFound;
    $("looking").hidden = false;
    return;
  }

  for (const candidate of found.printers) {
    const button = document.createElement("button");
    button.type = "button";

    const who = document.createElement("span");
    who.className = "who";
    who.textContent = candidate.label;
    if (candidate.isDefault) {
      const badge = document.createElement("span");
      badge.className = "is-default";
      badge.textContent = words().defaultBadge;
      who.append(badge);
    }

    const how = document.createElement("span");
    how.className = "how";
    how.textContent = candidate.detail ?? "";

    button.append(who, how);
    button.addEventListener("click", () => {
      dialog.close();
      add(candidate.connection, candidate.label);
    });

    const item = document.createElement("li");
    item.append(button);
    list.append(item);
  }
}

// ---------------------------------------------------------------------------
// Saving, testing, removing
// ---------------------------------------------------------------------------

/** Text areas hold one line each; blank lines are dropped. */
const lines = (value) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

async function save() {
  try {
    const stored = await invoke("save_printer_settings", { settings: state.settings });
    state.settings = stored.settings;
    state.path = stored.path;
    state.unsaved = false;

    // Saving tidies: a cut amount beyond what a roll can stand is pulled back,
    // so the form has to show what was actually kept.
    if (!state.settings.printers.some((printer) => printer.id === state.chosen)) {
      state.chosen = state.settings.printers[0]?.id ?? null;
    }
    draw();
    say("Saved. Tickets will print here from now on.", "good");
  } catch (error) {
    say(reason(error), "bad");
  }
}

async function test() {
  const printer = chosenPrinter();
  if (!printer) return;

  const button = $("test");
  button.disabled = true;
  button.textContent = "Printing…";
  try {
    await invoke("test_print", { printer });
    say("Sent. Check what came out, especially where the paper was cut.", "good");
  } catch (error) {
    say(reason(error), "bad");
  } finally {
    button.disabled = false;
    button.textContent = "Print a test ticket";
  }
}

function remove() {
  const printer = chosenPrinter();
  if (!printer) return;
  if (!confirm(`Remove "${printer.name || "this printer"}" from this computer?`)) return;

  state.settings.printers = state.settings.printers.filter((p) => p.id !== printer.id);

  // A ticket pointed at a printer that is gone would stop printing with nothing
  // on screen to say why, so it goes back to printing through the window.
  for (const job of ["slip", "receipt"]) {
    if (state.settings.jobs[job] === printer.id) state.settings.jobs[job] = null;
  }

  state.chosen = state.settings.printers[0]?.id ?? null;
  state.unsaved = true;
  draw();
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

bind("name", (printer, element) => (printer.name = element.value), { redrawList: true });

bind(
  "connection-kind",
  (printer, element) => {
    // Each way of attaching a printer needs different details, so switching
    // starts that part again rather than carrying over a host as a COM port.
    printer.connection = blankConnection(element.value);
    drawConnectionFields();
  },
  { event: "change", redrawList: true },
);

bind(
  "paper-width",
  (printer, element) => {
    printer.paper.widthMm = Number(element.value);
    // The usual character count for that roll, as a starting point. It stays
    // editable, because a printer set to a smaller font fits more.
    printer.paper.charactersPerLine = printer.paper.widthMm <= 58 ? 32 : 42;
    $("characters").value = printer.paper.charactersPerLine;
  },
  { event: "change" },
);

bind("characters", (printer, element) => (printer.paper.charactersPerLine = Number(element.value)));
bind("cut-mode", (printer, element) => (printer.cut.mode = element.value), { event: "change" });

bind("feed-lines", (printer, element) => {
  printer.cut.feedLines = Number(element.value);
  $("feed-value").textContent = `${printer.cut.feedLines} line${printer.cut.feedLines === 1 ? "" : "s"}`;
});

bind("drawer-open", (printer, element) => (printer.cashDrawer.openOnCashSale = element.checked), {
  event: "change",
});
bind("drawer-pin", (printer, element) => (printer.cashDrawer.pin = element.value), {
  event: "change",
});
bind("copies", (printer, element) => (printer.copies = Number(element.value)));
bind("header", (printer, element) => (printer.header = lines(element.value)));
bind("footer", (printer, element) => (printer.footer = lines(element.value)));

for (const [job, id] of [
  ["slip", "job-slip"],
  ["receipt", "job-receipt"],
]) {
  $(id).addEventListener("change", (event) => {
    state.settings.jobs[job] = event.target.value || null;
    touched();
  });
}

for (const tab of $("preview-tabs").querySelectorAll("button")) {
  tab.addEventListener("click", () => {
    state.sample = tab.dataset.sample;
    drawTabs();
    drawPreview();
  });
}

$("add").addEventListener("click", openAddDialog);
$("add-cancel").addEventListener("click", () => $("add-dialog").close());
$("add-manual").addEventListener("click", () => {
  $("add-dialog").close();
  add(blankConnection("network"), "Receipt printer");
});
$("save").addEventListener("click", save);
$("test").addEventListener("click", test);
$("remove").addEventListener("click", remove);
$("close").addEventListener("click", () => {
  if (state.unsaved && !confirm("Close without saving the changes?")) return;
  window.__TAURI__.window.getCurrentWindow().close();
});

/** A connection of the given kind, with nothing filled in but the defaults. */
function blankConnection(kind) {
  switch (kind) {
    case "network":
      return { kind, host: "", port: 9100 };
    case "usbClass":
      return { kind, devicePath: "" };
    case "serial":
      return { kind, path: "", baudRate: 9600 };
    case "device":
      return { kind, path: "" };
    default:
      return { kind: "systemPrinter", name: "" };
  }
}

// Ctrl+S, because this is a form somebody will be going back and forth over
// while watching what comes out of the printer.
window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "s") {
    event.preventDefault();
    if (state.unsaved) save();
  }
});

// ---------------------------------------------------------------------------

/** Makes the ways-to-attach-a-printer list say what this computer can do. */
function applyPlatform() {
  const option = (value) =>
    $("connection-kind").querySelector(`option[value="${value}"]`);

  option("systemPrinter").textContent = words().systemPrinter;
  option("serial").textContent = words().serial;
  option("device").textContent = words().device;
  $("no-printers").textContent = words().noPrinters;

  // "Plugged in by USB, no driver installed" is reached through a Windows
  // driver, so off Windows it can only ever fail. It stays in the list rather
  // than vanishing -- a settings file copied from a Windows till has to still
  // show what it says -- but it cannot be chosen, and it says why.
  const usb = option("usbClass");
  if (state.platform === "windows") {
    usb.disabled = false;
    usb.textContent = "Plugged in by USB, no driver installed";
  } else {
    usb.disabled = true;
    usb.textContent = "Plugged in by USB, no driver installed (Windows only)";
  }
}

async function start() {
  try {
    const stored = await invoke("printer_settings");
    state.settings = stored.settings;
    state.path = stored.path;
    state.platform = stored.platform ?? state.platform;
    state.chosen = state.settings.printers[0]?.id ?? null;
  } catch (error) {
    say(reason(error), "bad");
  }
  applyPlatform();
  $("path").textContent = state.path ? `Kept in ${state.path}` : "";
  draw();
}

start();
