"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Ticket, Plus, RefreshCw, Clock, Scissors, ArrowRight, UserPlus, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";
import { ticketName, shortOrderNumber } from "@/lib/orders";
import { useOrderEvents } from "@/lib/use-order-events";

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  startedAt: string;
  customer: { id: string; firstName: string; lastName: string } | null;
  walkInName: string | null;
  items: { id: string; unitPrice: number; quantity: number }[];
  products: { id: string; unitPrice: number; quantity: number }[];
};

function minutesSince(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

/**
 * When the customer arrived, in the browser's timezone (the PC's, at the salon).
 * A ticket from an earlier day gets its date too: it should have been closed,
 * and its short number can clash with one issued today.
 */
function arrivalLabel(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (d.toDateString() === new Date().toDateString()) return time;
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${time}`;
}

function formatElapsed(iso: string): string {
  const minutes = minutesSince(iso);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d`;
}

function ticketTotal(order: Order): number {
  const services = order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const products = order.products.reduce((s, p) => s + p.unitPrice * p.quantity, 0);
  return services + products;
}

export function ReceptionClient() {
  const router = useRouter();
  const [openTickets, setOpenTickets] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [justIssued, setJustIssued] = useState<Order | null>(null);
  const [name, setName] = useState("");
  // Bumped to (re)load the hidden slip frame, which prints itself on load.
  const [printKey, setPrintKey] = useState(0);

  const fetchOpen = useCallback(async () => {
    try {
      const res = await fetch("/api/orders?open=true");
      if (!res.ok) throw new Error();
      const tickets: Order[] = await res.json();
      // First come, first served: the ticket that arrived earliest is on top.
      setOpenTickets(tickets.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()));
    } catch {
      toast.error("Could not load open tickets");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fires on connect and on every ticket change, so no separate initial fetch.
  useOrderEvents(fetchOpen);

  async function issueTicket() {
    setIssuing(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not issue a ticket");
      }
      const order: Order = await res.json();
      setJustIssued(order);
      setName("");
      setPrintKey((k) => k + 1);
      fetchOpen();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not issue a ticket");
    } finally {
      setIssuing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Ticket className="h-6 w-6 text-emerald-500" />
            Reception
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Take the customer&apos;s name, give them a number. Whoever has the lower number came first.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={fetchOpen}
          className="rounded-xl hover:bg-emerald-50 shrink-0"
          aria-label="Refresh open tickets"
        >
          <RefreshCw className="h-4 w-4 text-emerald-500" />
        </Button>
      </div>

      {justIssued ? (
        <Card className="rounded-2xl border-emerald-200 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-emerald-400 to-teal-400" />
          <CardContent className="pt-8 pb-7 flex flex-col items-center gap-5 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Ticket issued
            </p>
            <p className="text-7xl sm:text-8xl font-black leading-none tabular-nums bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              {shortOrderNumber(justIssued.orderNumber)}
            </p>
            <p className="font-mono text-xs text-muted-foreground">{justIssued.orderNumber}</p>
            {justIssued.walkInName && (
              <p className="text-xl font-semibold">{justIssued.walkInName}</p>
            )}
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto pt-1">
              <Button
                onClick={() => setJustIssued(null)}
                className="h-12 px-8 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-base font-semibold"
              >
                Done
              </Button>
              <Button
                variant="outline"
                onClick={() => setPrintKey((k) => k + 1)}
                className="h-12 px-6 rounded-xl"
              >
                <Printer className="h-4 w-4 mr-1.5" />
                Print again
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/cashier/checkout/${justIssued.id}`)}
                className="h-12 px-6 rounded-xl"
              >
                Open ticket
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!issuing) issueTicket();
          }}
          className="space-y-3"
        >
          <label htmlFor="customer-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Customer name
          </label>
          <Input
            id="customer-name"
            autoFocus
            autoComplete="off"
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Type the name they give you (optional)"
            className="h-14 rounded-xl text-lg"
          />
        <Button
          type="submit"
          disabled={issuing}
          className="w-full h-24 rounded-2xl text-xl font-bold bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 hover:from-emerald-600 hover:via-teal-600 hover:to-emerald-600 shadow-lg shadow-emerald-300/30 transition-all duration-300 hover:-translate-y-0.5"
        >
          <Plus className="h-7 w-7 mr-2" />
          {issuing ? "Issuing..." : "Issue ticket and print number"}
        </Button>
        </form>
      )}

      {/* The slip prints itself when this frame loads. Off-screen rather than
          display:none, because browsers skip printing hidden frames. */}
      {printKey > 0 && justIssued && (
        <iframe
          key={printKey}
          src={`/slip/${justIssued.id}?print=1`}
          title="Number slip"
          aria-hidden="true"
          tabIndex={-1}
          style={{ position: "fixed", left: "-9999px", top: 0, width: "320px", height: "640px", border: 0 }}
        />
      )}

      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            On the floor
          </h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {openTickets.length} open
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3">
            <div className="h-9 w-9 rounded-full border-[3px] border-emerald-200 border-t-emerald-500 animate-spin" />
            <p className="text-sm text-muted-foreground">Loading tickets...</p>
          </div>
        ) : openTickets.length === 0 ? (
          <Card className="rounded-xl border-dashed">
            <CardContent className="py-12 flex flex-col items-center gap-2 text-center">
              <UserPlus className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No open tickets. Issue one when the next customer arrives.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {openTickets.map((t) => (
              <button
                key={t.id}
                onClick={() => router.push(`/cashier/checkout/${t.id}`)}
                className="text-left rounded-xl border border-emerald-100 bg-white p-4 transition-all hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-100/50 focus-visible:outline-2 focus-visible:outline-emerald-500"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 text-base font-black tabular-nums text-emerald-700">
                      {shortOrderNumber(t.orderNumber)}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{ticketName(t)}</p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {arrivalLabel(t.startedAt)} · {formatElapsed(t.startedAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Scissors className="h-3 w-3" />
                          {t.items.length}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-sm text-emerald-700 tabular-nums">
                      ETB {formatMoney(ticketTotal(t))}
                    </p>
                    {t.status === "SENT_TO_CASHIER" && (
                      <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        Ready
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
