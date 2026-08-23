"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, RefreshCw, User, Scissors, ArrowRight, Receipt, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { customerName, customerInitials } from "@/lib/orders";

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  notes: string | null;
  startedAt: string;
  completedAt: string | null;
  customer: { id: string; firstName: string; lastName: string; phone: string | null } | null;
  server: { id: string; firstName: string; lastName: string };
  items: { id: string; unitPrice: string; quantity: number; service: { id: string; name: string } }[];
  products: { id: string; unitPrice: string; quantity: number; product: { id: string; name: string } }[];
};

export function CashierPendingClient() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders?status=SENT_TO_CASHIER");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setOrders(data);
    } catch {
      toast.error("Failed to load pending orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  function getOrderTotal(order: Order) {
    const services = order.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);
    const products = order.products.reduce((s, p) => s + Number(p.unitPrice) * p.quantity, 0);
    return (services + products).toFixed(2);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-10 w-10 rounded-full border-3 border-emerald-200 border-t-emerald-500 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading orders...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="h-6 w-6 text-emerald-500" />
            Pending Orders
          </h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            {orders.length} order(s) waiting for checkout
            <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/cashier/walk-in")}
            className="rounded-xl border-teal-200 text-teal-600 hover:bg-teal-50 hover:border-teal-300 transition-all"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Walk-In
          </Button>
          <Button
            variant="outline"
            onClick={fetchOrders}
            className="rounded-xl border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 transition-all"
          >
            <RefreshCw className="h-4 w-4 mr-2 text-emerald-500" />
            Refresh
          </Button>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border-2 border-dashed border-emerald-200 bg-gradient-to-b from-emerald-50/50 to-white">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100" style={{ animation: "float 4s ease-in-out infinite" }}>
            <ClipboardList className="h-8 w-8 text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold">All clear!</h3>
          <p className="text-muted-foreground text-sm mt-1 max-w-xs">
            No pending orders right now. New orders from stylists will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {orders.map((order) => (
            <Card
              key={order.id}
              className="card-hover cursor-pointer overflow-hidden rounded-xl border-emerald-100 hover:border-emerald-200"
              onClick={() => router.push(`/cashier/checkout/${order.id}`)}
            >
              <div className="h-0.5 bg-gradient-to-r from-emerald-400 to-teal-400" />
              <CardContent className="py-2.5 px-3 sm:px-4">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 text-xs font-bold text-emerald-600">
                    {customerInitials(order.customer)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">
                        {customerName(order.customer)}
                      </p>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-100 shrink-0">
                        <span className="h-1 w-1 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-[9px] font-semibold text-amber-600">{order.orderNumber}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                      <User className="h-3 w-3 shrink-0" />
                      <span className="truncate">{order.server.firstName}</span>
                      <span className="text-muted-foreground/30">·</span>
                      <Scissors className="h-3 w-3 shrink-0" />
                      <span className="truncate">{order.items.map((i) => i.service.name).join(", ")}</span>
                      {order.products.length > 0 && (
                        <span className="text-violet-500 shrink-0">+{order.products.length} prod</span>
                      )}
                    </div>
                  </div>

                  {/* Total + CTA */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className="font-bold text-sm text-emerald-700">ETB {getOrderTotal(order)}</p>
                      <p className="text-[9px] text-muted-foreground">{order.items.length} svc{order.products.length > 0 ? `, ${order.products.length} prod` : ""}</p>
                    </div>
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
