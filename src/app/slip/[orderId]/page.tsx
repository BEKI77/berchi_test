import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/db";
import { salonSettings, serviceOrders } from "@/db/schema";
import { DEFAULT_TIMEZONE } from "@/lib/order-numbers";
import { shortOrderNumber, ticketName } from "@/lib/orders";
import { AutoPrint } from "./auto-print";
import { PrintButton } from "./print-button";

// Never cache: it shows a specific ticket.
export const dynamic = "force-dynamic";

// Width the slip is laid out at. Change to 58 for a 58mm printer.
//
// Deliberately no @page size: browsers reject a fixed-width, unlimited-length
// size, so the paper size comes from the printer. Set the receipt printer as
// the default in Windows with its roll size (80mm) and the slip fills it.
const PAPER_WIDTH_MM = 80;

// The number slip handed to the customer at reception. It stands alone, outside
// the dashboard layout, so printing it does not drag in the sidebar and header.
// Reception loads it in a hidden frame with ?print=1 so it prints by itself.
export default async function SlipPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!(await hasPermission(session.user.id, "orders.view"))) notFound();

  const { orderId } = await params;
  const { print } = await searchParams;

  const order = await db.query.serviceOrders.findFirst({
    where: eq(serviceOrders.id, orderId),
    columns: { orderNumber: true, walkInName: true, startedAt: true },
    with: { customer: { columns: { firstName: true, lastName: true } } },
  });
  if (!order) notFound();

  const [settings] = await db.select().from(salonSettings).limit(1);
  const timeZone = settings?.timezone || DEFAULT_TIMEZONE;
  const arrived = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(order.startedAt);

  const name = ticketName({ customer: order.customer, walkInName: order.walkInName });
  const named = name !== "Walk-in";

  return (
    <>
      <style>{`
        @page { margin: 0; }
        html, body { margin: 0; background: #f3f4f6; }
        .slip { width: ${PAPER_WIDTH_MM}mm; box-sizing: border-box; padding: 5mm 4mm; background: #fff;
                color: #000; text-align: center; font-family: Arial, Helvetica, sans-serif; }
        .slip .rule { border-top: 1px dashed #000; margin: 3mm 0; }
        .slip .salon { font-size: 5mm; font-weight: 700; letter-spacing: 0.3mm; text-transform: uppercase; }
        .slip .label { font-size: 3.2mm; letter-spacing: 0.5mm; text-transform: uppercase; }
        .slip .number { font-size: 26mm; font-weight: 900; line-height: 1; margin: 2mm 0; }
        .slip .full { font-family: "Courier New", monospace; font-size: 3.2mm; }
        .slip .name { font-size: 6mm; font-weight: 700; margin-top: 3mm; word-break: break-word; }
        .slip .when { font-size: 3.4mm; margin-top: 1.5mm; }
        .slip .note { font-size: 3.4mm; line-height: 1.35; }
        @media screen {
          body { display: flex; flex-direction: column; align-items: center; padding: 24px 0; }
          .slip { box-shadow: 0 2px 12px rgba(0,0,0,.18); }
        }
        @media print { html, body { background: #fff; } .no-print { display: none !important; } }
      `}</style>

      <div className="slip">
        <div className="salon">{settings?.salonName ?? "Berchi Salon"}</div>
        <div className="rule" />
        <div className="label">Your number</div>
        <div className="number">{shortOrderNumber(order.orderNumber)}</div>
        <div className="full">{order.orderNumber}</div>
        {named && <div className="name">{name}</div>}
        <div className="when">{arrived}</div>
        <div className="rule" />
        <div className="note">
          Please give this number to your stylist.
          <br />
          Keep this slip until you pay.
        </div>
      </div>

      <div className="no-print">
        <PrintButton orderId={orderId} />
      </div>
      {print === "1" && <AutoPrint />}
    </>
  );
}
