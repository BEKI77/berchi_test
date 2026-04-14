import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ServerHistoryClient } from "./history-client";

export default async function ServerHistoryPage() {
  const session = await auth();
  if (session?.user?.role !== "SERVER" && session?.user?.role !== "OWNER") {
    redirect("/");
  }

  return <ServerHistoryClient userId={session.user.id} />;
}
