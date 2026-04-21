import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { hasPermission } from "@/lib/permissions";
import { salonSettings } from "@/db/schema";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canView = await hasPermission(session.user.id, "settings.view");
  if (!canView) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [settings] = await db.select().from(salonSettings).limit(1);
  return NextResponse.json(settings ?? null);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canUpdate = await hasPermission(session.user.id, "settings.update");
  if (!canUpdate) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const [existing] = await db.select().from(salonSettings).limit(1);

    if (!existing) {
      const [settings] = await db.insert(salonSettings).values(body).returning();
      return NextResponse.json(settings);
    }

    const [settings] = await db
      .update(salonSettings)
      .set(body)
      .where(eq(salonSettings.id, existing.id))
      .returning();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
