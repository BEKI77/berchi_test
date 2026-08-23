"use client";

import { useEffect, useState, useCallback } from "react";
import { History, CheckCircle, Scissors, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { customerName, customerInitials } from "@/lib/orders";

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  customer: { id: string; firstName: string; lastName: string } | null;
  items: { id: string; unitPrice: string; quantity: number; service: { id: string; name: string } }[];
  products: { id: string; unitPrice: string; quantity: number; product: { id: string; name: string } }[];
};

export function ServerHistoryClient({ userId }: { userId: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders?serverId=${userId}&status=CHECKED_OUT`);
      if (!res.ok) throw new Error();
      setOrders(await res.json());
    } catch {
      toast.error("Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  function getTotal(order: Order) {
    const s = order.items.reduce((a, i) => a + Number(i.unitPrice) * i.quantity, 0);
    const p = order.products.reduce((a, i) => a + Number(i.unitPrice) * i.quantity, 0);
    return s + p;
  }

  const totalEarned = orders.reduce((s, o) => s + getTotal(o), 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-10 w-10 rounded-full border-3 border-pink-200 border-t-pink-500 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading history...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <History className="h-6 w-6 text-pink-500" />
            My History
          </h1>
          <p className="text-muted-foreground mt-1">
            {orders.length} completed order(s) today
          </p>
        </div>
        <Button variant="outline" onClick={fetchOrders} className="rounded-xl border-pink-200 hover:bg-pink-50 hover:border-pink-300 transition-all">
          Refresh
        </Button>
      </div>

      {orders.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 p-5 text-white shadow-lg shadow-pink-200/40 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-6 translate-x-6" />
            <p className="text-pink-100 text-xs font-semibold uppercase tracking-wider mb-1">Total Earned</p>
            <p className="text-2xl font-bold">ETB {totalEarned.toFixed(2)}</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 p-5 text-white shadow-lg shadow-violet-200/40 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-6 translate-x-6" />
            <p className="text-violet-100 text-xs font-semibold uppercase tracking-wider mb-1">Clients Served</p>
            <p className="text-2xl font-bold">{orders.length}</p>
          </div>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border-2 border-dashed border-pink-200 bg-gradient-to-b from-pink-50/50 to-white">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-100 to-rose-100" style={{ animation: "float 4s ease-in-out infinite" }}>
            <History className="h-8 w-8 text-pink-400" />
          </div>
          <h3 className="text-lg font-semibold">No completed orders yet</h3>
          <p className="text-muted-foreground text-sm mt-1 max-w-xs">
            Orders you complete and send to the cashier will appear here once they are checked out.
          </p>
        </div>
      ) : (
        <div className="grid gap-2.5">
          {orders.map((order) => {
            const total = getTotal(order);
            return (
              <Card key={order.id} className="rounded-xl border-pink-50 hover:border-pink-100 transition-colors">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-100 to-rose-100 text-sm font-bold text-pink-500 shrink-0">
                        {customerInitials(order.customer)}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{customerName(order.customer)}</p>
                        <p className="text-xs text-muted-foreground">{order.orderNumber}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-pink-700">ETB {total.toFixed(2)}</p>
                      <div className="flex items-center gap-1 justify-end mt-0.5">
                        <CheckCircle className="h-3 w-3 text-emerald-500" />
                        <span className="text-[10px] font-semibold text-emerald-500">Completed</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2.5 pt-2.5 border-t border-dashed border-pink-100/60 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Scissors className="h-3 w-3" /> {order.items.length} service(s)</span>
                    {order.products.length > 0 && (
                      <span className="flex items-center gap-1"><Package className="h-3 w-3" /> {order.products.length} product(s)</span>
                    )}
                    {order.completedAt && (
                      <span className="ml-auto">
                        {new Date(order.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
