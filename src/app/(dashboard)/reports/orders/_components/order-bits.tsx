"use client";

import { Banknote, Building2, CreditCard, Globe, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { STATUS_META, paymentMethodLabel, type OrderStatus } from "./report-utils";

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        meta.badge,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot, (status === "IN_PROGRESS" || status === "SENT_TO_CASHIER") && "animate-pulse")} />
      {meta.label}
    </span>
  );
}

const METHOD_STYLE: Record<string, { icon: React.ComponentType<{ className?: string }>; className: string }> = {
  CASH: { icon: Banknote, className: "bg-green-50 text-green-700 border-green-200" },
  MOBILE: { icon: Smartphone, className: "bg-orange-50 text-orange-700 border-orange-200" },
  BANK_TRANSFER: { icon: Building2, className: "bg-sky-50 text-sky-700 border-sky-200" },
  CARD: { icon: CreditCard, className: "bg-blue-50 text-blue-700 border-blue-200" },
  CHAPA: { icon: Globe, className: "bg-violet-50 text-violet-700 border-violet-200" },
};

export function MethodBadge({ method, className }: { method: string | null; className?: string }) {
  if (!method) return <span className="text-xs text-muted-foreground">—</span>;
  const style = METHOD_STYLE[method] ?? { icon: CreditCard, className: "bg-gray-50 text-gray-600 border-gray-200" };
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium",
        style.className,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {paymentMethodLabel(method)}
    </span>
  );
}

export function Money({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("tabular-nums", className)}>
      <span className="text-[0.8em] font-medium opacity-60">ETB </span>
      {formatMoney(value)}
    </span>
  );
}
