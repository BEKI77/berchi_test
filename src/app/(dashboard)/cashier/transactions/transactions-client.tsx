"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CreditCard,
  RefreshCw,
  Banknote,
  CheckCircle,
  TrendingUp,
  Receipt,
  Scissors,
  Package,
  User,
  Clock,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Percent,
  Heart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { customerName, customerInitials } from "@/lib/orders";
import { formatMoney } from "@/lib/money";

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  customer: { id: string; firstName: string; lastName: string; phone: string | null } | null;
  server: { id: string; firstName: string; lastName: string };
  items: { id: string; unitPrice: number; quantity: number; service: { id: string; name: string } }[];
  products: { id: string; unitPrice: number; quantity: number; product: { id: string; name: string } }[];
  invoice: {
    id: string;
    invoiceNumber: string;
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    discountType: string | null;
    discountValue: number;
    discountAmount: number;
    tipAmount: number;
    totalAmount: number;
    status: string;
    createdAt: string;
    payment: {
      id: string;
      method: string;
      amount: number;
      createdAt: string;
    } | null;
  } | null;
};

const methodIcons: Record<string, React.ReactNode> = {
  CASH: <Banknote className="h-3.5 w-3.5" />,
  CARD: <CreditCard className="h-3.5 w-3.5" />,
  MOBILE: <Smartphone className="h-3.5 w-3.5" />,
};

const methodColors: Record<string, string> = {
  CASH: "bg-green-50 text-green-700 border-green-200",
  CARD: "bg-blue-50 text-blue-700 border-blue-200",
  MOBILE: "bg-orange-50 text-orange-700 border-orange-200",
};

export function TransactionsClient() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders?status=CHECKED_OUT");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setOrders(data);
    } catch {
      toast.error("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  function getInvoiceTotal(order: Order) {
    if (order.invoice) return Number(order.invoice.totalAmount);
    const services = order.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);
    const products = order.products.reduce((s, p) => s + Number(p.unitPrice) * p.quantity, 0);
    return services + products;
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const totalRevenue = orders.reduce((sum, o) => sum + getInvoiceTotal(o), 0);
  const totalTips = orders.reduce((sum, o) => sum + (o.invoice ? Number(o.invoice.tipAmount) : 0), 0);
  const totalOrders = orders.length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-10 w-10 rounded-full border-3 border-emerald-200 border-t-emerald-500 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading transactions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-emerald-500" />
            Transactions
          </h1>
          <p className="text-muted-foreground mt-1">
            {totalOrders} completed transaction{totalOrders !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={fetchOrders}
          className="rounded-xl border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 transition-all"
        >
          <RefreshCw className="h-4 w-4 mr-2 text-emerald-500" />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 p-4 text-white shadow-lg shadow-emerald-200/40 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -translate-y-4 translate-x-4" />
          <div className="flex items-center gap-1.5 text-emerald-100 text-[10px] font-semibold uppercase tracking-wider mb-1">
            <Banknote className="h-3.5 w-3.5" />
            Revenue
          </div>
          <p className="text-xl font-bold">ETB {formatMoney(totalRevenue)}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 p-4 text-white shadow-lg shadow-blue-200/40 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -translate-y-4 translate-x-4" />
          <div className="flex items-center gap-1.5 text-blue-100 text-[10px] font-semibold uppercase tracking-wider mb-1">
            <CheckCircle className="h-3.5 w-3.5" />
            Count
          </div>
          <p className="text-xl font-bold">{totalOrders}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 p-4 text-white shadow-lg shadow-violet-200/40 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -translate-y-4 translate-x-4" />
          <div className="flex items-center gap-1.5 text-violet-100 text-[10px] font-semibold uppercase tracking-wider mb-1">
            <CreditCard className="h-3.5 w-3.5" />
            Average
          </div>
          <p className="text-xl font-bold">
            ETB {formatMoney(totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0)}
          </p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 p-4 text-white shadow-lg shadow-pink-200/40 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -translate-y-4 translate-x-4" />
          <div className="flex items-center gap-1.5 text-pink-100 text-[10px] font-semibold uppercase tracking-wider mb-1">
            <Heart className="h-3.5 w-3.5" />
            Tips
          </div>
          <p className="text-xl font-bold">ETB {formatMoney(totalTips)}</p>
        </div>
      </div>

      {/* Transaction list */}
      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border-2 border-dashed border-emerald-200 bg-gradient-to-b from-emerald-50/50 to-white">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100" style={{ animation: "float 4s ease-in-out infinite" }}>
            <Receipt className="h-8 w-8 text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold">No transactions yet</h3>
          <p className="text-muted-foreground text-sm mt-1 max-w-xs">
            Completed payments will appear here as orders are checked out.
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {orders.map((order) => {
            const inv = order.invoice;
            const total = getInvoiceTotal(order);
            const isOpen = expanded.has(order.id);
            const payMethod = inv?.payment?.method || "CASH";

            return (
              <Card key={order.id} className="rounded-xl border-emerald-50 hover:border-emerald-100 transition-colors overflow-hidden">
                <div className="h-0.5 bg-gradient-to-r from-emerald-400 to-teal-400" />
                <CardContent className="py-2.5 px-3 sm:px-4">
                  {/* Compact row */}
                  <button onClick={() => toggleExpand(order.id)} className="w-full text-left">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 text-xs font-bold text-emerald-600">
                        {customerInitials(order.customer)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm truncate">
                            {customerName(order.customer)}
                          </p>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-semibold ${methodColors[payMethod] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
                            {methodIcons[payMethod] || <CreditCard className="h-2.5 w-2.5" />}
                            {payMethod}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                          <span>{inv?.invoiceNumber || order.orderNumber}</span>
                          <span className="text-muted-foreground/30">·</span>
                          <User className="h-3 w-3 shrink-0" />
                          <span className="truncate">{order.server.firstName}</span>
                          <span className="text-muted-foreground/30">·</span>
                          <Clock className="h-3 w-3 shrink-0" />
                          <span>{inv ? new Date(inv.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <p className="font-bold text-sm text-emerald-700">ETB {formatMoney(total)}</p>
                          {inv && Number(inv.tipAmount) > 0 && (
                            <p className="text-[9px] text-pink-500 font-medium">+ETB {formatMoney(Number(inv.tipAmount))} tip</p>
                          )}
                        </div>
                        {isOpen ? <ChevronUp className="h-4 w-4 text-gray-300" /> : <ChevronDown className="h-4 w-4 text-gray-300" />}
                      </div>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="mt-3 pt-3 border-t border-dashed border-emerald-100/60 space-y-3">
                      {/* Services */}
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1.5">
                          <Scissors className="h-3 w-3" /> Services
                        </p>
                        <div className="space-y-1">
                          {order.items.map((item) => (
                            <div key={item.id} className="flex justify-between text-xs">
                              <span className="text-gray-700">{item.service.name} {item.quantity > 1 && <span className="text-muted-foreground">x{item.quantity}</span>}</span>
                              <span className="font-medium text-gray-900">ETB {formatMoney((Number(item.unitPrice) * item.quantity))}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Products */}
                      {order.products.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1.5">
                            <Package className="h-3 w-3" /> Products
                          </p>
                          <div className="space-y-1">
                            {order.products.map((p) => (
                              <div key={p.id} className="flex justify-between text-xs">
                                <span className="text-gray-700">{p.product.name} <span className="text-muted-foreground">x{p.quantity}</span></span>
                                <span className="font-medium text-gray-900">ETB {formatMoney((Number(p.unitPrice) * p.quantity))}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Invoice breakdown */}
                      {inv && (
                        <div className="rounded-lg bg-gray-50/80 p-2.5 space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span className="font-medium">ETB {formatMoney(Number(inv.subtotal))}</span>
                          </div>
                          {Number(inv.taxAmount) > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground flex items-center gap-1"><Percent className="h-2.5 w-2.5" /> Tax ({Number(inv.taxRate)}%)</span>
                              <span className="font-medium">+ETB {formatMoney(Number(inv.taxAmount))}</span>
                            </div>
                          )}
                          {Number(inv.discountAmount) > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-red-500 flex items-center gap-1">Discount {inv.discountType === "PERCENTAGE" ? `(${Number(inv.discountValue)}%)` : ""}</span>
                              <span className="font-medium text-red-500">-ETB {formatMoney(Number(inv.discountAmount))}</span>
                            </div>
                          )}
                          {Number(inv.tipAmount) > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-pink-500 flex items-center gap-1"><Heart className="h-2.5 w-2.5" /> Tip</span>
                              <span className="font-medium text-pink-500">+ETB {formatMoney(Number(inv.tipAmount))}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm font-bold pt-1 border-t border-gray-200/60">
                            <span className="text-emerald-700">Total Paid</span>
                            <span className="text-emerald-700">ETB {formatMoney(Number(inv.totalAmount))}</span>
                          </div>
                        </div>
                      )}

                      {/* Footer meta */}
                      <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                        {inv && (
                          <span className="flex items-center gap-1">
                            <Receipt className="h-3 w-3" /> {inv.invoiceNumber}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-emerald-400" /> Paid
                        </span>
                        {order.customer?.phone && (
                          <span>{order.customer.phone}</span>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
