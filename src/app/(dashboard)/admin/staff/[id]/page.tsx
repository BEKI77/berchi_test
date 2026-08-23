"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Phone,
  Scissors,
  Award,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { customerName, customerInitials } from "@/lib/orders";

type StaffDetail = {
  staff: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    role: string;
    commissionRate: string;
    isActive: boolean;
    createdAt: string;
  };
  stats: {
    totalOrders: number;
    completedOrders: number;
    totalServiceRevenue: number;
    totalCommissions: number;
    servicesPerformed: number;
  };
  serviceBreakdown: { name: string; count: number; revenue: number }[];
  recentOrders: {
    id: string;
    orderNumber: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    customer: { firstName: string; lastName: string } | null;
    items: { unitPrice: string; quantity: number; service: { name: string } }[];
    products: { unitPrice: string; quantity: number; product: { name: string } }[];
  }[];
  recentCommissions: {
    id: string;
    commissionRate: string;
    serviceAmount: string;
    commissionAmount: string;
    createdAt: string;
    serviceOrderItem: {
      service: { name: string };
      order: { orderNumber: string };
    };
  }[];
};

const statusColors: Record<string, string> = {
  IN_PROGRESS: "bg-blue-50 text-blue-600 border-blue-200",
  SENT_TO_CASHIER: "bg-amber-50 text-amber-600 border-amber-200",
  CHECKED_OUT: "bg-emerald-50 text-emerald-600 border-emerald-200",
  CANCELLED: "bg-red-50 text-red-600 border-red-200",
};

export default function StaffDetailPage() {
  const router = useRouter();
  const params = useParams();
  const staffId = params.id as string;
  const [data, setData] = useState<StaffDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"orders" | "commissions" | "services">("orders");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/staff/${staffId}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      toast.error("Failed to load staff details");
    } finally {
      setLoading(false);
    }
  }, [staffId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-10 w-10 rounded-full border-3 border-pink-200 border-t-pink-500 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading staff details...</p>
      </div>
    );
  }

  const { staff, stats } = data;
  const maxServiceRevenue = data.serviceBreakdown[0]?.revenue || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/admin/staff")} className="rounded-xl hover:bg-pink-50">
          <ArrowLeft className="h-5 w-5 text-pink-500" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-pink-100 to-rose-100 text-pink-600 font-bold text-lg">
              {staff.firstName[0]}{staff.lastName[0]}
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{staff.firstName} {staff.lastName}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-[10px]">{staff.role}</Badge>
                <Badge variant="outline" className={`text-[10px] ${staff.isActive ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>
                  {staff.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Info */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {staff.email}</span>
        {staff.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {staff.phone}</span>}
        <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Joined {new Date(staff.createdAt).toLocaleDateString()}</span>
        <span className="flex items-center gap-1.5"><Award className="h-3.5 w-3.5" /> Commission: {Number(staff.commissionRate)}%</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="rounded-xl border-pink-100 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-pink-400 to-rose-400" />
          <CardContent className="pt-3 pb-3">
            <p className="text-[10px] font-semibold text-pink-500 uppercase tracking-wider">Revenue</p>
            <p className="text-xl font-bold mt-1">ETB {stats.totalServiceRevenue.toFixed(0)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-emerald-100 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-400" />
          <CardContent className="pt-3 pb-3">
            <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">Commissions</p>
            <p className="text-xl font-bold mt-1">ETB {stats.totalCommissions.toFixed(0)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-blue-100 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-blue-400 to-indigo-400" />
          <CardContent className="pt-3 pb-3">
            <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider">Orders</p>
            <p className="text-xl font-bold mt-1">{stats.totalOrders}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-violet-100 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-violet-400 to-purple-400" />
          <CardContent className="pt-3 pb-3">
            <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-wider">Completed</p>
            <p className="text-xl font-bold mt-1">{stats.completedOrders}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-amber-100 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-400" />
          <CardContent className="pt-3 pb-3">
            <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider">Services Done</p>
            <p className="text-xl font-bold mt-1">{stats.servicesPerformed}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-gray-100/80 w-fit">
        {(["orders", "commissions", "services"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t ? "bg-white shadow-sm text-pink-600" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "orders" ? "Recent Orders" : t === "commissions" ? "Commissions" : "Service Breakdown"}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "orders" && (
        <div className="space-y-2.5">
          {data.recentOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No orders yet.</div>
          ) : (
            data.recentOrders.map((order) => {
              const orderTotal =
                order.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0) +
                order.products.reduce((s, p) => s + Number(p.unitPrice) * p.quantity, 0);
              return (
                <Card key={order.id} className="rounded-xl border-pink-50 hover:border-pink-100 transition-colors">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pink-50 text-pink-600 font-bold text-xs">
                          {customerInitials(order.customer)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{customerName(order.customer)}</p>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColors[order.status] || ""}`}>
                              {order.status.replace(/_/g, " ")}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                            <span>{order.orderNumber}</span>
                            <span className="text-muted-foreground/40">·</span>
                            <span>{new Date(order.startedAt).toLocaleDateString()}</span>
                            <span className="text-muted-foreground/40">·</span>
                            <span>{order.items.length} services, {order.products.length} products</span>
                          </div>
                        </div>
                      </div>
                      <span className="font-semibold text-sm text-pink-700 shrink-0">ETB {orderTotal.toFixed(0)}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {tab === "commissions" && (
        <div className="space-y-2.5">
          {data.recentCommissions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No commission records yet.</div>
          ) : (
            data.recentCommissions.map((c) => (
              <Card key={c.id} className="rounded-xl border-emerald-50 hover:border-emerald-100 transition-colors">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{c.serviceOrderItem.service.name}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                        <span>{c.serviceOrderItem.order.orderNumber}</span>
                        <span className="text-muted-foreground/40">·</span>
                        <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                        <span className="text-muted-foreground/40">·</span>
                        <span>{Number(c.commissionRate)}% of ETB {Number(c.serviceAmount).toFixed(0)}</span>
                      </div>
                    </div>
                    <span className="font-bold text-sm text-emerald-600 shrink-0">+ETB {Number(c.commissionAmount).toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === "services" && (
        <Card className="rounded-xl border-pink-100 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-pink-400 to-rose-400" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-pink-600">
              <Scissors className="h-4 w-4" />
              Service Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.serviceBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No service data yet.</p>
            ) : (
              data.serviceBreakdown.map((s) => {
                const pct = (s.revenue / maxServiceRevenue) * 100;
                return (
                  <div key={s.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <Scissors className="h-3.5 w-3.5 text-pink-400 shrink-0" />
                        <span className="font-medium truncate">{s.name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{s.count}x</span>
                      </div>
                      <span className="font-semibold text-pink-700 shrink-0">ETB {s.revenue.toFixed(0)}</span>
                    </div>
                    <div className="h-2 bg-pink-50 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-pink-400 to-rose-400" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
