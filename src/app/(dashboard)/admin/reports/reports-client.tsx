"use client";

import { useEffect, useState, useCallback } from "react";
import { BarChart3, Calendar } from "lucide-react";
import { toast } from "sonner";
import type { ReportData } from "./types";
import { TabNav } from "./_components/tab-nav";
import { DateRangeCard } from "./_components/date-range-card";
import { OverviewTab } from "./_components/overview-tab";
import { RevenueTab } from "./_components/revenue-tab";
import { OperationsTab } from "./_components/operations-tab";
import { MoneyTab } from "./_components/money-tab";
import { TeamTab } from "./_components/team-tab";

export function ReportsClient() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeRange, setActiveRange] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"overview" | "revenue" | "operations" | "money" | "team">("overview");

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
  const rangeLabel = (() => {
    switch (activeRange) {
      case "all":
        return "All Time";
      case "today":
        return "Today";
      case "week":
        return "Last 7 Days";
      case "month":
        return "This Month";
      case "lastMonth":
        return "Last Month";
      case "year":
        return "This Year";
      default:
        return `${dateFrom} → ${dateTo}`;
    }
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-indigo-500" />
              Reports & Analytics
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Complete business intelligence — every detail of your salon.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              Showing: <strong>{rangeLabel}</strong>
            </span>
          </div>
        </div>

        <TabNav activeTab={activeTab} onChange={setActiveTab} />
      </div>

      <DateRangeCard
        rangeLabel={rangeLabel}
        activeRange={activeRange}
        loading={loading}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onPreset={applyPreset}
        onChangeFrom={setDateFrom}
        onChangeTo={setDateTo}
        onApplyCustom={applyCustomRange}
      />

      {activeTab === "overview" && (
        <OverviewTab overview={overview} rangeMetrics={rm} rangeLabel={rangeLabel} />
      )}

      {activeTab === "revenue" && (
        <RevenueTab dailyRevenue={data.dailyRevenue} busiestHours={data.busiestHours} />
      )}

      {activeTab === "operations" && (
        <OperationsTab appointmentStats={data.appointmentStats} orderStats={data.orderStats} />
      )}

      {activeTab === "money" && (
        <MoneyTab
          paymentMethods={data.paymentMethods}
          expenseByCategory={data.expenseByCategory}
          thisMonthExpenses={data.thisMonthExpenses}
        />
      )}

      {activeTab === "team" && (
        <TeamTab
          staffPerformance={data.staffPerformance}
          serviceCategories={data.serviceCategories}
          allServices={data.allServices}
          allProducts={data.allProducts}
        />
      )}
    </div>
  );
}
