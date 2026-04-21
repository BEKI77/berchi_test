import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, getUserPermissions, grantUserPermission, denyUserPermission, removeUserPermission } from "@/lib/permissions";
import { db } from "@/db";
import { userPermissions, permissions } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
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

    const { userId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    // Get user's permissions
    const userPerms = await getUserPermissions(userId);

    // Get user-specific permission assignments (explicit grants/denies)
    const userSpecificPermissions = await db
      .select({
        permission: permissions,
        isGranted: userPermissions.isGranted,
      })
      .from(userPermissions)
      .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
      .where(eq(userPermissions.userId, userId));

    return NextResponse.json({
      permissions: userPerms,
      userSpecificAssignments: userSpecificPermissions,
    });
  } catch (error) {
    console.error("Error fetching user permissions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
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

    const { userId } = await params;
    const body = await request.json();
    const { permissionId, action } = body;

    if (!userId || !permissionId || !action) {
      return NextResponse.json(
        { error: "Missing required fields: permissionId, action" },
        { status: 400 }
      );
    }

    if (!["grant", "deny", "remove"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'grant', 'deny', or 'remove'" },
        { status: 400 }
      );
    }

    switch (action) {
      case "grant":
        await grantUserPermission(userId, permissionId);
        break;
      case "deny":
        await denyUserPermission(userId, permissionId);
        break;
      case "remove":
        await removeUserPermission(userId, permissionId);
        break;
    }

    return NextResponse.json({ message: "Permission updated successfully" });
  } catch (error) {
    console.error("Error updating user permission:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
