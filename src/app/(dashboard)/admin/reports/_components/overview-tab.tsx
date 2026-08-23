"use client";

import { ArrowDownRight, ArrowUpRight, DollarSign, Target, TrendingDown, TrendingUp, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ReportData } from "../types";
import { formatMoney } from "@/lib/money";

type OverviewTabProps = {
  overview: ReportData["overview"];
  rangeMetrics: ReportData["rangeMetrics"];
  rangeLabel: string;
};

export function OverviewTab({ overview, rangeMetrics, rangeLabel }: OverviewTabProps) {
  const rm = rangeMetrics;

  return (
    <>
      {/* Range Financial Summary */}
      <Card className="rounded-xl border-emerald-100 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-400" />
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-semibold text-emerald-700">Financial Summary — {rangeLabel}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              {
                label: "Gross Revenue",
                value: rm.revenue,
                color: "text-emerald-700",
                desc: `${rm.invoiceCount} invoices paid`,
              },
              {
                label: "Net Profit",
                value: rm.netProfit,
                color: rm.netProfit >= 0 ? "text-emerald-700" : "text-red-600",
                desc: "Revenue - Expenses",
              },
              { label: "Tips Earned", value: rm.tips, color: "text-blue-700", desc: "Customer tips total" },
              { label: "Total Expenses", value: rm.expenses, color: "text-red-600", desc: "All business costs" },
              {
                label: "Avg Transaction",
                value: rm.avgTransactionValue,
                color: "text-violet-700",
                desc: "Per paid invoice",
              },
            ].map((m) => (
              <div key={m.label} className="p-3 rounded-xl bg-gray-50/80 border border-gray-100">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {m.label}
                </p>
                <p className={`text-lg font-bold mt-1 ${m.color}`}>ETB {formatMoney(m.value)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{m.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Subtotal (before tax)", value: `ETB ${formatMoney(rm.subtotal)}` },
              { label: "Tax Collected", value: `ETB ${formatMoney(rm.tax)}` },
              { label: "Discounts Given", value: `ETB ${formatMoney(rm.discounts)}` },
              { label: "New Customers", value: `${rm.newCustomers}` },
            ].map((m) => (
              <div
                key={m.label}
                className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50/50 border border-emerald-100/50"
              >
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
              <p className="text-xl font-bold mt-1">ETB {formatMoney(overview.totalRevenue)}</p>
              <p className="text-[10px] text-muted-foreground">{overview.totalInvoices} invoices</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-blue-100 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-blue-400 to-indigo-400" />
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider">This Month</p>
                {overview.revenueGrowth >= 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                )}
              </div>
              <p className="text-xl font-bold mt-1">ETB {formatMoney(overview.thisMonthRevenue)}</p>
              <p
                className={`text-[10px] font-medium ${overview.revenueGrowth >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
              >
                {overview.revenueGrowth >= 0 ? "+" : ""}
                {overview.revenueGrowth.toFixed(1)}% vs last month
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-violet-100 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-violet-400 to-purple-400" />
            <CardContent className="pt-3 pb-3">
              <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-wider">Net Profit</p>
              <p className="text-xl font-bold mt-1">ETB {formatMoney(overview.netProfit)}</p>
              <p className="text-[10px] text-muted-foreground">Revenue - Expenses</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-pink-100 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-pink-400 to-rose-400" />
            <CardContent className="pt-3 pb-3">
              <p className="text-[10px] font-semibold text-pink-500 uppercase tracking-wider">Today</p>
              <p className="text-xl font-bold mt-1">ETB {formatMoney(overview.todayRevenue)}</p>
              <p className="text-[10px] text-muted-foreground">
                {overview.completedOrders}/{overview.totalOrders} orders done
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          {[
            {
              icon: <TrendingUp className="h-4 w-4" />,
              label: "Tips",
              value: `ETB ${formatMoney(overview.totalTips)}`,
              bg: "bg-emerald-50/50 border-emerald-100/50",
              iconBg: "bg-emerald-100 text-emerald-600",
            },
            {
              icon: <TrendingDown className="h-4 w-4" />,
              label: "Discounts",
              value: `ETB ${formatMoney(overview.totalDiscounts)}`,
              bg: "bg-amber-50/50 border-amber-100/50",
              iconBg: "bg-amber-100 text-amber-600",
            },
            {
              icon: <Users className="h-4 w-4" />,
              label: "Customers",
              value: `${overview.totalCustomers}`,
              extra: `+${overview.newCustomersThisMonth} this month`,
              bg: "bg-blue-50/50 border-blue-100/50",
              iconBg: "bg-blue-100 text-blue-600",
            },
            {
              icon: <DollarSign className="h-4 w-4" />,
              label: "Expenses",
              value: `ETB ${formatMoney(overview.totalExpenses)}`,
              bg: "bg-red-50/50 border-red-100/50",
              iconBg: "bg-red-100 text-red-600",
            },
          ].map((m) => (
            <div key={m.label} className={`flex items-center gap-3 p-3 rounded-xl border ${m.bg}`}>
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${m.iconBg}`}>
                {m.icon}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="font-bold text-sm">{m.value}</p>
                {m.extra && <p className="text-emerald-600 text-[10px] font-medium">{m.extra}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
