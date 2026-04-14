import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { InvoicesClient } from "./invoices-client";

export default async function InvoicesPage() {
  const session = await auth();
  if (session?.user?.role !== "OWNER") redirect("/");

  return <InvoicesClient />;
}
