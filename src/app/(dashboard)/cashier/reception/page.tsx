import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { ReceptionClient } from "./reception-client";

export default async function ReceptionPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const canCreate = await hasPermission(session.user.id, "orders.create");
  if (!canCreate) {
    redirect("/cashier");
  }

  return <ReceptionClient />;
}
