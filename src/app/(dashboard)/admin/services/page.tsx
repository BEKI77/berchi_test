import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ServicesClient } from "./services-client";

export default async function ServicesPage() {
  const session = await auth();
  if (session?.user?.role !== "OWNER") redirect("/");

  return <ServicesClient />;
}
