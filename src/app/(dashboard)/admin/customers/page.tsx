import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { CustomersClient } from "./customers-client";

export default async function CustomersPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const canViewCustomers = await hasPermission(session.user.id, "customers.view");
  if (!canViewCustomers) {
    redirect("/");
  }

  return <CustomersClient />;
}
