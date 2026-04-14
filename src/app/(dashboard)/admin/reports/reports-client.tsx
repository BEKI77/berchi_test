"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Scissors,
  Package,
  CreditCard,
  Banknote,
  Smartphone,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  CalendarRange,
  Clock,
  Calendar,
  Globe,
  ShoppingCart,
  Target,
  Percent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type ReportData = {
  overview: {
    totalRevenue: number;
    totalTips: number;
    totalTax: number;
    totalDiscounts: number;
    totalExpenses: number;
    netProfit: number;
    todayRevenue: number;
    thisMonthRevenue: number;
    lastMonthRevenue: number;
    revenueGrowth: number;
    totalOrders: number;
    completedOrders: number;
    totalCustomers: number;
    newCustomersThisMonth: number;
    totalInvoices: number;
  };
  rangeMetrics: {
    revenue: number;
    subtotal: number;
    tips: number;
    tax: number;
    discounts: number;
    expenses: number;
    netProfit: number;
    invoiceCount: number;
    avgTransactionValue: number;
    newCustomers: number;
  };
  dailyRevenue: { date: string; revenue: number; orders: number; tips: number }[];
  busiestHours: { hour: number; label: string; count: number; revenue: number }[];
  paymentMethods: Record<string, { count: number; amount: number }>;
  staffPerformance: {
    id: string;
    name: string;
    totalOrders: number;
    completedOrders: number;
    serviceRevenue: number;
    servicesPerformed: number;
    commissionRate: number;
    commissionEarned: number;
  }[];
  allServices: { name: string; category: string; count: number; revenue: number }[];
  serviceCategories: { name: string; count: number; revenue: number }[];
  allProducts: { name: string; count: number; revenue: number }[];
  expenseByCategory: Record<string, number>;
  thisMonthExpenses: number;
  appointmentStats: {
    total: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    noShow: number;
    online: number;
    manual: number;
  };
  orderStats: {
    total: number;
    completed: number;
    inProgress: number;
    sent: number;
    cancelled: number;
  };
};

const methodIcons: Record<string, React.ReactNode> = {
  CASH: <Banknote className="h-4 w-4" />,
  CARD: <CreditCard className="h-4 w-4" />,
  MOBILE: <Smartphone className="h-4 w-4" />,
};

const methodColors: Record<string, string> = {
  CASH: "from-green-400 to-emerald-500",
  CARD: "from-blue-400 to-indigo-500",
  MOBILE: "from-orange-400 to-amber-500",
  UNKNOWN: "from-gray-400 to-gray-500",
};

const expenseCategoryColors: Record<string, string> = {
  SUPPLIES: "bg-blue-400",
  RENT: "bg-red-400",
  UTILITIES: "bg-amber-400",
  EQUIPMENT: "bg-violet-400",
  MARKETING: "bg-pink-400",
  SALARY: "bg-emerald-400",
  OTHER: "bg-gray-400",
};

function Section({ title, icon, color, children }: { title: string; icon: React.ReactNode; color: string; children: React.ReactNode }) {
  return (
    <Card className={`rounded-xl border-${color}-100 overflow-hidden`}>
      <div className={`h-1 bg-gradient-to-r from-${color}-400 to-${color}-500`} />
      <CardHeader className="pb-2">
        <CardTitle className={`text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-${color}-600`}>
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function ReportsClient() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeRange, setActiveRange] = useState<string>("all");

  const fetchReports = useCallback(async (from?: string, to?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const url = `/api/admin/reports${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      toast.error("Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  function applyPreset(preset: string) {
    const now = new Date();
    let from = "", to = "";
    if (preset === "today") {
      from = to = now.toISOString().split("T")[0];
    } else if (preset === "week") {
      const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
      from = weekAgo.toISOString().split("T")[0];
      to = now.toISOString().split("T")[0];
    } else if (preset === "month") {
      from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      to = now.toISOString().split("T")[0];
    } else if (preset === "lastMonth") {
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
      to = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];
    } else if (preset === "year") {
      from = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0];
      to = now.toISOString().split("T")[0];
    } else {
      // all time
      from = ""; to = "";
    }
    setDateFrom(from);
    setDateTo(to);
    setActiveRange(preset);
    fetchReports(from || undefined, to || undefined);
  }

  function applyCustomRange() {
    if (!dateFrom || !dateTo) { toast.error("Select both dates"); return; }
    setActiveRange("custom");
    fetchReports(dateFrom, dateTo);
  }

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-10 w-10 rounded-full border-3 border-indigo-200 border-t-indigo-500 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  if (!data) return null;

  const { overview, rangeMetrics: rm } = data;
  const maxDailyRevenue = Math.max(...data.dailyRevenue.map((d) => d.revenue), 1);
  const totalPaymentAmount = Object.values(data.paymentMethods).reduce((s, p) => s + p.amount, 0);
  const totalExpenseAmount = Object.values(data.expenseByCategory).reduce((s, v) => s + v, 0);
  const totalServiceRevenue = data.allServices.reduce((s, v) => s + v.revenue, 0);
  const maxHourCount = Math.max(...data.busiestHours.map((h) => h.count), 1);
  const rangeLabel = activeRange === "all" ? "All Time" : activeRange === "today" ? "Today" : activeRange === "week" ? "Last 7 Days" : activeRange === "month" ? "This Month" : activeRange === "lastMonth" ? "Last Month" : activeRange === "year" ? "This Year" : `${dateFrom} → ${dateTo}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-indigo-500" />
          Reports & Analytics
        </h1>
        <p className="text-muted-foreground mt-1">Complete business intelligence — every detail of your salon</p>
      </div>

      {/* Date Range Picker */}
      <Card className="rounded-xl border-indigo-100 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-indigo-400 to-purple-400" />
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarRange className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-semibold text-indigo-700">Date Range</span>
            <span className="text-xs text-muted-foreground ml-auto">Showing: <strong>{rangeLabel}</strong></span>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {[
              { key: "all", label: "All Time" },
              { key: "today", label: "Today" },
              { key: "week", label: "Last 7 Days" },
              { key: "month", label: "This Month" },
              { key: "lastMonth", label: "Last Month" },
              { key: "year", label: "This Year" },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => applyPreset(p.key)}
                disabled={loading}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  activeRange === p.key
                    ? "bg-indigo-500 text-white border-indigo-500"
                    : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-xs rounded-lg flex-1" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-xs rounded-lg flex-1" />
            <Button onClick={applyCustomRange} disabled={loading} size="sm" className="h-8 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-xs px-4">
              {loading ? "..." : "Apply"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Range Financial Summary */}
      <Card className="rounded-xl border-emerald-100 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-400" />
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-emerald-600">
            <DollarSign className="h-4 w-4" />
            Financial Summary — {rangeLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Gross Revenue", value: rm.revenue, color: "text-emerald-700", desc: `${rm.invoiceCount} invoices paid` },
              { label: "Net Profit", value: rm.netProfit, color: rm.netProfit >= 0 ? "text-emerald-700" : "text-red-600", desc: "Revenue − Expenses" },
              { label: "Tips Earned", value: rm.tips, color: "text-blue-700", desc: "Customer tips total" },
              { label: "Total Expenses", value: rm.expenses, color: "text-red-600", desc: "All business costs" },
              { label: "Avg Transaction", value: rm.avgTransactionValue, color: "text-violet-700", desc: "Per paid invoice" },
            ].map((m) => (
              <div key={m.label} className="p-3 rounded-xl bg-gray-50/80 border border-gray-100">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{m.label}</p>
                <p className={`text-lg font-bold mt-1 ${m.color}`}>ETB {m.value.toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{m.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Subtotal (before tax)", value: `ETB ${rm.subtotal.toFixed(0)}` },
              { label: "Tax Collected", value: `ETB ${rm.tax.toFixed(0)}` },
              { label: "Discounts Given", value: `ETB ${rm.discounts.toFixed(0)}` },
              { label: "New Customers", value: `${rm.newCustomers}` },
            ].map((m) => (
              <div key={m.label} className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50/50 border border-emerald-100/50">
                <div>
                  <p className="text-[10px] text-muted-foreground">{m.label}</p>
                  <p className="font-bold text-sm">{m.value}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* All-Time Key Cards */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-2">
          <Target className="h-3.5 w-3.5" /> All-Time Overview
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="rounded-xl border-emerald-100 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-400" />
            <CardContent className="pt-3 pb-3">
              <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">Total Revenue</p>
              <p className="text-xl font-bold mt-1">ETB {overview.totalRevenue.toFixed(0)}</p>
              <p className="text-[10px] text-muted-foreground">{overview.totalInvoices} invoices</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-blue-100 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-blue-400 to-indigo-400" />
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider">This Month</p>
                {overview.revenueGrowth >= 0 ? <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" /> : <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />}
              </div>
              <p className="text-xl font-bold mt-1">ETB {overview.thisMonthRevenue.toFixed(0)}</p>
              <p className={`text-[10px] font-medium ${overview.revenueGrowth >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {overview.revenueGrowth >= 0 ? "+" : ""}{overview.revenueGrowth.toFixed(1)}% vs last month
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-violet-100 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-violet-400 to-purple-400" />
            <CardContent className="pt-3 pb-3">
              <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-wider">Net Profit</p>
              <p className="text-xl font-bold mt-1">ETB {overview.netProfit.toFixed(0)}</p>
              <p className="text-[10px] text-muted-foreground">Revenue − Expenses</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-pink-100 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-pink-400 to-rose-400" />
            <CardContent className="pt-3 pb-3">
              <p className="text-[10px] font-semibold text-pink-500 uppercase tracking-wider">Today</p>
              <p className="text-xl font-bold mt-1">ETB {overview.todayRevenue.toFixed(0)}</p>
              <p className="text-[10px] text-muted-foreground">{overview.completedOrders}/{overview.totalOrders} orders done</p>
            </CardContent>
          </Card>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          {[
            { icon: <TrendingUp className="h-4 w-4" />, label: "Tips", value: `ETB ${overview.totalTips.toFixed(0)}`, bg: "bg-emerald-50/50 border-emerald-100/50", iconBg: "bg-emerald-100 text-emerald-600" },
            { icon: <TrendingDown className="h-4 w-4" />, label: "Discounts", value: `ETB ${overview.totalDiscounts.toFixed(0)}`, bg: "bg-amber-50/50 border-amber-100/50", iconBg: "bg-amber-100 text-amber-600" },
            { icon: <Users className="h-4 w-4" />, label: "Customers", value: `${overview.totalCustomers}`, extra: `+${overview.newCustomersThisMonth} this month`, bg: "bg-blue-50/50 border-blue-100/50", iconBg: "bg-blue-100 text-blue-600" },
            { icon: <DollarSign className="h-4 w-4" />, label: "Expenses", value: `ETB ${overview.totalExpenses.toFixed(0)}`, bg: "bg-red-50/50 border-red-100/50", iconBg: "bg-red-100 text-red-600" },
          ].map((m) => (
            <div key={m.label} className={`flex items-center gap-3 p-3 rounded-xl border ${m.bg}`}>
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${m.iconBg}`}>{m.icon}</div>
              <div>
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="font-bold text-sm">{m.value}</p>
                {m.extra && <p className="text-emerald-600 text-[10px] font-medium">{m.extra}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Revenue Chart */}
      <Section title={`Daily Revenue (${data.dailyRevenue.length} days)`} icon={<BarChart3 className="h-4 w-4" />} color="indigo">
        <div className="flex items-end gap-[3px] h-40">
          {data.dailyRevenue.map((d) => {
            const heightPct = maxDailyRevenue > 0 ? (d.revenue / maxDailyRevenue) * 100 : 0;
            const isToday = d.date === new Date().toISOString().split("T")[0];
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center group relative">
                <div className="absolute -top-16 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                  <div className="bg-gray-900 text-white text-[10px] px-2 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
                    <p className="font-semibold">ETB {d.revenue.toFixed(0)}</p>
                    <p className="text-gray-300">{d.orders} orders · Tips: ETB {d.tips.toFixed(0)}</p>
                    <p className="text-gray-400">{d.date}</p>
                  </div>
                </div>
                <div
                  className={`w-full rounded-t-sm transition-all ${isToday ? "bg-gradient-to-t from-indigo-500 to-indigo-400" : "bg-gradient-to-t from-indigo-200 to-indigo-300 group-hover:from-indigo-300 group-hover:to-indigo-400"}`}
                  style={{ height: `${Math.max(heightPct, 2)}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2 text-[9px] text-muted-foreground">
          <span>{data.dailyRevenue[0]?.date}</span>
          <span>{data.dailyRevenue[data.dailyRevenue.length - 1]?.date}</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100">
            <p className="text-[10px] text-muted-foreground">Best Day</p>
            <p className="font-bold text-sm text-indigo-700">ETB {Math.max(...data.dailyRevenue.map(d => d.revenue)).toFixed(0)}</p>
          </div>
          <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100">
            <p className="text-[10px] text-muted-foreground">Daily Average</p>
            <p className="font-bold text-sm text-indigo-700">ETB {(data.dailyRevenue.reduce((s, d) => s + d.revenue, 0) / Math.max(data.dailyRevenue.length, 1)).toFixed(0)}</p>
          </div>
          <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100">
            <p className="text-[10px] text-muted-foreground">Total Orders</p>
            <p className="font-bold text-sm text-indigo-700">{data.dailyRevenue.reduce((s, d) => s + d.orders, 0)}</p>
          </div>
        </div>
      </Section>

      {/* Busiest Hours */}
      {data.busiestHours.length > 0 && (
        <Section title="Busiest Hours — When Customers Come" icon={<Clock className="h-4 w-4" />} color="amber">
          <p className="text-xs text-muted-foreground mb-3">This shows which hours your salon gets the most business. Plan staffing accordingly.</p>
          <div className="flex items-end gap-1 h-28">
            {data.busiestHours.map((h) => {
              const pct = (h.count / maxHourCount) * 100;
              return (
                <div key={h.hour} className="flex-1 flex flex-col items-center group relative">
                  <div className="absolute -top-14 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                    <div className="bg-gray-900 text-white text-[10px] px-2 py-1 rounded-lg whitespace-nowrap shadow-lg">
                      <p className="font-semibold">{h.count} transactions</p>
                      <p className="text-gray-300">ETB {h.revenue.toFixed(0)}</p>
                    </div>
                  </div>
                  <div className="w-full rounded-t-sm bg-gradient-to-t from-amber-400 to-amber-300 group-hover:from-amber-500 group-hover:to-amber-400 transition-all" style={{ height: `${Math.max(pct, 4)}%` }} />
                  <span className="text-[8px] mt-1 text-muted-foreground">{h.label}</span>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Appointments & Orders */}
      <div className="grid md:grid-cols-2 gap-4">
        <Section title="Appointment Insights" icon={<Calendar className="h-4 w-4" />} color="pink">
          <p className="text-xs text-muted-foreground mb-3">Breakdown of all appointments — online bookings vs manual, and their final outcomes.</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-lg bg-pink-50 border border-pink-100 text-center">
              <p className="text-lg font-bold text-pink-700">{data.appointmentStats.total}</p>
              <p className="text-[10px] text-muted-foreground">Total Appointments</p>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-100 text-center">
              <p className="text-lg font-bold text-blue-700">{data.appointmentStats.online}</p>
              <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1"><Globe className="h-3 w-3" /> Online Bookings</p>
            </div>
          </div>
          <div className="mt-2 space-y-1.5">
            {[
              { label: "Confirmed", val: data.appointmentStats.confirmed, color: "bg-emerald-400" },
              { label: "Completed", val: data.appointmentStats.completed, color: "bg-indigo-400" },
              { label: "Cancelled", val: data.appointmentStats.cancelled, color: "bg-red-400" },
              { label: "No-Show", val: data.appointmentStats.noShow, color: "bg-amber-400" },
              { label: "Manual", val: data.appointmentStats.manual, color: "bg-gray-400" },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2"><div className={`h-2.5 w-2.5 rounded-full ${s.color}`} /><span>{s.label}</span></div>
                <span className="font-semibold">{s.val}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Order Status Breakdown" icon={<ShoppingCart className="h-4 w-4" />} color="blue">
          <p className="text-xs text-muted-foreground mb-3">Status of all service orders processed through the system.</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-100 text-center">
              <p className="text-lg font-bold text-blue-700">{data.orderStats.total}</p>
              <p className="text-[10px] text-muted-foreground">Total Orders</p>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100 text-center">
              <p className="text-lg font-bold text-emerald-700">{data.orderStats.completed}</p>
              <p className="text-[10px] text-muted-foreground">Completed & Paid</p>
            </div>
          </div>
          <div className="space-y-1.5">
            {[
              { label: "In Progress", val: data.orderStats.inProgress, color: "bg-amber-400" },
              { label: "Sent to Cashier", val: data.orderStats.sent, color: "bg-blue-400" },
              { label: "Cancelled", val: data.orderStats.cancelled, color: "bg-red-400" },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2"><div className={`h-2.5 w-2.5 rounded-full ${s.color}`} /><span>{s.label}</span></div>
                <span className="font-semibold">{s.val}</span>
              </div>
            ))}
          </div>
          {data.orderStats.total > 0 && (
            <div className="mt-3 p-2 rounded-lg bg-gray-50 border border-gray-100">
              <p className="text-[10px] text-muted-foreground">Completion Rate</p>
              <p className="font-bold text-sm">{((data.orderStats.completed / data.orderStats.total) * 100).toFixed(1)}%</p>
            </div>
          )}
        </Section>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Payment Methods */}
        <Section title="Payment Methods" icon={<CreditCard className="h-4 w-4" />} color="green">
          <p className="text-xs text-muted-foreground mb-3">How your customers prefer to pay.</p>
          {Object.entries(data.paymentMethods).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No payment data yet.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(data.paymentMethods).map(([method, info]) => {
                const pct = totalPaymentAmount > 0 ? (info.amount / totalPaymentAmount) * 100 : 0;
                return (
                  <div key={method} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br ${methodColors[method] || methodColors.UNKNOWN} text-white`}>
                          {methodIcons[method] || <CreditCard className="h-3.5 w-3.5" />}
                        </div>
                        <div>
                          <span className="font-medium">{method}</span>
                          <span className="text-[10px] text-muted-foreground ml-1">({pct.toFixed(0)}%)</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">ETB {info.amount.toFixed(0)}</p>
                        <p className="text-[10px] text-muted-foreground">{info.count} payments</p>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full bg-gradient-to-r ${methodColors[method] || methodColors.UNKNOWN}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Expenses */}
        <Section title="Expense Breakdown" icon={<Wallet className="h-4 w-4" />} color="red">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted-foreground">Where your money goes.</p>
            <span className="text-xs font-medium text-red-600">This month: ETB {data.thisMonthExpenses.toFixed(0)}</span>
          </div>
          {Object.keys(data.expenseByCategory).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No expense data yet.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(data.expenseByCategory).sort(([, a], [, b]) => b - a).map(([category, amount]) => {
                const pct = totalExpenseAmount > 0 ? (amount / totalExpenseAmount) * 100 : 0;
                return (
                  <div key={category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className={`h-3 w-3 rounded-full ${expenseCategoryColors[category] || "bg-gray-400"}`} />
                        <span className="font-medium capitalize">{category.toLowerCase()}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold">ETB {amount.toFixed(0)}</span>
                        <span className="text-[10px] text-muted-foreground ml-1">({pct.toFixed(0)}%)</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${expenseCategoryColors[category] || "bg-gray-400"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      </div>

      {/* Staff Performance */}
      <Section title="Staff Performance & Commissions" icon={<Users className="h-4 w-4" />} color="pink">
        <p className="text-xs text-muted-foreground mb-3">Each staff member&apos;s contribution — revenue generated, services performed, and commission earned.</p>
        {data.staffPerformance.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No staff data yet.</p>
        ) : (
          <div className="space-y-3">
            {data.staffPerformance.map((s, i) => {
              const maxRev = data.staffPerformance[0]?.serviceRevenue || 1;
              const pct = (s.serviceRevenue / maxRev) * 100;
              return (
                <div key={s.id} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-100 to-rose-100 text-pink-600 font-bold text-xs">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate">{s.name}</span>
                      <span className="font-semibold text-pink-700 shrink-0">ETB {s.serviceRevenue.toFixed(0)}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
                      <span>{s.completedOrders} orders</span>
                      <span>{s.servicesPerformed} services</span>
                      <span className="flex items-center gap-0.5"><Percent className="h-2.5 w-2.5" /> {s.commissionRate}% rate</span>
                      <span className="text-emerald-600 font-medium">Commission: ETB {s.commissionEarned.toFixed(0)}</span>
                    </div>
                    <div className="h-1.5 bg-pink-50 rounded-full overflow-hidden mt-1.5">
                      <div className="h-full rounded-full bg-gradient-to-r from-pink-400 to-rose-400" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Service Categories */}
      {data.serviceCategories.length > 0 && (
        <Section title="Revenue by Service Category" icon={<Scissors className="h-4 w-4" />} color="fuchsia">
          <p className="text-xs text-muted-foreground mb-3">Which categories drive the most revenue.</p>
          <div className="space-y-2">
            {data.serviceCategories.map((cat) => {
              const pct = totalServiceRevenue > 0 ? (cat.revenue / totalServiceRevenue) * 100 : 0;
              return (
                <div key={cat.name} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-fuchsia-50/50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{cat.name}</p>
                    <p className="text-[10px] text-muted-foreground">{cat.count} performed · {pct.toFixed(0)}% of revenue</p>
                  </div>
                  <span className="text-sm font-semibold text-fuchsia-700 shrink-0">ETB {cat.revenue.toFixed(0)}</span>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* All Services */}
        <Section title={`All Services (${data.allServices.length})`} icon={<Scissors className="h-4 w-4" />} color="pink">
          <p className="text-xs text-muted-foreground mb-3">Every service offered, ranked by revenue.</p>
          {data.allServices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No service data yet.</p>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
              {data.allServices.map((s, i) => (
                <div key={s.name} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-pink-50/50">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xs font-bold text-pink-400 w-5">{i + 1}.</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">{s.count} performed · {s.category}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-pink-700 shrink-0">ETB {s.revenue.toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* All Products */}
        <Section title={`All Products (${data.allProducts.length})`} icon={<Package className="h-4 w-4" />} color="violet">
          <p className="text-xs text-muted-foreground mb-3">Every product sold, ranked by revenue.</p>
          {data.allProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No product data yet.</p>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
              {data.allProducts.map((p, i) => (
                <div key={p.name} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-violet-50/50">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xs font-bold text-violet-400 w-5">{i + 1}.</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">{p.count} sold</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-violet-700 shrink-0">ETB {p.revenue.toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
