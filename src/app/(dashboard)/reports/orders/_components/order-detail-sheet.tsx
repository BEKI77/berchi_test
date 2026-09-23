"use client";

import Link from "next/link";
import { CheckCircle2, CircleDot, Clock, FileText, Heart, Package, Percent, Phone, Receipt, Scissors, Send, XCircle } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/money";
import { shortOrderNumber } from "@/lib/orders";
import { lineTotal, type ReportOrder } from "@/lib/order-report";
import { MethodBadge, Money, StatusBadge } from "./order-bits";
import { formatDuration, personName, ticketName, type Formatters } from "./report-utils";

function Row({ label, children, className }: { label: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 text-xs", className)}>
      <span className="flex items-center gap-1 text-muted-foreground">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
      <Icon className="h-3 w-3" /> {children}
    </p>
  );
}

/** The full story of one ticket: lines, money, payment and timeline. */
export function OrderDetailSheet({
  order,
  fmt,
  canCheckout,
  onClose,
}: {
  order: ReportOrder | null;
  fmt: Formatters;
  canCheckout: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet open={order !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        {order && <Detail order={order} fmt={fmt} canCheckout={canCheckout} />}
      </SheetContent>
    </Sheet>
  );
}

function Detail({ order, fmt, canCheckout }: { order: ReportOrder; fmt: Formatters; canCheckout: boolean }) {
  const inv = order.invoice;
  const open = order.status === "IN_PROGRESS" || order.status === "SENT_TO_CASHIER";
  const lines = lineTotal(order);

  const timeline: { icon: React.ComponentType<{ className?: string }>; label: string; at: string | null; tone: string }[] = [
    { icon: CircleDot, label: `Opened${order.server ? ` by ${order.server.firstName}` : ""}`, at: order.startedAt, tone: "text-amber-500" },
  ];
  if (order.status === "SENT_TO_CASHIER") timeline.push({ icon: Send, label: "Sent to cashier", at: null, tone: "text-blue-500" });
  if (inv) timeline.push({ icon: Receipt, label: `Invoice ${inv.invoiceNumber}`, at: inv.createdAt, tone: "text-violet-500" });
  if (inv?.payment) timeline.push({ icon: CheckCircle2, label: "Payment received", at: inv.payment.createdAt, tone: "text-emerald-500" });
  if (order.status === "CANCELLED") timeline.push({ icon: XCircle, label: "Cancelled", at: order.completedAt, tone: "text-gray-500" });

  return (
    <>
      <SheetHeader className="border-b border-pink-100 bg-gradient-to-br from-pink-50 via-white to-rose-50 p-5 pr-12">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-pink-400 to-rose-500 text-white shadow-md shadow-pink-200">
            <span className="text-[9px] font-semibold uppercase leading-none tracking-wider opacity-80">No.</span>
            <span className="text-2xl font-bold leading-tight">{shortOrderNumber(order.orderNumber)}</span>
          </div>
          <div className="min-w-0">
            <SheetTitle className="truncate text-lg">{ticketName(order)}</SheetTitle>
            <SheetDescription className="text-xs">{order.orderNumber}</SheetDescription>
            <div className="mt-1.5"><StatusBadge status={order.status} /></div>
          </div>
        </div>
        {order.customer?.phone && (
          <a href={`tel:${order.customer.phone}`} className="mt-3 inline-flex items-center gap-1.5 text-xs text-pink-600 hover:underline">
            <Phone className="h-3 w-3" /> {order.customer.phone}
          </a>
        )}
      </SheetHeader>

      <div className="space-y-5 p-5">
        {/* Key facts */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-gray-50 p-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Opened</p>
            <p className="text-sm font-semibold">{fmt.time(order.startedAt)}</p>
            <p className="text-[10px] text-muted-foreground">{fmt.date(order.startedAt)}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{open ? "Open for" : "Took"}</p>
            <p className="text-sm font-semibold">{formatDuration(order.startedAt, open ? null : order.completedAt)}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-2">
            <p className="text-[10px] uppercase tracking-wider text-emerald-600">{inv ? "Total" : "Running"}</p>
            <Money value={inv ? inv.totalAmount : lines} className="text-sm font-bold text-emerald-700" />
          </div>
        </div>

        {/* Services */}
        <section>
          <SectionTitle icon={Scissors}>Services ({order.items.length})</SectionTitle>
          {order.items.length === 0 ? (
            <p className="text-xs italic text-muted-foreground">No services on this ticket yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
              {order.items.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      {i.name} {i.quantity > 1 && <span className="text-muted-foreground">×{i.quantity}</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground">by {personName(i.staff)}</p>
                  </div>
                  <Money value={i.unitPrice * i.quantity} className="shrink-0 text-sm font-medium" />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Products */}
        {order.products.length > 0 && (
          <section>
            <SectionTitle icon={Package}>Products ({order.products.length})</SectionTitle>
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
              {order.products.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <p className="truncate text-sm">
                    {p.name} <span className="text-muted-foreground">×{p.quantity}</span>
                  </p>
                  <Money value={p.unitPrice * p.quantity} className="shrink-0 text-sm font-medium" />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Money */}
        <section>
          <SectionTitle icon={Receipt}>{inv ? "Invoice" : "Running total"}</SectionTitle>
          <div className="space-y-1.5 rounded-xl bg-gray-50/80 p-3">
            <Row label="Subtotal"><Money value={inv ? inv.subtotal : lines} /></Row>
            {inv && inv.taxAmount > 0 && (
              <Row label={<><Percent className="h-3 w-3" /> Tax ({formatPercent(inv.taxRate)})</>}>+<Money value={inv.taxAmount} /></Row>
            )}
            {inv && inv.discountAmount > 0 && (
              <Row label={`Discount${inv.discountType === "PERCENTAGE" ? ` (${formatPercent(inv.discountValue)})` : ""}`} className="[&>span]:text-red-500">
                −<Money value={inv.discountAmount} />
              </Row>
            )}
            {inv && inv.tipAmount > 0 && (
              <Row label={<><Heart className="h-3 w-3" /> Tip</>} className="[&>span]:text-pink-500">+<Money value={inv.tipAmount} /></Row>
            )}
            <div className="flex items-center justify-between border-t border-gray-200 pt-1.5 text-sm font-bold text-emerald-700">
              <span>{inv ? (inv.status === "PAID" ? "Total paid" : `Total (${inv.status.toLowerCase()})`) : "Before tax & discounts"}</span>
              <Money value={inv ? inv.totalAmount : lines} />
            </div>
          </div>
          {inv?.payment && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <MethodBadge method={inv.payment.method} />
              <span className="text-muted-foreground">
                <Money value={inv.payment.amount} /> at {fmt.time(inv.payment.createdAt)}
              </span>
              {inv.payment.reference && <span className="text-muted-foreground">Ref: {inv.payment.reference}</span>}
            </div>
          )}
        </section>

        {/* Timeline */}
        <section>
          <SectionTitle icon={Clock}>Timeline</SectionTitle>
          <ol className="relative space-y-3 border-l border-dashed border-pink-200 pl-4">
            {timeline.map((t, idx) => (
              <li key={idx} className="relative">
                <t.icon className={cn("absolute -left-[23px] top-0.5 h-3.5 w-3.5 rounded-full bg-white", t.tone)} />
                <p className="text-xs font-medium">{t.label}</p>
                {t.at && <p className="text-[11px] text-muted-foreground">{fmt.dateLong(t.at)} · {fmt.time(t.at)}</p>}
              </li>
            ))}
          </ol>
        </section>

        {/* Notes */}
        {order.notes && (
          <section>
            <SectionTitle icon={FileText}>Notes</SectionTitle>
            <p className="whitespace-pre-line rounded-xl bg-amber-50/60 p-3 text-xs text-gray-700">{order.notes}</p>
          </section>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-1">
          {inv && (
            <Link href={`/cashier/receipt/${inv.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-xl")}>
              <Receipt className="mr-1.5 h-4 w-4" /> View receipt
            </Link>
          )}
          {open && canCheckout && (
            <Link
              href={`/cashier/checkout/${order.id}`}
              className={cn(buttonVariants({ size: "sm" }), "rounded-xl bg-emerald-500 hover:bg-emerald-600")}
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" /> Go to checkout
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
