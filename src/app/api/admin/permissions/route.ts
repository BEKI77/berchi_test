import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, getAllPermissions, getAllRoles } from "@/lib/permissions";
import { db } from "@/db";
import { permissions, roles, rolePermissions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission to view permissions
    const canViewPermissions = await hasPermission(session.user.id, "settings.permissions");
    if (!canViewPermissions) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [allPermissions, allRoles] = await Promise.all([
      getAllPermissions(),
      getAllRoles(),
    ]);

    return NextResponse.json({
      permissions: allPermissions,
      roles: allRoles,
    });
  } catch (error) {
    console.error("Error fetching permissions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission to manage permissions
    const canManagePermissions = await hasPermission(session.user.id, "settings.permissions");
    if (!canManagePermissions) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, resource, action } = body;

    if (!name || !resource || !action) {
      return NextResponse.json(
        { error: "Missing required fields: name, resource, action" },
        { status: 400 }
      );
    }

    // Create new permission
    const [newPermission] = await db
      .insert(permissions)
      .values({
        name,
        description,
        resource,
        action,
      })
      .returning();

    return NextResponse.json(newPermission, { status: 201 });
  } catch (error) {
    console.error("Error creating permission:", error);
    if (error instanceof Error && error.message.includes("duplicate key")) {
      return NextResponse.json(
        { error: "Permission with this name already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
