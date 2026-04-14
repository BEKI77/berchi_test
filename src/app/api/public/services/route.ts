import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCors, handlePreflight } from "@/lib/cors";

export async function OPTIONS(req: Request) {
  return handlePreflight(req);
}

// Public endpoint — no auth required
export async function GET(req: Request) {
  const origin = req.headers.get("origin");
  const services = await prisma.service.findMany({
    where: { isActive: true, category: { isActive: true } },
    include: { category: { select: { id: true, name: true } } },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  });

  return withCors(NextResponse.json(services), origin);
}
