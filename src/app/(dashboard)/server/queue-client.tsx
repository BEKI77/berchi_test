"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Scissors, Clock, CheckCircle, Send, Sparkles, ArrowRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { customerName } from "@/lib/orders";
import { formatMoney } from "@/lib/money";

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  notes: string | null;
  startedAt: string;
  completedAt: string | null;
  customer: { id: string; firstName: string; lastName: string; phone: string | null } | null;
  server: { id: string; firstName: string; lastName: string };
  items: { id: string; unitPrice: number; quantity: number; service: { id: string; name: string } }[];
  products: { id: string; unitPrice: number; quantity: number; product: { id: string; name: string } }[];
};

export function ServerQueueClient({ userId }: { userId: string }) {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticketInput, setTicketInput] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      // Open tickets belong to the floor, not to one stylist -- several people
      // work the same order number. Completed tickets stay personal history.
      const [openRes, mineRes] = await Promise.all([
        fetch(`/api/orders?open=true`),
        fetch(`/api/orders?status=CHECKED_OUT&serverId=${userId}`),
      ]);
      if (!openRes.ok || !mineRes.ok) throw new Error("Failed to fetch orders");
      const [openOrders, myCompleted] = await Promise.all([
        openRes.json(),
        mineRes.json(),
      ]);
      setOrders([...openOrders, ...myCompleted]);
    } catch {
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const activeOrders = orders.filter((o) => o.status === "IN_PROGRESS");
  const sentOrders = orders.filter((o) => o.status === "SENT_TO_CASHIER");
  const todayCompleted = orders.filter((o) => o.status === "CHECKED_OUT");

  function getOrderTotal(order: Order) {
    const services = (order.items || []).reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);
    const products = (order.products || []).reduce((s, p) => s + Number(p.unitPrice) * p.quantity, 0);
    return formatMoney(services + products);
  }

  function getElapsed(startedAt: string) {
    return Math.round((Date.now() - new Date(startedAt).getTime()) / 60000);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-10 w-10 rounded-full border-3 border-pink-200 border-t-pink-500 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading your queue...</p>
      </div>
    );
  }

  // A stylist walks up to a chair and is told a number. This is the whole
  // point of numbering tickets: no searching by customer name.
  async function openTicket(e: React.FormEvent) {
    e.preventDefault();
    const entered = ticketInput.trim();
    if (!entered) return;

    setLookingUp(true);
    try {
      const res = await fetch(`/api/orders?orderNumber=${encodeURIComponent(entered)}`);
      if (!res.ok) throw new Error("Could not look up that ticket");
      const found: Order[] = await res.json();

      if (found.length === 0) {
        toast.error(`No ticket ${entered} today`);
        return;
      }
      if (found[0].status === "CHECKED_OUT" || found[0].status === "CANCELLED") {
        toast.error(`Ticket ${entered} is already closed`);
        return;
      }
      setTicketInput("");
      router.push(`/server/order/${found[0].id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not look up that ticket");
    } finally {
      setLookingUp(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Scissors className="h-6 w-6 text-pink-500" />
            My Queue
          </h1>
          <p className="text-muted-foreground mt-1">
            Your active sessions and today&apos;s orders
          </p>
        </div>
        <Button
          onClick={() => router.push("/server/new-order")}
          className="rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 shadow-md shadow-pink-200/40 hover:shadow-lg hover:shadow-pink-200/50 transition-all duration-200 hover:-translate-y-0.5"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Order
        </Button>
      </div>

      {/* Open a ticket by its number */}
      <form onSubmit={openTicket} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pink-400" />
          <Input
            value={ticketInput}
            onChange={(e) => setTicketInput(e.target.value)}
            inputMode="numeric"
            placeholder="Ticket number, e.g. 45"
            aria-label="Open a ticket by its number"
            className="pl-9 h-12 rounded-xl border-pink-100 focus:border-pink-300 text-base"
          />
        </div>
        <Button
          type="submit"
          disabled={lookingUp || !ticketInput.trim()}
          className="h-12 px-6 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 font-semibold"
        >
          {lookingUp ? "Finding..." : "Open"}
        </Button>
      </form>

      {/* Stats */}
      {orders.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-100 p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{activeOrders.length}</p>
            <p className="text-xs font-medium text-blue-500/80 mt-0.5">Active</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-100 p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{sentOrders.length}</p>
            <p className="text-xs font-medium text-amber-500/80 mt-0.5">Pending</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-100 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{todayCompleted.length}</p>
            <p className="text-xs font-medium text-emerald-500/80 mt-0.5">Done</p>
          </div>
        </div>
      )}

      {/* Active Orders */}
      {activeOrders.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100">
              <Clock className="h-4 w-4 text-blue-600" />
            </div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-blue-600">
              Active Sessions
            </h2>
            <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
              {activeOrders.length}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {activeOrders.map((order) => (
              <Card
                key={order.id}
                className="card-hover cursor-pointer overflow-hidden rounded-xl border-blue-100 hover:border-blue-200"
                onClick={() => router.push(`/server/order/${order.id}`)}
              >
                <div className="h-1 bg-gradient-to-r from-blue-400 to-blue-500" />
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-base">
                        {customerName(order.customer)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{order.orderNumber}</p>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 border border-blue-100">
                      <Clock className="h-3 w-3 text-blue-500" />
                      <span className="text-xs font-semibold text-blue-600">{getElapsed(order.startedAt)}m</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                    <span>{(order.items || []).length} service(s)</span>
                    <span>{(order.products || []).length} product(s)</span>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-dashed border-blue-100">
                    <span className="font-bold text-blue-700">ETB {getOrderTotal(order)}</span>
                    <span className="text-xs text-blue-500 flex items-center gap-1 font-medium">
                      Continue <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Sent to Cashier */}
      {sentOrders.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100">
              <Send className="h-4 w-4 text-amber-600" />
            </div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-600">
              Sent to Cashier
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {sentOrders.map((order) => (
              <Card key={order.id} className="rounded-xl border-amber-100 opacity-85">
                <div className="h-1 bg-gradient-to-r from-amber-300 to-amber-400" />
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold">{customerName(order.customer)}</p>
                      <p className="text-xs text-muted-foreground">{order.orderNumber}</p>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 border border-amber-100">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                      <span className="text-[10px] font-semibold text-amber-600">Awaiting</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-dashed border-amber-100">
                    <span className="font-bold text-amber-700">ETB {getOrderTotal(order)}</span>
                    <span className="text-xs text-muted-foreground">{(order.items || []).length} service(s)</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Today's Completed */}
      {todayCompleted.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            </div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-600">
              Completed Today
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {todayCompleted.map((order) => (
              <Card key={order.id} className="rounded-xl border-emerald-100/60 opacity-60 hover:opacity-80 transition-opacity">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{customerName(order.customer)}</p>
                      <p className="text-xs text-muted-foreground">{order.orderNumber}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-emerald-600 text-sm">ETB {getOrderTotal(order)}</span>
                      <p className="text-[10px] text-emerald-500 flex items-center justify-end gap-0.5 mt-0.5">
                        <CheckCircle className="h-3 w-3" /> Done
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {orders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border-2 border-dashed border-pink-200 bg-gradient-to-b from-pink-50/50 to-white">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-100 to-rose-100" style={{ animation: "float 4s ease-in-out infinite" }}>
            <Scissors className="h-8 w-8 text-pink-400" />
          </div>
          <h3 className="text-lg font-semibold">No orders yet today</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-6 max-w-xs">
            Start by creating a new order when a client is ready for their service.
          </p>
          <Button
            onClick={() => router.push("/server/new-order")}
            className="rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 shadow-md shadow-pink-200/40 transition-all duration-200 hover:-translate-y-0.5"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Start New Order
          </Button>
        </div>
      )}
    </div>
  );
}
