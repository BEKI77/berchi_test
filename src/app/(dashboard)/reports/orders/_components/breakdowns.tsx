"use client";

import { BarChart3, Clock4, CreditCard, Package, Scissors, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { MethodBadge, Money } from "./order-bits";
import { STATUS_META, STATUS_ORDER, type Formatters, type Summary } from "./report-utils";

function Panel({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-pink-100/70 bg-white p-4 shadow-sm", className)}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-50 text-pink-500">
          <Icon className="h-3.5 w-3.5" />
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-xs text-muted-foreground">{children}</p>;
}

/** A labelled horizontal bar: the label and value in ink, the bar carries magnitude. */
function BarRow({ label, value, share, sub }: { label: React.ReactNode; value: React.ReactNode; share: number; sub?: React.ReactNode }) {
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="min-w-0 truncate font-medium text-gray-800">{label}</span>
        <span className="shrink-0 font-semibold tabular-nums">{value}</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-pink-50">
          <div className="h-full rounded-full bg-gradient-to-r from-pink-400 to-rose-500" style={{ width: `${Math.max(2, share * 100)}%` }} />
        </div>
        {sub && <span className="w-24 shrink-0 text-right text-[10px] text-muted-foreground">{sub}</span>}
      </div>
    </li>
  );
}

/** Daily revenue as columns, one hue; hover or focus a day for its numbers. */
function DailyChart({ daily, fmt }: { daily: Summary["daily"]; fmt: Formatters }) {
  const max = Math.max(...daily.map((d) => d.revenue), 1);
  const labelEvery = Math.ceil(daily.length / 8);
  return (
    <div>
      <div className="flex h-40 items-end gap-[2px]" role="list" aria-label="Revenue per day">
        {daily.map((d, idx) => {
          const pct = (d.revenue / max) * 100;
          const alignRight = idx > daily.length * 0.66;
          return (
            <div
              key={d.key}
              role="listitem"
              tabIndex={0}
              aria-label={`${fmt.keyLabel(d.key)}: ETB ${formatMoney(d.revenue)}, ${d.tickets} tickets`}
              className="group relative flex h-full min-w-0 flex-1 items-end rounded-sm outline-none hover:bg-pink-50/60 focus-visible:bg-pink-50"
            >
              <div
                className="w-full rounded-t-[4px] bg-gradient-to-t from-pink-400 to-rose-400 transition-opacity group-hover:opacity-80"
                style={{ height: d.revenue > 0 ? `${Math.max(pct, 2)}%` : "0%" }}
              />
              <div
                className={cn(
                  "pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-[11px] text-white shadow-lg group-hover:block group-focus-visible:block",
                  alignRight ? "right-0" : "left-0",
                )}
              >
                <p className="font-semibold">{fmt.keyLabel(d.key)}</p>
                <p>ETB {formatMoney(d.revenue)}</p>
                <p className="text-white/70">{d.tickets} ticket{d.tickets === 1 ? "" : "s"}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-[2px] border-t border-gray-100 pt-1">
        {daily.map((d, idx) => (
          <div key={d.key} className="min-w-0 flex-1 text-center text-[9px] text-muted-foreground">
            {idx % labelEvery === 0 ? fmt.keyLabel(d.key) : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Tickets opened per hour of the day, trimmed to the hours the salon was busy. */
function HourlyChart({ hourly }: { hourly: Summary["hourly"] }) {
  const busy = hourly.filter((h) => h.tickets > 0);
  if (busy.length === 0) return <Empty>No tickets in this range.</Empty>;
  const first = busy[0].hour;
  const last = busy[busy.length - 1].hour;
  const hours = hourly.slice(first, last + 1);
  const max = Math.max(...hours.map((h) => h.tickets), 1);
  const peak = hours.reduce((a, b) => (b.tickets > a.tickets ? b : a));
  return (
    <div>
      <div className="flex h-28 items-end gap-1">
        {hours.map((h) => (
          <div key={h.hour} className="group relative flex h-full flex-1 items-end" title={`${h.hour}:00 — ${h.tickets} tickets`}>
            <div
              className={cn(
                "w-full rounded-t-[4px] bg-gradient-to-t",
                h.hour === peak.hour ? "from-rose-500 to-pink-400" : "from-pink-200 to-pink-300",
              )}
              style={{ height: h.tickets > 0 ? `${Math.max((h.tickets / max) * 100, 4)}%` : "0%" }}
            />
            <span className="pointer-events-none absolute -top-5 left-1/2 hidden -translate-x-1/2 rounded bg-gray-900 px-1.5 py-0.5 text-[10px] text-white group-hover:block">
              {h.tickets}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 border-t border-gray-100 pt-1">
        {hours.map((h) => (
          <div key={h.hour} className="flex-1 text-center text-[9px] tabular-nums text-muted-foreground">
            {String(h.hour).padStart(2, "0")}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Busiest hour: <strong className="text-gray-700">{String(peak.hour).padStart(2, "0")}:00</strong> with {peak.tickets} ticket{peak.tickets === 1 ? "" : "s"} opened.
      </p>
    </div>
  );
}

export function Breakdowns({ summary, fmt, multiDay }: { summary: Summary; fmt: Formatters; multiDay: boolean }) {
  const s = summary;
  const maxService = s.topServices[0]?.amount ?? 1;
  const maxProduct = s.topProducts[0]?.amount ?? 1;
  const maxStaff = s.staff[0]?.amount ?? 1;
  const statusTotal = Math.max(s.tickets, 1);

  return (
    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
      {multiDay ? (
        <Panel title="Revenue by day" icon={BarChart3} className="lg:col-span-2 xl:col-span-2">
          {s.revenue > 0 ? <DailyChart daily={s.daily} fmt={fmt} /> : <Empty>No payments in this range.</Empty>}
        </Panel>
      ) : (
        <Panel title="Tickets by hour" icon={Clock4} className="lg:col-span-2 xl:col-span-2">
          <HourlyChart hourly={s.hourly} />
        </Panel>
      )}

      <Panel title="Ticket status" icon={Clock4}>
        {s.tickets === 0 ? (
          <Empty>No tickets in this range.</Empty>
        ) : (
          <>
            <div className="mb-3 flex h-3 gap-[2px] overflow-hidden rounded-full">
              {STATUS_ORDER.filter((st) => s.byStatus[st].count > 0).map((st) => (
                <div
                  key={st}
                  className={cn("h-full bg-gradient-to-r first:rounded-l-full last:rounded-r-full", STATUS_META[st].bar)}
                  style={{ width: `${(s.byStatus[st].count / statusTotal) * 100}%` }}
                  title={`${STATUS_META[st].label}: ${s.byStatus[st].count}`}
                />
              ))}
            </div>
            <ul className="space-y-2">
              {STATUS_ORDER.map((st) => (
                <li key={st} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", STATUS_META[st].dot)} />
                    {STATUS_META[st].label}
                  </span>
                  <span className="flex items-center gap-3 tabular-nums">
                    <span className="text-muted-foreground"><Money value={s.byStatus[st].value} /></span>
                    <span className="w-8 text-right font-semibold">{s.byStatus[st].count}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      <Panel title="Payment methods" icon={CreditCard}>
        {s.methods.length === 0 ? (
          <Empty>No payments in this range.</Empty>
        ) : (
          <ul className="space-y-3">
            {s.methods.map((m) => (
              <BarRow
                key={m.method}
                label={<MethodBadge method={m.method} />}
                value={<Money value={m.amount} />}
                share={m.amount / Math.max(s.revenue, 1)}
                sub={`${m.count} · ${((m.amount / Math.max(s.revenue, 1)) * 100).toFixed(0)}%`}
              />
            ))}
          </ul>
        )}
        {s.revenue > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-dashed border-pink-100 pt-3 text-center">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Services</p>
              <Money value={s.services} className="text-xs font-semibold" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Products</p>
              <Money value={s.products} className="text-xs font-semibold" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tax</p>
              <Money value={s.tax} className="text-xs font-semibold" />
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Top services" icon={Scissors}>
        {s.topServices.length === 0 ? (
          <Empty>No services sold in this range.</Empty>
        ) : (
          <ul className="space-y-3">
            {s.topServices.slice(0, 8).map((sv) => (
              <BarRow key={sv.name} label={sv.name} value={<Money value={sv.amount} />} share={sv.amount / maxService} sub={`${sv.count}×`} />
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Stylist performance" icon={Users}>
        {s.staff.length === 0 ? (
          <Empty>No services credited in this range.</Empty>
        ) : (
          <ul className="space-y-3">
            {s.staff.map((st) => (
              <BarRow
                key={st.id}
                label={st.name}
                value={<Money value={st.amount} />}
                share={st.amount / maxStaff}
                sub={`${st.services} svc · ${st.tickets} tkt`}
              />
            ))}
          </ul>
        )}
        <p className="mt-3 text-[10px] text-muted-foreground">Service value credited to each stylist, before tax, discount and tip. Excludes cancelled tickets.</p>
      </Panel>

      <Panel title="Products sold" icon={Package}>
        {s.topProducts.length === 0 ? (
          <Empty>No products sold in this range.</Empty>
        ) : (
          <ul className="space-y-3">
            {s.topProducts.slice(0, 8).map((p) => (
              <BarRow key={p.name} label={p.name} value={<Money value={p.amount} />} share={p.amount / maxProduct} sub={`${p.count} units`} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
