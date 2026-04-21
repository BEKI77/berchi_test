import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { ServerQueueClient } from "./queue-client";

export default async function ServerQueuePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const canAccess = await hasPermission(session.user.id, "orders.view");
  if (!canAccess) {
    redirect("/");
  }

  return <ServerQueueClient userId={session.user.id} />;
}
