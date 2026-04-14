import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ServerQueueClient } from "./queue-client";

export default async function ServerQueuePage() {
  const session = await auth();
  if (session?.user?.role !== "SERVER" && session?.user?.role !== "OWNER") {
    redirect("/");
  }

  return <ServerQueueClient userId={session.user.id} />;
}
