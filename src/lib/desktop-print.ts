"use client";

/**
 * Printing a ticket on the till's own receipt printer.
 *
 * When the salon system is opened in the **desktop window** (see `desktop/`),
 * and that PC has been told which printer to use, a ticket can be printed
 * properly: laid out for an 80 mm roll, sent as ESC/POS, cut at the end, with
 * the cash drawer kicked on a cash sale. In an ordinary browser, or on a PC
 * where no printer has been set up, none of that exists.
 *
 * So every function here can answer **"not printed"**, and every caller has
 * somewhere to go when it does: printing the page through the browser, which is
 * what the system did before any of this and still does. That is the whole
 * design. A salon cannot stop issuing tickets because a printer setting is
 * half-finished, so the receipt printer is an improvement on the old path and
 * never a replacement for it.
 *
 * Nothing here is imported by the server. It is all behind `typeof window`.
 */

/** What the desktop window says when it has been asked to print. */
export type PrintOutcome = {
  printed: boolean;
  /** Which printer took it, when one did. */
  printer: string | null;
  /** Why it did not print, when it did not. Worth showing the cashier. */
  reason: string | null;
};

/** Which of the two tickets to print. */
export type TicketKind = "slip" | "receipt";

type Invoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

/**
 * The desktop window's way in, or nothing at all in a browser.
 *
 * The window is what puts this here, and it only grants the salon's own address
 * the five printing commands -- so this cannot reach the printer settings, which
 * belong to the PC.
 */
function invoker(): Invoke | null {
  if (typeof window === "undefined") return null;
  const tauri = (window as unknown as { __TAURI__?: { core?: { invoke?: Invoke } } }).__TAURI__;
  return tauri?.core?.invoke ?? null;
}

/** Whether the salon system is running inside the desktop window. */
export function inDesktopWindow(): boolean {
  return invoker() !== null;
}

/** Which printers this PC is set up to use, if it is running in the window. */
export async function printerStatus(): Promise<{ slip: string | null; receipt: string | null } | null> {
  const invoke = invoker();
  if (!invoke) return null;
  try {
    const status = (await invoke("printing_status")) as { slip: string | null; receipt: string | null };
    return status;
  } catch {
    // An older desktop window that does not know this command. Not worth
    // reporting: it simply means there is no receipt printer to use.
    return null;
  }
}

/** Where the server assembles each ticket, and which command prints it. */
const tickets = {
  slip: { path: "/api/print/slip", command: "print_slip", argument: "slip" },
  receipt: { path: "/api/print/receipt", command: "print_receipt", argument: "receipt" },
} as const;

/**
 * Prints a ticket on the till's receipt printer.
 *
 * Returns `null` when there is no receipt printer in the picture at all -- an
 * ordinary browser, or a desktop window too old to know how. That is different
 * from a [`PrintOutcome`] saying `printed: false`, which means there *is* a
 * window but it could not print: no printer assigned, the printer is off, the
 * paper has run out. The caller falls back to the browser either way, but only
 * the second is worth telling the cashier about.
 */
export async function printTicket(kind: TicketKind, id: string): Promise<PrintOutcome | null> {
  const invoke = invoker();
  if (!invoke) return null;

  const ticket = tickets[kind];

  let payload: unknown;
  try {
    const response = await fetch(`${ticket.path}/${id}`);
    if (!response.ok) {
      return {
        printed: false,
        printer: null,
        reason: `The salon system could not put the ${kind} together (${response.status}).`,
      };
    }
    payload = await response.json();
  } catch {
    return { printed: false, printer: null, reason: `Could not reach the salon system.` };
  }

  try {
    return (await invoke(ticket.command, { [ticket.argument]: payload })) as PrintOutcome;
  } catch (error) {
    // The command was refused outright, rather than answering "not printed".
    // Usually an older desktop window, which has no receipt printing at all.
    if (isUnknownCommand(error)) return null;
    return { printed: false, printer: null, reason: message(error) };
  }
}

/**
 * Opens the printer settings, if the salon system is in the desktop window.
 * Returns whether there was a window to open them in.
 */
export async function openPrinterSettings(): Promise<boolean> {
  const invoke = invoker();
  if (!invoke) return false;
  try {
    await invoke("open_printer_settings");
    return true;
  } catch {
    return false;
  }
}

/** Tauri refuses a command it does not have, or is not allowed to run. */
function isUnknownCommand(error: unknown): boolean {
  const text = message(error).toLowerCase();
  return text.includes("not allowed") || text.includes("not found") || text.includes("unknown");
}

function message(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return String(error);
}
