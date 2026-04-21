import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/db";
import { roles, rolePermissions, permissions } from "@/db/schema";
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

    // Get all roles with their permissions
    const allRoles = await db.select().from(roles).where(eq(roles.isActive, true));
    
    const rolesWithPermissions = await Promise.all(
      allRoles.map(async (role) => {
        const rolePerms = await db
          .select({
            permission: permissions,
          })
          .from(rolePermissions)
          .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
          .where(eq(rolePermissions.roleId, role.id));

        return {
          ...role,
          permissions: rolePerms.map(rp => rp.permission),
        };
      })
    );

    return NextResponse.json({ roles: rolesWithPermissions });
  } catch (error) {
    console.error("Error fetching roles:", error);
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
    const { name, description, permissionIds } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Missing required field: name" },
        { status: 400 }
      );
    }

    // Create new role
    const [newRole] = await db
      .insert(roles)
      .values({
        name,
        description,
      })
      .returning();

    // Assign permissions to role if provided
    if (permissionIds && Array.isArray(permissionIds) && permissionIds.length > 0) {
      await db.insert(rolePermissions).values(
        permissionIds.map((permissionId: string) => ({
          roleId: newRole.id,
          permissionId,
        }))
      );
    }

    return NextResponse.json(newRole, { status: 201 });
  } catch (error) {
    console.error("Error creating role:", error);
    if (error instanceof Error && error.message.includes("duplicate key")) {
      return NextResponse.json(
        { error: "Role with this name already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
