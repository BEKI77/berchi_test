// Launches the real berchi-cashier.exe and checks how it behaves, by driving its
// web view through WebView2's debug port. (BERCHI_WEBVIEW_ARGS is the program's
// own knob for passing that port in.)
//
//   cd desktop
//   cargo build --manifest-path src-tauri/Cargo.toml     # once, or after a change
//   SALON_URL=http://localhost:3000 npm run verify        # the salon system must be running
//
// Windows only. Silent printing is deliberately NOT exercised: it would print on
// the default printer. The test only checks that the option is passed.
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXE = process.env.SHELL_EXE ?? path.join(HERE, "../src-tauri/target/debug/berchi-cashier.exe");
const SALON = process.env.SALON_URL ?? "http://localhost:3000";
const SALON_ORIGIN = new URL(SALON).origin;
const DEBUG_PORT = 9444;
const which = process.argv[2] ?? "all";

if (!fs.existsSync(EXE)) {
  console.error(`Cannot find ${EXE}. Build it first (see the top of this file).`);
  process.exit(2);
}

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  <- " + detail}`);
  if (!ok) failures++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const killApp = () => { try { execSync("taskkill /IM berchi-cashier.exe /F", { stdio: "ignore" }); } catch { /* not running */ } };

function launch(env = {}, exe = EXE) {
  killApp();
  return spawn(exe, [], {
    env: { ...process.env, BERCHI_WEBVIEW_ARGS: `--remote-debugging-port=${DEBUG_PORT}`, ...env },
    stdio: "ignore",
  });
}

async function attach() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) {
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
        let id = 0;
        const pending = new Map();
        ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
        const send = (method, params = {}) => new Promise((res) => { const i2 = ++id; pending.set(i2, res); ws.send(JSON.stringify({ id: i2, method, params })); });
        const evalJs = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
        return { evalJs, close: () => ws.close() };
      }
    } catch { /* not up yet */ }
    await sleep(500);
  }
  throw new Error("could not attach to the web view");
}

async function waitFor(fn, ms) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try { if (await fn()) return Date.now() - start; } catch { /* keep trying */ }
    await sleep(400);
  }
  return null;
}

// A port nothing is listening on.
const freePort = () => new Promise((resolve) => {
  const s = net.createServer().listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

const powershell = (command) => execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${command.replace(/"/g, '\\"')}"`).toString().trim();

// The options the web view was actually started with. This is the only way to
// see them: they are handed to WebView2 at creation and are not readable from
// the page.
const webviewArgs = () => powershell("(Get-CimInstance Win32_Process -Filter \"Name='msedgewebview2.exe'\" | Where-Object { $_.CommandLine -like '*com.berchi.cashier*' } | Select-Object -First 1).CommandLine");

// ---------------------------------------------------------------------------
if (which === "all" || which === "A") {
  console.log(`\nA. The salon system is up (${SALON}): the window opens it`);
  const app = launch({ BERCHI_URL: SALON });
  const page = await attach();
  const took = await waitFor(async () => (await page.evalJs("location.origin")) === SALON_ORIGIN, 20000);
  check("hands over from the Starting screen to the salon system", took !== null, await page.evalJs("location.href"));
  await sleep(1500);
  check("it is the real app (login screen)", (await page.evalJs("document.body.innerText")).includes("Sign In"));

  const win = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${path.join(HERE, "winstate.ps1")}"`).toString().trim();
  check("the window opens maximized (Windows says so)", win.includes("maximized=True"), win);
  check("the window is titled Berchi Cashier", win.includes("title=Berchi Cashier"), win);

  await page.evalJs("location.href = 'https://example.com/'");
  await sleep(3000);
  check("it refuses to navigate away from the salon system", (await page.evalJs("location.origin")) === SALON_ORIGIN, await page.evalJs("location.href"));

  const args = webviewArgs();
  check("web view was started with silent printing (--kiosk-printing)", args.includes("--kiosk-printing"), args.slice(0, 200));
  check("...and kept Tauri's own default options", args.includes("--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection"), args.slice(0, 200));

  console.log("\nB. A second launch does not open a second cashier");
  spawn(EXE, [], { env: { ...process.env, BERCHI_URL: SALON }, stdio: "ignore" });
  await sleep(4000);
  const count = powershell("@(Get-Process berchi-cashier -ErrorAction SilentlyContinue).Count");
  check("only one program is running", count === "1", `count=${count}`);
  page.close(); app.kill(); killApp();
}

if (which === "all" || which === "C") {
  console.log("\nC. The salon system is down, then comes up, then goes away");
  const port = await freePort();
  let fake = null;
  const startFake = () => new Promise((r) => {
    fake = http.createServer((q, s) => { s.writeHead(200, { "content-type": "text/html" }); s.end("<title>fake salon</title><h1>fake salon system</h1>"); }).listen(port, "127.0.0.1", r);
  });
  const stopFake = () => new Promise((r) => { fake.closeAllConnections?.(); fake.close(r); });

  const app = launch({ BERCHI_URL: `http://localhost:${port}` });
  const page = await attach();
  await sleep(2500);
  check("with nothing answering, it shows the Starting screen", (await page.evalJs("document.body.innerText")).includes("Starting the salon system"), await page.evalJs("location.href"));
  check("the hint is not shown yet", (await page.evalJs("document.getElementById('hint').hidden")) === true);

  await startFake();
  const up = await waitFor(async () => (await page.evalJs("location.origin")) === `http://localhost:${port}`, 15000);
  check("it carries on by itself once the server answers", up !== null, await page.evalJs("location.href"));

  await stopFake();
  const back = await waitFor(async () => (await page.evalJs("document.body.innerText")).includes("Starting the salon system"), 30000);
  check("it goes back to the Starting screen when the server goes away", back !== null, await page.evalJs("location.href"));
  if (back !== null) console.log(`     noticed after ${(back / 1000).toFixed(1)}s`);

  console.log("     waiting 32s to see the hint...");
  await sleep(32000);
  check("after 30 seconds a hint appears", (await page.evalJs("document.getElementById('hint').hidden")) === false);
  page.close(); app.kill(); killApp();
}

if (which === "all" || which === "D") {
  console.log("\nD. A bad address");
  const app = launch({ BERCHI_URL: "not an address" });
  const page = await attach();
  await sleep(2500);
  const text = await page.evalJs("document.body.innerText");
  check("it says the address cannot be used, and does not sit waiting", text.includes("not one this program can use"), text.slice(0, 120));
  page.close(); app.kill(); killApp();
}

if (which === "all" || which === "E") {
  console.log("\nE. The address can come from berchi-url.txt next to the program");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "berchi-exe-"));
  const copy = path.join(dir, "berchi-cashier.exe");
  fs.copyFileSync(EXE, copy);
  fs.writeFileSync(path.join(dir, "berchi-url.txt"), `# the salon computer\n\n${SALON}\n`);
  const app = launch({ BERCHI_URL: "" }, copy);
  const page = await attach();
  const took = await waitFor(async () => (await page.evalJs("location.origin")) === SALON_ORIGIN, 20000);
  check("the file's address is used", took !== null, await page.evalJs("location.href"));
  page.close(); app.kill(); killApp();
  fs.rmSync(dir, { recursive: true, force: true });
}

if (which === "all" || which === "F") {
  console.log("\nF. Choosing a printer: berchi-print.txt brings the dialog back");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "berchi-print-"));
  const copy = path.join(dir, "berchi-cashier.exe");
  const printFile = path.join(dir, "berchi-print.txt");
  fs.copyFileSync(EXE, copy);

  // Reading the options back needs the web view to exist, so each case launches
  // the program and waits for it rather than just starting the process.
  const argsAfterLaunch = async (env) => {
    const app = launch(env, copy);
    const page = await attach();
    await sleep(1500);
    const args = webviewArgs();
    page.close(); app.kill(); killApp();
    return args;
  };

  fs.writeFileSync(printFile, "# reception picks the printer by hand\n\ndialog\n");
  let args = await argsAfterLaunch({ BERCHI_URL: SALON });
  check("the file turns silent printing off, so Windows lists the printers", !args.includes("--kiosk-printing"), args.slice(0, 200));
  check("...and Tauri's own default options are still there", args.includes("--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection"), args.slice(0, 200));

  // For trying silent printing on a PC whose file asks for the dialog.
  args = await argsAfterLaunch({ BERCHI_URL: SALON, BERCHI_SILENT_PRINT: "1" });
  check("the environment variable overrules the file", args.includes("--kiosk-printing"), args.slice(0, 200));

  // A typo must not quietly stop the slip printing: reception would go on
  // tapping the button with nothing coming out and no reason on screen.
  fs.writeFileSync(printFile, "dailog\n");
  args = await argsAfterLaunch({ BERCHI_URL: SALON });
  check("a misspelt setting leaves the slip printing by itself", args.includes("--kiosk-printing"), args.slice(0, 200));

  fs.rmSync(dir, { recursive: true, force: true });
}

if (which === "all" || which === "G") {
  console.log("\nG. What the salon's pages may ask the program to do");

  // The printer settings are kept per PC, so a run of this must not be able to
  // scribble on the settings of the machine it runs on.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "berchi-printers-"));
  const settingsFile = path.join(dir, "printers.json");

  const app = launch({ BERCHI_URL: SALON, BERCHI_PRINTERS_FILE: settingsFile });
  const page = await attach();
  await waitFor(async () => (await page.evalJs("location.origin")) === SALON_ORIGIN, 20000);

  // Calls a command from the salon's own page, the way the salon system does,
  // and reports what came back rather than throwing.
  const fromSalon = async (command, args = {}) => {
    const answer = await page.evalJs(`(async () => {
      try {
        const value = await window.__TAURI__.core.invoke(${JSON.stringify(command)}, ${JSON.stringify(args)});
        return JSON.stringify({ ok: true, value });
      } catch (error) {
        return JSON.stringify({ ok: false, error: String(error) });
      }
    })()`);
    try { return JSON.parse(answer); } catch { return { ok: false, error: String(answer) }; }
  };

  check("the salon's pages can reach the program at all", (await page.evalJs("typeof window.__TAURI__")) === "object");

  const status = await fromSalon("printing_status");
  check("...and may ask what this PC prints on", status.ok === true, status.error);
  check("...which says no printer is set up on a fresh PC", status.ok && status.value?.slip === null, JSON.stringify(status.value));

  // Least privilege. The till's own printer setup is not the salon server's
  // business: a server that was tampered with must not be able to read it, and
  // above all must not be able to point the receipts somewhere else.
  for (const forbidden of ["printer_settings", "save_printer_settings", "list_printers", "test_print"]) {
    const answer = await fromSalon(forbidden);
    // Refused by the ACL specifically, not merely failing for some other
    // reason -- a command that errored on its arguments would look the same.
    const blocked = answer.ok === false && /not allowed/i.test(answer.error ?? "");
    check(`...but may not call ${forbidden}`, blocked, JSON.stringify(answer));
  }

  // Printing with nothing set up must answer "not printed" rather than fail, or
  // the salon system has nothing to fall back to and reception stops.
  const printed = await fromSalon("print_slip", {
    slip: { orderNumber: "ORD-20260922-0001", shortNumber: "1", salon: { name: "Berchi Salon" } },
  });
  check("printing with no printer set up answers rather than failing", printed.ok === true, printed.error);
  check("...and says it did not print", printed.ok && printed.value?.printed === false, JSON.stringify(printed.value));
  check("...and says why", printed.ok && typeof printed.value?.reason === "string" && printed.value.reason.length > 0, JSON.stringify(printed.value));

  // The way in to the settings, from the salon system.
  const opened = await fromSalon("open_printer_settings");
  check("the salon's pages may open the printer setup", opened.ok === true, opened.error);

  const setupWindow = await waitFor(async () => {
    const targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
    return targets.some((t) => (t.url ?? "").includes("printers.html"));
  }, 10000);
  check("...and the printer setup window opens", setupWindow !== null);

  page.close(); app.kill(); killApp();
  fs.rmSync(dir, { recursive: true, force: true });
}

if (which === "all" || which === "H") {
  console.log("\nH. The printer setup opens from the Starting screen");

  // Deliberately checked with the salon system DOWN: setting a printer up is
  // work for before opening, often on a PC whose Docker stack is not running.
  const port = await freePort();
  const app = launch({ BERCHI_URL: `http://localhost:${port}` });
  const page = await attach();
  await sleep(2500);

  check("the Starting screen is showing", (await page.evalJs("document.body.innerText")).includes("Starting the salon system"));
  check("the printer setup button is offered", (await page.evalJs("!!document.getElementById('printer-setup')")) === true);
  // The button is always shown, so the only way it can fail is by saying so.
  // An earlier version hid it when the program could not be reached, which is
  // the one failure nobody can report.
  check("nothing is complaining yet", (await page.evalJs("document.getElementById('printer-setup-trouble').hidden")) === true);

  await page.evalJs("document.getElementById('printer-setup').click()");
  const setupWindow = await waitFor(async () => {
    const targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
    return targets.some((t) => (t.url ?? "").includes("printers.html"));
  }, 10000);
  check("...and it opens with the salon system still down", setupWindow !== null);

  page.close(); app.kill(); killApp();
}

killApp();
console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
