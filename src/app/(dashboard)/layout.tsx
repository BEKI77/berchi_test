import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import type { SessionUser } from "@/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user as SessionUser;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={user.role} />
      <div className="flex flex-1 flex-col md:pl-64">
        <Header user={user} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gradient-to-br from-pink-50/30 via-white to-rose-50/20">
          {children}
        </main>
      </div>
    </div>
  );
}
