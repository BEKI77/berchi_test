"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, ClipboardList, Download, History, Inbox, LineChart, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOrderEvents } from "@/lib/use-order-events";
import { todayKey } from "@/lib/report-range";
import type { OrderReport, ReportOrder } from "@/lib/order-report";
import { DateRangeBar, FiltersBar } from "./_components/filters-bar";
import { KpiGrid } from "./_components/kpi-grid";
import { Breakdowns } from "./_components/breakdowns";
import { OrderCard } from "./_components/order-card";
import { OrdersTable } from "./_components/orders-table";
import { OrderDetailSheet } from "./_components/order-detail-sheet";
import { Money } from "./_components/order-bits";
import {
  EMPTY_FILTERS,
  applyFilters,
  makeFormatters,
  orderValue,
  personName,
  presetRange,
  sortOrders,
  summarize,
  toCsv,
  type Filters,
  type PresetKey,
  type Sort,
  type SortKey,
} from "./_components/report-utils";

type Tab = "active" | "history" | "insights";

const PAGE_SIZE = 25;

// Until the first response names the salon's timezone. lib/order-numbers has the
// same default but reads the database, so it cannot be imported here.
const FALLBACK_TIMEZONE = "Africa/Addis_Ababa";

export function OrdersReportClient({ canCheckout }: { canCheckout: boolean }) {
  const [report, setReport] = useState<OrderReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<PresetKey>("today");
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [tab, setTabState] = useState<Tab>("active");
  const [filters, setFiltersState] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSortState] = useState<Sort>({ key: "opened", dir: "desc" });
  const [page, setPage] = useState(1);

  // Anything that changes the list goes back to its first page.
  const setTab = (t: Tab) => { setTabState(t); setPage(1); };
  const setFilters = (f: Filters) => { setFiltersState(f); setPage(1); };
  const setSort = (s: Sort) => { setSortState(s); setPage(1); };
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const timeZone = report?.timeZone ?? FALLBACK_TIMEZONE;
  const fmt = useMemo(() => makeFormatters(timeZone), [timeZone]);

  // Live updates and range changes can overlap; only the newest answer counts.
  const requestSeq = useRef(0);

  const fetchReport = useCallback(async () => {
    const seq = ++requestSeq.current;
    const qs = range ? `?from=${range.from}&to=${range.to}` : "";
    try {
      const res = await fetch(`/api/reports/orders${qs}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load the report");
      if (seq !== requestSeq.current) return;
      setReport(data as OrderReport);
    } catch (err) {
      if (seq === requestSeq.current) toast.error(err instanceof Error ? err.message : "Failed to load the report");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [range]);

  // Fires on connect and on every ticket change anywhere in the salon.
  useOrderEvents(fetchReport);

  // The first load comes from the event stream connecting; after that, a new
  // range fetches straight away.
  useEffect(() => {
    if (range) fetchReport();
  }, [range, fetchReport]);

  function changeRange(next: { from: string; to: string }) {
    setLoading(true);
    setRange(next);
    setPage(1);
  }

  function choosePreset(key: Exclude<PresetKey, "custom">) {
    setPreset(key);
    changeRange(presetRange(key, timeZone));
  }

  function chooseCustom(from: string, to: string) {
    setPreset("custom");
    changeRange(from <= to ? { from, to } : { from: to, to: from });
  }

  function toggleSort(key: SortKey) {
    setSort(
      sort.key === key
        ? { key, dir: sort.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "customer" || key === "ticket" ? "asc" : "desc" },
    );
  }

  // The numbers describe the range the data came back for; the date inputs
  // show the one just picked, which may still be loading.
  const from = report?.from ?? todayKey(timeZone);
  const to = report?.to ?? from;
  const multiDay = from !== to;

  const active = useMemo(() => report?.active ?? [], [report]);
  const history = useMemo(() => report?.history ?? [], [report]);

  const filteredHistory = useMemo(() => applyFilters(history, filters), [history, filters]);
  const filteredActive = useMemo(() => applyFilters(active, filters), [active, filters]);
  const summary = useMemo(() => summarize(filteredHistory, fmt, from, to, timeZone), [filteredHistory, fmt, from, to, timeZone]);

  const activeValue = useMemo(() => filteredActive.reduce((s, o) => s + orderValue(o), 0), [filteredActive]);
  const today = todayKey(timeZone);
  const carriedOver = active.filter((o) => fmt.dayKey(o.startedAt) < today);

  const staffOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of [...active, ...history]) {
      for (const i of o.items) if (i.staff) map.set(i.staff.id, personName(i.staff));
      if (o.server) map.set(o.server.id, personName(o.server));
    }
    return [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [active, history]);

  const list = tab === "active" ? filteredActive : filteredHistory;
  const sorted = useMemo(() => sortOrders(list, sort), [list, sort]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  // A live update can shrink the list under the current page.
  const currentPage = Math.min(page, pageCount);
  const pageRows = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const filtering =
    filters.search.trim() !== "" || filters.statuses.length > 0 || filters.method !== "all" || filters.staffId !== "all";

  const selected = selectedId ? [...active, ...history].find((o) => o.id === selectedId) ?? null : null;
  const openOrder = (o: ReportOrder) => setSelectedId(o.id);

  function exportCsv() {
    const rows = sortOrders(tab === "active" ? filteredActive : filteredHistory, sort);
    if (rows.length === 0) {
      toast.info("Nothing to export with these filters");
      return;
    }
    const blob = new Blob(["﻿" + toCsv(rows, fmt)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = tab === "active" ? `open-orders-${today}.csv` : `orders-${from}${multiDay ? `_to_${to}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const rangeLabel = multiDay ? `${fmt.keyLabel(from)} – ${fmt.keyLabel(to)}` : from === today ? `Today, ${fmt.keyLabel(from)}` : fmt.keyLabel(from);

  if (!report && loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-pink-200 border-t-pink-500" />
        <p className="text-sm text-muted-foreground">Loading order report…</p>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }[] = [
    { key: "active", label: "Active", icon: ClipboardList, count: filteredActive.length },
    { key: "history", label: "History", icon: History, count: filteredHistory.length },
    { key: "insights", label: "Insights", icon: LineChart },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-4 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ClipboardList className="h-6 w-6 text-pink-500" /> Order Report
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <span>{rangeLabel}</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live · updated {report ? fmt.time(report.generatedAt) : "—"}
            </span>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button variant="outline" onClick={() => { setLoading(true); fetchReport(); }} disabled={loading} className="rounded-xl border-pink-200 hover:bg-pink-50">
            <RefreshCw className={cn("mr-2 h-4 w-4 text-pink-500", loading && "animate-spin")} /> Refresh
          </Button>
          <Button onClick={exportCsv} disabled={tab === "insights"} className="rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:from-pink-600 hover:to-rose-600">
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <DateRangeBar preset={preset} from={range?.from ?? from} to={range?.to ?? to} loading={loading} onPreset={choosePreset} onCustom={chooseCustom} />

      {report?.truncated && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          This range has more tickets than the report can show at once, so the oldest were left out. Pick a shorter range for exact totals.
        </div>
      )}

      <KpiGrid summary={summary} activeCount={filteredActive.length} activeValue={activeValue} />

      {/* Tabs */}
      <div className="sticky top-0 z-20 -mx-4 bg-white/85 px-4 py-2 backdrop-blur md:-mx-6 md:px-6">
        <div role="tablist" className="grid grid-cols-3 gap-1 rounded-2xl bg-pink-50/80 p-1 sm:inline-grid sm:w-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all sm:px-5",
                tab === t.key ? "bg-white text-pink-700 shadow-sm" : "text-muted-foreground hover:text-pink-600",
              )}
            >
              <t.icon className="h-4 w-4" />
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", tab === t.key ? "bg-pink-100 text-pink-700" : "bg-white/70")}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <FiltersBar
        filters={filters}
        staffOptions={staffOptions}
        onChange={setFilters}
        showStatus={tab === "active" ? ["IN_PROGRESS", "SENT_TO_CASHIER"] : ["IN_PROGRESS", "SENT_TO_CASHIER", "CHECKED_OUT", "CANCELLED"]}
      />

      {tab === "insights" ? (
        <Breakdowns summary={summary} fmt={fmt} multiDay={multiDay} />
      ) : (
        <>
          {tab === "active" && carriedOver.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>{carriedOver.length}</strong> ticket{carriedOver.length === 1 ? " was" : "s were"} opened on an earlier day and{" "}
                {carriedOver.length === 1 ? "is" : "are"} still open. Close or cancel {carriedOver.length === 1 ? "it" : "them"} so the day balances.
              </span>
            </div>
          )}
          {tab === "active" && (
            <p className="text-xs text-muted-foreground">
              Every ticket still on the floor, whatever day it was opened. The date range applies to History and Insights.
            </p>
          )}

          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-pink-200 bg-gradient-to-b from-pink-50/50 to-white py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-100">
                <Inbox className="h-7 w-7 text-pink-400" />
              </div>
              <h3 className="font-semibold">{tab === "active" ? "No open tickets" : "No tickets in this range"}</h3>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                {!filtering
                  ? tab === "active"
                    ? "Everything is closed out. New tickets appear here the moment reception opens them."
                    : "Try another date range."
                  : "Nothing matches these filters."}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {sorted.length} ticket{sorted.length === 1 ? "" : "s"} · <Money value={sorted.reduce((s, o) => s + (o.status === "CANCELLED" ? 0 : orderValue(o)), 0)} className="font-semibold text-gray-700" />
                  {tab === "active" ? " running" : " excl. cancelled"}
                </span>
                {/* Sort control for the card layout, which has no column headers. */}
                <label className="flex items-center gap-1.5 md:hidden">
                  Sort
                  <select
                    value={`${sort.key}:${sort.dir}`}
                    onChange={(e) => {
                      const [key, dir] = e.target.value.split(":") as [SortKey, Sort["dir"]];
                      setSort({ key, dir });
                    }}
                    className="h-8 rounded-lg border border-input bg-white px-2 text-xs"
                  >
                    <option value="opened:desc">Newest first</option>
                    <option value="opened:asc">Oldest first</option>
                    <option value="total:desc">Highest total</option>
                    <option value="total:asc">Lowest total</option>
                    <option value="customer:asc">Customer A–Z</option>
                    <option value="status:asc">Status</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 md:hidden">
                {pageRows.map((o) => (
                  <OrderCard key={o.id} order={o} fmt={fmt} showDate={tab === "active" || multiDay} onOpen={openOrder} />
                ))}
              </div>
              <div className="hidden md:block">
                <OrdersTable orders={pageRows} fmt={fmt} showDate={tab === "active" || multiDay} sort={sort} onSort={toggleSort} onOpen={openOrder} />
              </div>

              {pageCount > 1 && (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, sorted.length)} of {sorted.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="rounded-lg" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                      <ChevronLeft className="h-4 w-4" /> <span className="sr-only sm:not-sr-only">Prev</span>
                    </Button>
                    <span className="px-2 text-xs tabular-nums">{currentPage} / {pageCount}</span>
                    <Button variant="outline" size="sm" className="rounded-lg" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>
                      <span className="sr-only sm:not-sr-only">Next</span> <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      <OrderDetailSheet order={selected} fmt={fmt} canCheckout={canCheckout} onClose={() => setSelectedId(null)} />
    </div>
  );
}
