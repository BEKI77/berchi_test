import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/db";
import { roles, rolePermissions } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ roleId: string }> }
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

    const { roleId } = await params;
    const body = await request.json();
    const { name, description, permissionIds } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Missing required field: name" },
        { status: 400 }
      );
    }

    // Update role
    const [updatedRole] = await db
      .update(roles)
      .set({
        name,
        description,
        updatedAt: new Date(),
      })
      .where(eq(roles.id, roleId))
      .returning();

    if (!updatedRole) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // Update role permissions if provided
    if (permissionIds && Array.isArray(permissionIds)) {
      // Remove existing permissions
      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));

      // Add new permissions
      if (permissionIds.length > 0) {
        await db.insert(rolePermissions).values(
          permissionIds.map((permissionId: string) => ({
            roleId,
            permissionId,
          }))
        );
      }
    }

    return NextResponse.json(updatedRole);
  } catch (error) {
    console.error("Error updating role:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ roleId: string }> }
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

    const { roleId } = await params;

    // Delete role permissions first (due to foreign key constraint)
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));

    // Delete role
    const [deletedRole] = await db
      .delete(roles)
      .where(eq(roles.id, roleId))
      .returning();

    if (!deletedRole) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Role deleted successfully" });
  } catch (error) {
    console.error("Error deleting role:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
