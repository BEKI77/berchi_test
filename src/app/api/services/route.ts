import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { hasPermission } from "@/lib/permissions";
import { services } from "@/db/schema";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canView = await hasPermission(session.user.id, "services.view");
  if (!canView) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await db.query.services.findMany({
    where: eq(services.isActive, true),
    with: { category: { columns: { id: true, name: true } } },
    orderBy: [asc(services.name)],
  });

  // Sort by category name then service name
  result.sort((a, b) => {
    const catCmp = (a.category?.name ?? "").localeCompare(b.category?.name ?? "");
    return catCmp !== 0 ? catCmp : a.name.localeCompare(b.name);
  });

  return NextResponse.json(result);
}
