"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  Mail,
  Clock,
  Heart,
  Scissors,
  Calendar,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";
import { paymentMethodLabel } from "@/lib/payment-methods";

type CustomerDetail = {
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string | null;
    notes: string | null;
    createdAt: string;
  };
  stats: { totalSpent: number; totalVisits: number; totalTips: number };
  favoriteServices: { name: string; count: number }[];
  recentOrders: {
    id: string;
    orderNumber: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    server: { firstName: string; lastName: string };
    items: { unitPrice: number; quantity: number; service: { name: string } }[];
    products: { unitPrice: number; quantity: number; product: { name: string } }[];
  }[];
  recentAppointments: {
    id: string;
    startTime: string;
    status: string;
    staff: { firstName: string; lastName: string };
    service: { name: string };
  }[];
  recentInvoices: {
    id: string;
    invoiceNumber: string;
    totalAmount: number;
    tipAmount: number;
    status: string;
    createdAt: string;
    payment: { method: string } | null;
  }[];
};

const orderStatusColors: Record<string, string> = {
  IN_PROGRESS: "bg-blue-50 text-blue-600 border-blue-200",
  SENT_TO_CASHIER: "bg-amber-50 text-amber-600 border-amber-200",
  CHECKED_OUT: "bg-emerald-50 text-emerald-600 border-emerald-200",
  CANCELLED: "bg-red-50 text-red-600 border-red-200",
};

const apptStatusColors: Record<string, string> = {
  SCHEDULED: "bg-blue-50 text-blue-600 border-blue-200",
  CONFIRMED: "bg-indigo-50 text-indigo-600 border-indigo-200",
  IN_PROGRESS: "bg-amber-50 text-amber-600 border-amber-200",
  COMPLETED: "bg-emerald-50 text-emerald-600 border-emerald-200",
  NO_SHOW: "bg-red-50 text-red-600 border-red-200",
  CANCELLED: "bg-gray-50 text-gray-500 border-gray-200",
};

const invoiceStatusColors: Record<string, string> = {
  PAID: "bg-emerald-50 text-emerald-600 border-emerald-200",
  PENDING: "bg-amber-50 text-amber-600 border-amber-200",
  REFUNDED: "bg-blue-50 text-blue-600 border-blue-200",
  VOIDED: "bg-red-50 text-red-600 border-red-200",
};

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const customerId = params.id as string;
  const [data, setData] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"orders" | "appointments" | "invoices">("orders");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/customers/${customerId}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      toast.error("Failed to load customer details");
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-10 w-10 rounded-full border-3 border-rose-200 border-t-rose-500 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading customer details...</p>
      </div>
    );
  }

  const { customer, stats } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/admin/customers")} className="rounded-xl hover:bg-rose-50">
          <ArrowLeft className="h-5 w-5 text-rose-500" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-rose-100 to-pink-100 text-rose-600 font-bold text-lg">
              {customer.firstName[0]}{customer.lastName[0]}
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{customer.firstName} {customer.lastName}</h1>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                {customer.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {customer.phone}</span>}
                {customer.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {customer.email}</span>}
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Since {new Date(customer.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {customer.notes && (
        <p className="text-sm text-muted-foreground italic px-1">{customer.notes}</p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="rounded-xl border-rose-100 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-rose-400 to-pink-400" />
          <CardContent className="pt-3 pb-3">
            <p className="text-[10px] font-semibold text-rose-500 uppercase tracking-wider">Total Spent</p>
            <p className="text-xl font-bold mt-1">ETB {formatMoney(stats.totalSpent)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-blue-100 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-blue-400 to-indigo-400" />
          <CardContent className="pt-3 pb-3">
            <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider">Visits</p>
            <p className="text-xl font-bold mt-1">{stats.totalVisits}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-emerald-100 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-400" />
          <CardContent className="pt-3 pb-3">
            <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">Tips Given</p>
            <p className="text-xl font-bold mt-1">ETB {formatMoney(stats.totalTips)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Favorite Services */}
      {data.favoriteServices.length > 0 && (
        <Card className="rounded-xl border-pink-100 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-pink-400 to-fuchsia-400" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-pink-600">
              <Heart className="h-4 w-4" />
              Favorite Services
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {data.favoriteServices.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-pink-50 border border-pink-100 text-sm">
                <Scissors className="h-3 w-3 text-pink-400" />
                <span className="font-medium">{s.name}</span>
                <span className="text-[10px] text-pink-500 font-semibold">{s.count}x</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-gray-100/80 w-fit">
        {(["orders", "appointments", "invoices"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
              tab === t ? "bg-white shadow-sm text-rose-600" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Orders Tab */}
      {tab === "orders" && (
        <div className="space-y-2.5">
          {data.recentOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No orders yet.</div>
          ) : (
            data.recentOrders.map((order) => {
              const total =
                order.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0) +
                order.products.reduce((s, p) => s + Number(p.unitPrice) * p.quantity, 0);
              return (
                <Card key={order.id} className="rounded-xl border-rose-50 hover:border-rose-100 transition-colors">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{order.orderNumber}</p>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${orderStatusColors[order.status] || ""}`}>
                            {order.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                          <span>{new Date(order.startedAt).toLocaleDateString()}</span>
                          <span className="text-muted-foreground/40">·</span>
                          <span>Server: {order.server.firstName}</span>
                          <span className="text-muted-foreground/40">·</span>
                          <span>{order.items.length} services, {order.products.length} products</span>
                        </div>
                      </div>
                      <span className="font-semibold text-sm text-rose-700 shrink-0">ETB {formatMoney(total)}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Appointments Tab */}
      {tab === "appointments" && (
        <div className="space-y-2.5">
          {data.recentAppointments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No appointments yet.</div>
          ) : (
            data.recentAppointments.map((appt) => (
              <Card key={appt.id} className="rounded-xl border-blue-50 hover:border-blue-100 transition-colors">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <Calendar className="h-4 w-4 text-blue-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{appt.service.name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                          <span>{new Date(appt.startTime).toLocaleDateString()} {new Date(appt.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          <span className="text-muted-foreground/40">·</span>
                          <span>With {appt.staff.firstName} {appt.staff.lastName}</span>
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${apptStatusColors[appt.status] || ""}`}>
                      {appt.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Invoices Tab */}
      {tab === "invoices" && (
        <div className="space-y-2.5">
          {data.recentInvoices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No invoices yet.</div>
          ) : (
            data.recentInvoices.map((inv) => (
              <Card key={inv.id} className="rounded-xl border-emerald-50 hover:border-emerald-100 transition-colors">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <Receipt className="h-4 w-4 text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${invoiceStatusColors[inv.status] || ""}`}>
                            {inv.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                          <span>{new Date(inv.createdAt).toLocaleDateString()}</span>
                          {inv.payment && (
                            <>
                              <span className="text-muted-foreground/40">·</span>
                              <span>{paymentMethodLabel(inv.payment.method)}</span>
                            </>
                          )}
                          {Number(inv.tipAmount) > 0 && (
                            <>
                              <span className="text-muted-foreground/40">·</span>
                              <span className="text-emerald-600">Tip: ETB {formatMoney(Number(inv.tipAmount))}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="font-semibold text-sm text-emerald-700 shrink-0">ETB {formatMoney(Number(inv.totalAmount))}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
