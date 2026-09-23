import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { OrdersReportClient } from "./orders-report-client";

// Shared by the cashier and the owner: anyone who can see billing. Stylists
// cannot, and keep their own history screen at /server/history.
export default async function OrdersReportPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const [canView, canCheckout] = await Promise.all([
    hasPermission(session.user.id, "billing.view"),
    hasPermission(session.user.id, "orders.checkout"),
  ]);
  if (!canView) {
    redirect("/");
  }

  return <OrdersReportClient canCheckout={canCheckout} />;
}
