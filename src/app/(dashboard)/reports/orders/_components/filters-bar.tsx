"use client";

import { CalendarRange, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import { PRESETS, STATUS_META, STATUS_ORDER, type Filters, type OrderStatus, type PresetKey } from "./report-utils";

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none transition-colors focus-visible:border-pink-300 focus-visible:ring-2 focus-visible:ring-pink-100";

export function DateRangeBar({
  preset,
  from,
  to,
  loading,
  onPreset,
  onCustom,
}: {
  preset: PresetKey;
  from: string;
  to: string;
  loading: boolean;
  onPreset: (key: Exclude<PresetKey, "custom">) => void;
  onCustom: (from: string, to: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-pink-100/70 bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-pink-700">
        <CalendarRange className="h-4 w-4 text-pink-500" /> Date range
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Presets scroll sideways on a phone instead of wrapping into a wall of
            buttons. inline-size containment stops the row's full width from
            counting as the page's minimum width, which would push the layout
            wider than the screen. */}
        <div className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 pb-1 [contain:inline-size] lg:pb-0 [scrollbar-width:none]">
          {PRESETS.map((p) => (
            <Button
              key={p.key}
              type="button"
              size="sm"
              variant={preset === p.key ? "default" : "outline"}
              disabled={loading}
              onClick={() => onPreset(p.key)}
              className={cn(
                "shrink-0 rounded-full text-xs",
                preset === p.key && "bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:from-pink-600 hover:to-rose-600",
              )}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2 lg:w-[22rem]">
          <Input
            type="date"
            aria-label="From date"
            value={from}
            max={to}
            onChange={(e) => e.target.value && onCustom(e.target.value, to)}
            className={cn("h-9 min-w-0 flex-1 rounded-lg text-sm", preset === "custom" && "border-pink-300")}
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            aria-label="To date"
            value={to}
            min={from}
            onChange={(e) => e.target.value && onCustom(from, e.target.value)}
            className={cn("h-9 min-w-0 flex-1 rounded-lg text-sm", preset === "custom" && "border-pink-300")}
          />
        </div>
      </div>
    </div>
  );
}

export function FiltersBar({
  filters,
  staffOptions,
  onChange,
  showStatus,
}: {
  filters: Filters;
  staffOptions: { id: string; name: string }[];
  onChange: (next: Filters) => void;
  showStatus: OrderStatus[];
}) {
  const activeCount =
    (filters.search ? 1 : 0) + filters.statuses.length + (filters.method !== "all" ? 1 : 0) + (filters.staffId !== "all" ? 1 : 0);

  function toggleStatus(s: OrderStatus) {
    const has = filters.statuses.includes(s);
    onChange({ ...filters, statuses: has ? filters.statuses.filter((x) => x !== s) : [...filters.statuses, s] });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-pink-100/70 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Ticket no., name, phone, invoice, service…"
            className="h-9 rounded-lg pl-9 text-sm"
          />
        </div>
        {activeCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange({ search: "", statuses: [], method: "all", staffId: "all" })}
            className="shrink-0 rounded-lg text-xs text-muted-foreground"
          >
            <X className="mr-1 h-3.5 w-3.5" /> Clear ({activeCount})
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        {showStatus.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {STATUS_ORDER.filter((s) => showStatus.includes(s)).map((s) => {
              const on = filters.statuses.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleStatus(s)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    on ? STATUS_META[s].badge : "border-gray-200 text-muted-foreground hover:bg-gray-50",
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_META[s].dot)} />
                  {STATUS_META[s].label}
                </button>
              );
            })}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 md:ml-auto md:w-[26rem]">
          <label className="block">
            <span className="sr-only">Payment method</span>
            <select
              value={filters.method}
              onChange={(e) => onChange({ ...filters, method: e.target.value })}
              className={selectClass}
            >
              <option value="all">All payments</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
              <option value="CARD">Card (legacy)</option>
              <option value="UNPAID">Not paid</option>
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Stylist</span>
            <select
              value={filters.staffId}
              onChange={(e) => onChange({ ...filters, staffId: e.target.value })}
              className={selectClass}
            >
              <option value="all">All stylists</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground md:hidden">
        <SlidersHorizontal className="h-3 w-3" /> Tap a ticket for its full breakdown.
      </p>
    </div>
  );
}
