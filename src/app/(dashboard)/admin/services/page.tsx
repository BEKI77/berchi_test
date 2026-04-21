import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { ServicesClient } from "./services-client";

export default async function ServicesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const canViewServices = await hasPermission(session.user.id, "services.view");
  if (!canViewServices) {
    redirect("/");
  }

  return <ServicesClient />;
}
