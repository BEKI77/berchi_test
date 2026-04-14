import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { services } from "@/db/schema";
import { withCors, handlePreflight } from "@/lib/cors";

export async function OPTIONS(req: Request) {
  return handlePreflight(req);
}

// Public endpoint — no auth required
export async function GET(_req: Request) {
  const result = await db.query.services.findMany({
    where: eq(services.isActive, true),
    with: { category: { columns: { id: true, name: true, isActive: true } } },
    orderBy: [asc(services.name)],
  });

  // Filter to only services with active categories, sort by category then name
  const filtered = result
    .filter((s) => s.category?.isActive !== false)
    .sort((a, b) => {
      const catCmp = (a.category?.name ?? "").localeCompare(b.category?.name ?? "");
      return catCmp !== 0 ? catCmp : a.name.localeCompare(b.name);
    });

  return withCors(NextResponse.json(filtered), "*");
}
