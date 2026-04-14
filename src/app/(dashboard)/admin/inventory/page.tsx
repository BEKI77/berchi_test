import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { InventoryClient } from "./inventory-client";

export default async function InventoryPage() {
  const session = await auth();
  if (session?.user?.role !== "OWNER") redirect("/");

  return <InventoryClient />;
}
