"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { printTicket, printerSetupAction } from "@/lib/desktop-print";

/**
 * Reprints the slip the same way reception prints it: on the till's receipt
 * printer when there is one, laid out for the roll and cut at the end, and
 * through the browser only when there is not.
 */
export function PrintButton({ orderId }: { orderId: string }) {
  const [printing, setPrinting] = useState(false);

  async function print() {
    setPrinting(true);
    try {
      const outcome = await printTicket("slip", orderId);
      if (outcome?.printed) return;
      if (outcome?.reason) toast.warning(outcome.reason, { action: printerSetupAction() });
      window.print();
    } finally {
      setPrinting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={print}
      disabled={printing}
      className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
    >
      <Printer className="h-5 w-5" />
      {printing ? "Printing..." : "Print slip"}
    </button>
  );
}
