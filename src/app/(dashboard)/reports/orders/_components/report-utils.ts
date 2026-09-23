import { ticketName } from "@/lib/orders";
import { paymentMethodLabel } from "@/lib/payment-methods";
import { lineTotal, orderValue, paidAmount, type ReportOrder } from "@/lib/order-report";
import { addDays, todayKey } from "@/lib/report-range";

export type OrderStatus = ReportOrder["status"];

export const STATUS_META: Record<OrderStatus, { label: string; badge: string; dot: string; bar: string }> = {
  IN_PROGRESS: {
    label: "In chair",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-400",
    bar: "from-amber-400 to-orange-400",
  },
  SENT_TO_CASHIER: {
    label: "At cashier",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-400",
    bar: "from-blue-400 to-indigo-400",
  },
  CHECKED_OUT: {
    label: "Paid",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-400",
    bar: "from-emerald-400 to-teal-400",
  },
  CANCELLED: {
    label: "Cancelled",
    badge: "bg-gray-100 text-gray-600 border-gray-200",
    dot: "bg-gray-400",
    bar: "from-gray-300 to-gray-400",
  },
};

export const STATUS_ORDER: OrderStatus[] = ["IN_PROGRESS", "SENT_TO_CASHIER", "CHECKED_OUT", "CANCELLED"];

/** Formatting in the salon's timezone, not the browser's. */
export function makeFormatters(timeZone: string) {
  const time = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" });
  const date = new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short" });
  const dateLong = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone });
  return {
    time: (iso: string) => time.format(new Date(iso)),
    date: (iso: string) => date.format(new Date(iso)),
    dateLong: (iso: string) => dateLong.format(new Date(iso)),
    dateTime: (iso: string) => `${date.format(new Date(iso))}, ${time.format(new Date(iso))}`,
    dayKey: (iso: string) => dayKey.format(new Date(iso)),
    /** "23 Sep" from a YYYY-MM-DD key, without a timezone shift. */
    keyLabel: (key: string) =>
      new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${key}T00:00:00Z`)),
  };
}

export type Formatters = ReturnType<typeof makeFormatters>;

/** "1h 25m" between two instants, or up to now when the ticket is still open. */
export function formatDuration(fromIso: string, toIso: string | null, now = Date.now()): string {
  const ms = Math.max(0, (toIso ? new Date(toIso).getTime() : now) - new Date(fromIso).getTime());
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export function personName(p: { firstName: string; lastName: string } | null | undefined): string {
  return p ? `${p.firstName} ${p.lastName}`.trim() : "—";
}

/** Everyone who did work on the ticket, falling back to whoever opened it. */
export function stylistNames(order: ReportOrder): string[] {
  const names = new Set(order.items.map((i) => i.staff?.firstName).filter(Boolean) as string[]);
  if (names.size === 0 && order.server) names.add(order.server.firstName);
  return [...names];
}

export function paymentMethodOf(order: ReportOrder): string | null {
  return order.invoice?.payment?.method ?? null;
}

export { lineTotal, orderValue, paidAmount, ticketName, paymentMethodLabel };

// ── Date presets ────────────────────────────────────────────

export type PresetKey = "today" | "yesterday" | "week" | "month" | "lastMonth" | "last30" | "custom";

export const PRESETS: { key: Exclude<PresetKey, "custom">; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
  { key: "month", label: "This month" },
  { key: "lastMonth", label: "Last month" },
];

export function presetRange(key: Exclude<PresetKey, "custom">, timeZone: string): { from: string; to: string } {
  const today = todayKey(timeZone);
  const monthStart = `${today.slice(0, 8)}01`;
  switch (key) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const y = addDays(today, -1);
      return { from: y, to: y };
    }
    case "week":
      return { from: addDays(today, -6), to: today };
    case "last30":
      return { from: addDays(today, -29), to: today };
    case "month":
      return { from: monthStart, to: today };
    case "lastMonth": {
      const lastDay = addDays(monthStart, -1);
      return { from: `${lastDay.slice(0, 8)}01`, to: lastDay };
    }
  }
}

// ── Filtering ───────────────────────────────────────────────

export type Filters = {
  search: string;
  statuses: OrderStatus[]; // empty = all
  method: string; // "all" | payment method | "UNPAID"
  staffId: string; // "all" | staff id
};

export const EMPTY_FILTERS: Filters = { search: "", statuses: [], method: "all", staffId: "all" };

export function applyFilters(orders: ReportOrder[], f: Filters): ReportOrder[] {
  const q = f.search.trim().toLowerCase();
  return orders.filter((o) => {
    if (f.statuses.length > 0 && !f.statuses.includes(o.status)) return false;
    if (f.method !== "all") {
      const m = paymentMethodOf(o);
      if (f.method === "UNPAID" ? m !== null : m !== f.method) return false;
    }
    if (f.staffId !== "all") {
      const worked = o.items.some((i) => i.staff?.id === f.staffId) || o.server?.id === f.staffId;
      if (!worked) return false;
    }
    if (q) {
      const haystack = [
        o.orderNumber,
        o.orderNumber.split("-").pop() ?? "",
        String(Number(o.orderNumber.split("-").pop())),
        o.invoice?.invoiceNumber ?? "",
        ticketName(o),
        o.customer?.phone ?? "",
        o.invoice?.payment?.reference ?? "",
        ...o.items.map((i) => i.name),
        ...o.products.map((p) => p.name),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

// ── Sorting ─────────────────────────────────────────────────

export type SortKey = "ticket" | "customer" | "opened" | "status" | "total";
export type Sort = { key: SortKey; dir: "asc" | "desc" };

export function sortOrders(orders: ReportOrder[], sort: Sort): ReportOrder[] {
  const dir = sort.dir === "asc" ? 1 : -1;
  const value = (o: ReportOrder): string | number => {
    switch (sort.key) {
      case "ticket":
        return o.orderNumber;
      case "customer":
        return ticketName(o).toLowerCase();
      case "opened":
        return o.startedAt;
      case "status":
        return STATUS_ORDER.indexOf(o.status);
      case "total":
        return orderValue(o);
    }
  };
  return [...orders].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    return va < vb ? -dir : va > vb ? dir : 0;
  });
}

// ── Summary ─────────────────────────────────────────────────

export type Summary = {
  tickets: number;
  byStatus: Record<OrderStatus, { count: number; value: number }>;
  revenue: number;
  paidCount: number;
  avgTicket: number;
  tips: number;
  discounts: number;
  tax: number;
  services: number;
  products: number;
  cancelledValue: number;
  openValue: number;
  avgServiceMinutes: number | null;
  methods: { method: string; count: number; amount: number }[];
  topServices: { name: string; count: number; amount: number }[];
  topProducts: { name: string; count: number; amount: number }[];
  staff: { id: string; name: string; tickets: number; services: number; amount: number }[];
  daily: { key: string; revenue: number; tickets: number }[];
  hourly: { hour: number; tickets: number }[];
};

function bump<T extends { count: number; amount: number }>(map: Map<string, T>, key: string, init: () => T, count: number, amount: number) {
  const row = map.get(key) ?? init();
  row.count += count;
  row.amount += amount;
  map.set(key, row);
}

export function summarize(orders: ReportOrder[], fmt: Formatters, from: string, to: string, timeZone: string): Summary {
  const byStatus = Object.fromEntries(STATUS_ORDER.map((s) => [s, { count: 0, value: 0 }])) as Summary["byStatus"];
  const methods = new Map<string, { method: string; count: number; amount: number }>();
  const services = new Map<string, { name: string; count: number; amount: number }>();
  const products = new Map<string, { name: string; count: number; amount: number }>();
  const staff = new Map<string, { id: string; name: string; tickets: Set<string>; services: number; amount: number }>();
  const daily = new Map<string, { key: string; revenue: number; tickets: number }>();
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, tickets: 0 }));
  const hourFmt = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" });

  for (let k = from; k <= to; k = addDays(k, 1)) daily.set(k, { key: k, revenue: 0, tickets: 0 });

  let revenue = 0, paidCount = 0, tips = 0, discounts = 0, tax = 0, serviceSum = 0, productSum = 0;
  let durationSum = 0, durationCount = 0;

  for (const o of orders) {
    const value = orderValue(o);
    byStatus[o.status].count += 1;
    byStatus[o.status].value += value;

    const day = daily.get(fmt.dayKey(o.startedAt));
    if (day) day.tickets += 1;
    hourly[Number(hourFmt.format(new Date(o.startedAt))) % 24].tickets += 1;

    if (o.status === "CANCELLED") continue;

    const paid = paidAmount(o);
    if (paid > 0 && o.invoice) {
      revenue += paid;
      paidCount += 1;
      tips += o.invoice.tipAmount;
      discounts += o.invoice.discountAmount;
      tax += o.invoice.taxAmount;
      if (day) day.revenue += paid;
      const m = o.invoice.payment?.method ?? "UNKNOWN";
      bump(methods, m, () => ({ method: m, count: 0, amount: 0 }), 1, paid);
      if (o.completedAt) {
        durationSum += new Date(o.completedAt).getTime() - new Date(o.startedAt).getTime();
        durationCount += 1;
      }
    }

    for (const i of o.items) {
      const amount = i.unitPrice * i.quantity;
      serviceSum += amount;
      bump(services, i.serviceId, () => ({ name: i.name, count: 0, amount: 0 }), i.quantity, amount);
      if (i.staff) {
        const s = staff.get(i.staff.id) ?? { id: i.staff.id, name: personName(i.staff), tickets: new Set<string>(), services: 0, amount: 0 };
        s.tickets.add(o.id);
        s.services += i.quantity;
        s.amount += amount;
        staff.set(i.staff.id, s);
      }
    }
    for (const p of o.products) {
      const amount = p.unitPrice * p.quantity;
      productSum += amount;
      bump(products, p.productId, () => ({ name: p.name, count: 0, amount: 0 }), p.quantity, amount);
    }
  }

  const byAmount = <T extends { amount: number }>(a: T, b: T) => b.amount - a.amount;

  return {
    tickets: orders.length,
    byStatus,
    revenue,
    paidCount,
    avgTicket: paidCount > 0 ? Math.round(revenue / paidCount) : 0,
    tips,
    discounts,
    tax,
    services: serviceSum,
    products: productSum,
    cancelledValue: byStatus.CANCELLED.value,
    openValue: byStatus.IN_PROGRESS.value + byStatus.SENT_TO_CASHIER.value,
    avgServiceMinutes: durationCount > 0 ? Math.round(durationSum / durationCount / 60_000) : null,
    methods: [...methods.values()].sort(byAmount),
    topServices: [...services.values()].sort(byAmount),
    topProducts: [...products.values()].sort(byAmount),
    staff: [...staff.values()]
      .map((s) => ({ id: s.id, name: s.name, tickets: s.tickets.size, services: s.services, amount: s.amount }))
      .sort(byAmount),
    daily: [...daily.values()],
    hourly,
  };
}

// ── CSV export ──────────────────────────────────────────────

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const money = (santim: number) => (santim / 100).toFixed(2);

export function toCsv(orders: ReportOrder[], fmt: Formatters): string {
  const header = [
    "Ticket", "Invoice", "Status", "Customer", "Phone", "Stylists", "Opened", "Closed", "Duration",
    "Services", "Products", "Subtotal", "Tax", "Discount", "Tip", "Total", "Payment method", "Payment reference", "Notes",
  ];
  const rows = orders.map((o) => {
    const inv = o.invoice;
    return [
      o.orderNumber,
      inv?.invoiceNumber ?? "",
      STATUS_META[o.status].label,
      ticketName(o),
      o.customer?.phone ?? "",
      stylistNames(o).join(" / "),
      fmt.dateTime(o.startedAt),
      o.completedAt ? fmt.dateTime(o.completedAt) : "",
      formatDuration(o.startedAt, o.completedAt),
      o.items.map((i) => `${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ""}`).join("; "),
      o.products.map((p) => `${p.name} x${p.quantity}`).join("; "),
      money(inv ? inv.subtotal : lineTotal(o)),
      money(inv?.taxAmount ?? 0),
      money(inv?.discountAmount ?? 0),
      money(inv?.tipAmount ?? 0),
      money(orderValue(o)),
      inv?.payment ? paymentMethodLabel(inv.payment.method) : "",
      inv?.payment?.reference ?? "",
      o.notes ?? "",
    ];
  });
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}
