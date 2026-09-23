"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { shortOrderNumber } from "@/lib/orders";
import type { ReportOrder } from "@/lib/order-report";
import { MethodBadge, Money, StatusBadge } from "./order-bits";
import {
  formatDuration,
  orderValue,
  paymentMethodOf,
  stylistNames,
  ticketName,
  type Formatters,
  type Sort,
  type SortKey,
} from "./report-utils";

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  sort: Sort;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("px-3 py-2.5 font-semibold", align === "right" && "text-right")}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-1 -mx-1 uppercase tracking-wider hover:text-pink-600",
          active && "text-pink-600",
          align === "right" && "flex-row-reverse",
        )}
      >
        {label}
        <Icon className={cn("h-3 w-3", !active && "opacity-40")} />
      </button>
    </th>
  );
}

/** The ticket list as a sortable table, for laptops and the cashier PC. */
export function OrdersTable({
  orders,
  fmt,
  showDate,
  sort,
  onSort,
  onOpen,
}: {
  orders: ReportOrder[];
  fmt: Formatters;
  showDate: boolean;
  sort: Sort;
  onSort: (key: SortKey) => void;
  onOpen: (order: ReportOrder) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-pink-100/70 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gradient-to-r from-pink-50/80 to-rose-50/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <SortHeader label="Ticket" sortKey="ticket" sort={sort} onSort={onSort} />
              <SortHeader label="Customer" sortKey="customer" sort={sort} onSort={onSort} />
              <th scope="col" className="px-3 py-2.5 font-semibold">Services</th>
              <th scope="col" className="hidden px-3 py-2.5 font-semibold lg:table-cell">Stylists</th>
              <SortHeader label="Opened" sortKey="opened" sort={sort} onSort={onSort} />
              <th scope="col" className="hidden px-3 py-2.5 font-semibold xl:table-cell">Duration</th>
              <SortHeader label="Status" sortKey="status" sort={sort} onSort={onSort} />
              <th scope="col" className="hidden px-3 py-2.5 font-semibold lg:table-cell">Payment</th>
              <SortHeader label="Total" sortKey="total" sort={sort} onSort={onSort} align="right" />
              <th scope="col" className="w-8"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pink-50">
            {orders.map((o) => {
              const open = o.status === "IN_PROGRESS" || o.status === "SENT_TO_CASHIER";
              const tip = o.invoice?.tipAmount ?? 0;
              const discount = o.invoice?.discountAmount ?? 0;
              return (
                <tr
                  key={o.id}
                  tabIndex={0}
                  onClick={() => onOpen(o)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpen(o);
                    }
                  }}
                  className="group cursor-pointer transition-colors hover:bg-pink-50/40 focus-visible:bg-pink-50/60 focus-visible:outline-none"
                >
                  <td className="px-3 py-3 align-top">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-pink-50 px-1.5 text-sm font-bold text-pink-700">
                        {shortOrderNumber(o.orderNumber)}
                      </span>
                      <div className="leading-tight">
                        <p className="text-[11px] text-muted-foreground">{o.orderNumber}</p>
                        {o.invoice && <p className="text-[11px] text-muted-foreground/70">{o.invoice.invoiceNumber}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <p className="font-medium">{ticketName(o)}</p>
                    {o.customer?.phone && <p className="text-[11px] text-muted-foreground">{o.customer.phone}</p>}
                  </td>
                  <td className="max-w-[260px] px-3 py-3 align-top">
                    <p className="line-clamp-2 text-xs text-gray-700">
                      {o.items.length > 0 ? o.items.map((i) => i.name).join(", ") : <span className="italic text-muted-foreground">None yet</span>}
                    </p>
                    {o.products.length > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        + {o.products.reduce((s, p) => s + p.quantity, 0)} product item(s)
                      </p>
                    )}
                  </td>
                  <td className="hidden px-3 py-3 align-top text-xs text-gray-700 lg:table-cell">
                    {stylistNames(o).join(", ") || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 align-top text-xs">
                    {showDate && <p className="text-muted-foreground">{fmt.date(o.startedAt)}</p>}
                    <p className="font-medium">{fmt.time(o.startedAt)}</p>
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-3 align-top text-xs text-gray-600 xl:table-cell">
                    {formatDuration(o.startedAt, open ? null : o.completedAt)}
                    {open && <span className="block text-[10px] text-muted-foreground">so far</span>}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="hidden px-3 py-3 align-top lg:table-cell">
                    <MethodBadge method={paymentMethodOf(o)} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right align-top">
                    <Money
                      value={orderValue(o)}
                      className={cn("font-semibold", o.status === "CANCELLED" ? "text-gray-400 line-through" : "text-emerald-700")}
                    />
                    {tip > 0 && <p className="text-[10px] text-pink-500">tip <Money value={tip} /></p>}
                    {discount > 0 && <p className="text-[10px] text-red-500">disc. −<Money value={discount} /></p>}
                  </td>
                  <td className="pr-3 align-middle">
                    <ChevronRight className="h-4 w-4 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-pink-400" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
