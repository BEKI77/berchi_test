"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Receipt,
  Search,
  CreditCard,
  Banknote,
  Smartphone,
  ChevronDown,
  ChevronUp,
  User,
  Scissors,
  Package,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { customerName, customerInitials } from "@/lib/orders";

type InvoiceItem = {
  id: string;
  unitPrice: string;
  quantity: number;
  service: { name: string };
};

type InvoiceProduct = {
  id: string;
  unitPrice: string;
  quantity: number;
  product: { name: string };
};

type Payment = {
  id: string;
  method: string;
  amount: string;
  reference: string | null;
  createdAt: string;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  subtotal: string;
  taxRate: string;
  taxAmount: string;
  discountType: string | null;
  discountValue: string;
  discountAmount: string;
  tipAmount: string;
  totalAmount: string;
  status: string;
  createdAt: string;
  order: {
    orderNumber: string;
    customer: { id: string; firstName: string; lastName: string; phone: string | null } | null;
    server: { id: string; firstName: string; lastName: string };
    items: InvoiceItem[];
    products: InvoiceProduct[];
  };
  payment: Payment | null;
};

const statusColors: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-600 border-amber-200",
  PAID: "bg-emerald-50 text-emerald-600 border-emerald-200",
  REFUNDED: "bg-blue-50 text-blue-600 border-blue-200",
  VOIDED: "bg-red-50 text-red-600 border-red-200",
};

const methodIcons: Record<string, React.ReactNode> = {
  CASH: <Banknote className="h-3.5 w-3.5" />,
  CARD: <CreditCard className="h-3.5 w-3.5" />,
  MOBILE: <Smartphone className="h-3.5 w-3.5" />,
};

export function InvoicesClient() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/invoices");
      if (!res.ok) throw new Error();
      setInvoices(await res.json());
    } catch {
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const filtered = invoices.filter((inv) => {
    const matchSearch =
      `${inv.invoiceNumber} ${inv.order.orderNumber} ${customerName(inv.order.customer)}`
        .toLowerCase()
        .includes(search.toLowerCase());
    const matchStatus = filterStatus === "ALL" || inv.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalRevenue = invoices
    .filter((i) => i.status === "PAID")
    .reduce((sum, i) => sum + Number(i.totalAmount), 0);
  const totalTips = invoices
    .filter((i) => i.status === "PAID")
    .reduce((sum, i) => sum + Number(i.tipAmount), 0);
  const paidCount = invoices.filter((i) => i.status === "PAID").length;
  const pendingCount = invoices.filter((i) => i.status === "PENDING").length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-10 w-10 rounded-full border-3 border-emerald-200 border-t-emerald-500 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading invoices...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Receipt className="h-6 w-6 text-emerald-500" />
          Invoices
        </h1>
        <p className="text-muted-foreground mt-1">{invoices.length} total invoices</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="rounded-xl border-emerald-100 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-400" />
          <CardContent className="pt-3 pb-3">
            <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">Total Revenue</p>
            <p className="text-xl font-bold mt-1">ETB {totalRevenue.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-blue-100 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-blue-400 to-indigo-400" />
          <CardContent className="pt-3 pb-3">
            <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider">Total Tips</p>
            <p className="text-xl font-bold mt-1">ETB {totalTips.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-green-100 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-green-400 to-emerald-400" />
          <CardContent className="pt-3 pb-3">
            <p className="text-[10px] font-semibold text-green-500 uppercase tracking-wider">Paid</p>
            <p className="text-xl font-bold mt-1">{paidCount}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-amber-100 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-400" />
          <CardContent className="pt-3 pb-3">
            <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider">Pending</p>
            <p className="text-xl font-bold mt-1">{pendingCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by invoice #, order #, customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl border-emerald-100"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-10 rounded-xl border border-emerald-100 px-3 text-sm bg-white"
        >
          <option value="ALL">All Status</option>
          <option value="PAID">Paid</option>
          <option value="PENDING">Pending</option>
          <option value="REFUNDED">Refunded</option>
          <option value="VOIDED">Voided</option>
        </select>
      </div>

      {/* Invoice List */}
      <div className="space-y-2.5">
        {filtered.map((inv) => {
          const expanded = expandedId === inv.id;
          const date = new Date(inv.createdAt);
          return (
            <Card key={inv.id} className="rounded-xl border-emerald-50 hover:border-emerald-100 transition-colors overflow-hidden">
              <CardContent className="py-3">
                {/* Main Row */}
                <button
                  onClick={() => setExpandedId(expanded ? null : inv.id)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-600 font-bold text-xs">
                      {customerInitials(inv.order.customer)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">
                          {inv.invoiceNumber}
                        </p>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColors[inv.status] || ""}`}>
                          {inv.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{customerName(inv.order.customer)}</span>
                        <span className="text-muted-foreground/40">·</span>
                        <span>{date.toLocaleDateString()}</span>
                        <span className="text-muted-foreground/40">·</span>
                        <span>{inv.order.orderNumber}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="font-bold text-sm text-emerald-700">ETB {Number(inv.totalAmount).toFixed(2)}</p>
                      {inv.payment && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground justify-end mt-0.5">
                          {methodIcons[inv.payment.method]}
                          <span>{inv.payment.method}</span>
                        </div>
                      )}
                    </div>
                    {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {/* Expanded Detail */}
                {expanded && (
                  <div className="mt-4 pt-4 border-t border-emerald-100/60 space-y-3">
                    {/* Staff */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      <span>Server: <strong>{inv.order.server.firstName} {inv.order.server.lastName}</strong></span>
                    </div>

                    {/* Services */}
                    {inv.order.items.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-pink-400 uppercase tracking-widest flex items-center gap-1">
                          <Scissors className="h-3 w-3" /> Services
                        </p>
                        {inv.order.items.map((item) => (
                          <div key={item.id} className="flex justify-between text-xs px-2 py-1.5 rounded-lg bg-pink-50/50">
                            <span>{item.service.name} x{item.quantity}</span>
                            <span className="font-medium">ETB {(Number(item.unitPrice) * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Products */}
                    {inv.order.products.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest flex items-center gap-1">
                          <Package className="h-3 w-3" /> Products
                        </p>
                        {inv.order.products.map((p) => (
                          <div key={p.id} className="flex justify-between text-xs px-2 py-1.5 rounded-lg bg-violet-50/50">
                            <span>{p.product.name} x{p.quantity}</span>
                            <span className="font-medium">ETB {(Number(p.unitPrice) * p.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Totals */}
                    <div className="space-y-1 pt-2 border-t border-dashed border-emerald-100/60">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>ETB {Number(inv.subtotal).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Tax ({Number(inv.taxRate).toFixed(1)}%)</span>
                        <span>ETB {Number(inv.taxAmount).toFixed(2)}</span>
                      </div>
                      {Number(inv.discountAmount) > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">
                            Discount ({inv.discountType === "PERCENTAGE" ? `${Number(inv.discountValue)}%` : `ETB ${Number(inv.discountValue).toFixed(2)}`})
                          </span>
                          <span className="text-red-500">-ETB {Number(inv.discountAmount).toFixed(2)}</span>
                        </div>
                      )}
                      {Number(inv.tipAmount) > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Tip</span>
                          <span className="text-emerald-600">+ETB {Number(inv.tipAmount).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-bold pt-1">
                        <span>Total</span>
                        <span className="text-emerald-700">ETB {Number(inv.totalAmount).toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Payment */}
                    {inv.payment && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50/70 border border-emerald-100/50">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                          {methodIcons[inv.payment.method] || <CreditCard className="h-3.5 w-3.5" />}
                        </div>
                        <div className="text-xs">
                          <p className="font-medium">Paid via {inv.payment.method}</p>
                          <p className="text-muted-foreground">
                            {new Date(inv.payment.createdAt).toLocaleString()}
                            {inv.payment.reference && ` · Ref: ${inv.payment.reference}`}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border-2 border-dashed border-emerald-200 bg-gradient-to-b from-emerald-50/50 to-white">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100">
            <Receipt className="h-8 w-8 text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold">No invoices found</h3>
          <p className="text-muted-foreground text-sm mt-1 max-w-xs">
            Invoices are generated when orders are checked out by the cashier.
          </p>
        </div>
      )}
    </div>
  );
}
