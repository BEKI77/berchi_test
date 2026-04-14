import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.salonSettings.findFirst();
  return NextResponse.json(settings);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const existing = await prisma.salonSettings.findFirst();

    if (!existing) {
      const settings = await prisma.salonSettings.create({ data: body });
      return NextResponse.json(settings);
    }

    const settings = await prisma.salonSettings.update({
      where: { id: existing.id },
      data: body,
    });
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
