import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { InvoicesClient } from "./invoices-client";

export default async function InvoicesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const canViewInvoices = await hasPermission(session.user.id, "billing.view");
  if (!canViewInvoices) {
    redirect("/");
  }

  return <InvoicesClient />;
}
