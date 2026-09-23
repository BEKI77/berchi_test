"use client";

import { ChevronRight, Clock, Hourglass, Scissors, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { shortOrderNumber, ticketInitials } from "@/lib/orders";
import type { ReportOrder } from "@/lib/order-report";
import { MethodBadge, Money, StatusBadge } from "./order-bits";
import {
  STATUS_META,
  formatDuration,
  orderValue,
  paymentMethodOf,
  stylistNames,
  ticketName,
  type Formatters,
} from "./report-utils";

/** One ticket as a tappable card, for phones and narrow tablets. */
export function OrderCard({
  order,
  fmt,
  showDate,
  onOpen,
}: {
  order: ReportOrder;
  fmt: Formatters;
  showDate: boolean;
  onOpen: (order: ReportOrder) => void;
}) {
  const meta = STATUS_META[order.status];
  const open = order.status === "IN_PROGRESS" || order.status === "SENT_TO_CASHIER";
  const serviceNames = order.items.map((i) => i.name);
  const stylists = stylistNames(order);
  const tip = order.invoice?.tipAmount ?? 0;

  return (
    <button
      type="button"
      onClick={() => onOpen(order)}
      className="group w-full overflow-hidden rounded-2xl border border-pink-100/70 bg-white text-left shadow-sm transition-all active:scale-[0.99] hover:border-pink-200 hover:shadow-md"
    >
      <div className={cn("h-1 bg-gradient-to-r", meta.bar)} />
      <div className="p-3.5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-pink-50 to-rose-100 text-pink-700">
            <span className="text-[9px] font-semibold uppercase leading-none tracking-wider text-pink-400">No.</span>
            <span className="text-lg font-bold leading-tight">{shortOrderNumber(order.orderNumber)}</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold">{ticketName(order)}</p>
              <StatusBadge status={order.status} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {showDate ? fmt.dateTime(order.startedAt) : fmt.time(order.startedAt)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Hourglass className="h-3 w-3" />
                {formatDuration(order.startedAt, open ? null : order.completedAt)}
              </span>
              {stylists.length > 0 && (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <User className="h-3 w-3 shrink-0" />
                  <span className="truncate">{stylists.join(", ")}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-start gap-1.5 text-xs text-gray-600">
          <Scissors className="mt-0.5 h-3 w-3 shrink-0 text-pink-300" />
          <p className="line-clamp-2">
            {serviceNames.length > 0 ? serviceNames.join(" · ") : <span className="italic text-muted-foreground">No services yet</span>}
            {order.products.length > 0 && (
              <span className="text-muted-foreground"> + {order.products.length} product{order.products.length > 1 ? "s" : ""}</span>
            )}
          </p>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-dashed border-pink-100 pt-2.5">
          <div className="flex min-w-0 items-center gap-2">
            {order.invoice ? (
              <MethodBadge method={paymentMethodOf(order)} />
            ) : (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-50 text-[10px] font-bold text-gray-400">
                {ticketInitials(order)}
              </span>
            )}
            {order.invoice && (
              <span className="truncate text-[10px] text-muted-foreground">{order.invoice.invoiceNumber}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <div className="text-right">
              <Money
                value={orderValue(order)}
                className={cn("text-sm font-bold", order.status === "CANCELLED" ? "text-gray-400 line-through" : "text-emerald-700")}
              />
              {tip > 0 && (
                <p className="text-[10px] font-medium text-pink-500">
                  incl. <Money value={tip} /> tip
                </p>
              )}
              {open && <p className="text-[10px] text-muted-foreground">running total</p>}
            </div>
            <ChevronRight className="h-4 w-4 text-gray-300 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>
    </button>
  );
}
