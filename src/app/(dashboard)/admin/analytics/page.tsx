import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ServiceUsageClient } from "./usage-client";

export default async function ServiceUsagePage() {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    redirect("/dashboard");
  }

  return <ServiceUsageClient />;
}
