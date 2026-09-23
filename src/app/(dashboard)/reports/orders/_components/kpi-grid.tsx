"use client";

import { Ban, Banknote, CheckCircle2, Clock, Heart, Receipt, Tag, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import type { Summary } from "./report-utils";

type Tile = {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
};

function minutesLabel(m: number | null): string {
  if (m === null) return "—";
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** The headline numbers for the filtered tickets. */
export function KpiGrid({ summary, activeCount, activeValue }: { summary: Summary; activeCount: number; activeValue: number }) {
  const s = summary;
  const tiles: Tile[] = [
    {
      label: "Revenue collected",
      value: `ETB ${formatMoney(s.revenue)}`,
      hint: `${s.paidCount} paid ticket${s.paidCount === 1 ? "" : "s"}`,
      icon: Banknote,
      tone: "from-emerald-500 to-teal-500 shadow-emerald-200/50",
    },
    {
      label: "Tickets",
      value: String(s.tickets),
      hint: `${s.byStatus.CHECKED_OUT.count} paid · ${s.byStatus.CANCELLED.count} cancelled`,
      icon: Receipt,
      tone: "from-blue-500 to-indigo-500 shadow-blue-200/50",
    },
    {
      label: "Average ticket",
      value: `ETB ${formatMoney(s.avgTicket)}`,
      hint: "per paid ticket",
      icon: CheckCircle2,
      tone: "from-violet-500 to-purple-500 shadow-violet-200/50",
    },
    {
      label: "Tips",
      value: `ETB ${formatMoney(s.tips)}`,
      hint: s.revenue > 0 ? `${((s.tips / s.revenue) * 100).toFixed(1)}% of revenue` : undefined,
      icon: Heart,
      tone: "from-pink-500 to-rose-500 shadow-pink-200/50",
    },
  ];

  const minor: Tile[] = [
    { label: "Open now", value: `${activeCount}`, hint: `ETB ${formatMoney(activeValue)} running`, icon: Clock, tone: "text-amber-600 bg-amber-50" },
    { label: "Discounts given", value: `ETB ${formatMoney(s.discounts)}`, icon: Tag, tone: "text-red-600 bg-red-50" },
    {
      label: "Cancelled value",
      value: `ETB ${formatMoney(s.cancelledValue)}`,
      hint: `${s.byStatus.CANCELLED.count} ticket${s.byStatus.CANCELLED.count === 1 ? "" : "s"}`,
      icon: Ban,
      tone: "text-gray-600 bg-gray-100",
    },
    { label: "Avg. time to pay", value: minutesLabel(s.avgServiceMinutes), hint: "opened → paid", icon: Timer, tone: "text-sky-600 bg-sky-50" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div
            key={t.label}
            className={cn("relative overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-white shadow-lg", t.tone)}
          >
            <div className="absolute right-0 top-0 h-16 w-16 -translate-y-4 translate-x-4 rounded-full bg-white/10" />
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/80">
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </div>
            <p className="truncate text-lg font-bold tabular-nums sm:text-xl">{t.value}</p>
            {t.hint && <p className="mt-0.5 truncate text-[11px] text-white/75">{t.hint}</p>}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {minor.map((t) => (
          <div key={t.label} className="flex items-center gap-3 rounded-2xl border border-pink-100/70 bg-white p-3 shadow-sm">
            <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", t.tone)}>
              <t.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t.label}</p>
              <p className="truncate text-sm font-bold tabular-nums">{t.value}</p>
              {t.hint && <p className="truncate text-[10px] text-muted-foreground">{t.hint}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
