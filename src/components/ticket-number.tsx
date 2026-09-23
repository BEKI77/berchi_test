import { shortOrderNumber } from "@/lib/orders";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "min-w-12 h-12 px-2 text-2xl",
  lg: "min-w-16 h-16 px-3 text-4xl",
} as const;

/**
 * The number printed large on the slip -- what the customer is told and what a
 * stylist reads off the chair -- so it is the first thing to spot on screen.
 */
export function TicketNumber({
  orderNumber,
  size = "sm",
  className,
}: {
  orderNumber: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const short = shortOrderNumber(orderNumber);
  return (
    <div
      className={cn(
        "shrink-0 flex flex-col items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-md shadow-pink-200/50 leading-none",
        SIZES[size],
        className
      )}
      aria-label={`Ticket ${short}`}
      title={orderNumber}
    >
      <span className="text-[9px] font-semibold uppercase tracking-widest opacity-80 mb-0.5">
        Ticket
      </span>
      <span className="font-black tabular-nums">{short}</span>
    </div>
  );
}
