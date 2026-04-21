import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { InventoryClient } from "./inventory-client";

export default async function InventoryPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const canViewInventory = await hasPermission(session.user.id, "inventory.view");
  if (!canViewInventory) {
    redirect("/");
  }

  return <InventoryClient />;
}
