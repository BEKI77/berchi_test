import { db } from "@/db";
import { permissions, roles, rolePermissions, userPermissions, staff } from "@/db/schema";
import { eq, and, or, exists } from "drizzle-orm";
import { cache } from "react";

export type Permission = typeof permissions.$inferSelect;
export type Role = typeof roles.$inferSelect;
export type UserPermission = typeof userPermissions.$inferSelect;

// Cache permission checks for better performance
const permissionCache = new Map<string, boolean>();

/**
 * Check if a user has a specific permission
 */
export async function hasPermission(
  userId: string,
  permissionName: string,
): Promise<boolean> {
  const cacheKey = `${userId}:${permissionName}`;
  
  // Check cache first
  if (permissionCache.has(cacheKey)) {
    return permissionCache.get(cacheKey)!;
  }

  try {
    // Get the permission ID
    const permission = await db
      .select({ id: permissions.id })
      .from(permissions)
      .where(eq(permissions.name, permissionName))
      .limit(1);

    if (!permission.length) {
      permissionCache.set(cacheKey, false);
      return false;
    }

    const permissionId = permission[0].id;

    // Check user-specific permissions first (explicit deny/grant)
    const userPermission = await db
      .select({ isGranted: userPermissions.isGranted })
      .from(userPermissions)
      .where(
        and(
          eq(userPermissions.userId, userId),
          eq(userPermissions.permissionId, permissionId),
        ),
      )
      .limit(1);

    if (userPermission.length > 0) {
      const hasPermission = userPermission[0].isGranted;
      permissionCache.set(cacheKey, hasPermission);
      return hasPermission;
    }

    // Check role-based permissions
    const staffMember = await db
      .select({ role: staff.role })
      .from(staff)
      .where(eq(staff.id, userId))
      .limit(1);

    if (!staffMember.length) {
      permissionCache.set(cacheKey, false);
      return false;
    }

    const userRole = staffMember[0].role;

    // Get role ID
    const role = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, userRole))
      .limit(1);

    if (!role.length) {
      permissionCache.set(cacheKey, false);
      return false;
    }

    // Check if role has the permission
    const rolePermission = await db
      .select({ id: rolePermissions.id })
      .from(rolePermissions)
      .where(
        and(
          eq(rolePermissions.roleId, role[0].id),
          eq(rolePermissions.permissionId, permissionId),
        ),
      )
      .limit(1);

    const hasPermission = rolePermission.length > 0;
    permissionCache.set(cacheKey, hasPermission);
    return hasPermission;

  } catch (error) {
    console.error("Error checking permission:", error);
    permissionCache.set(cacheKey, false);
    return false;
  }
}

/**
 * Check if a user has any of the specified permissions
 */
export async function hasAnyPermission(
  userId: string,
  permissionNames: string[],
): Promise<boolean> {
  const results = await Promise.all(
    permissionNames.map(name => hasPermission(userId, name)),
  );
  return results.some(hasPermission => hasPermission);
}

/**
 * Check if a user has all of the specified permissions
 */
export async function hasAllPermissions(
  userId: string,
  permissionNames: string[],
): Promise<boolean> {
  const results = await Promise.all(
    permissionNames.map(name => hasPermission(userId, name)),
  );
  return results.every(hasPermission => hasPermission);
}

/**
 * Get all permissions for a user
 */
export async function getUserPermissions(userId: string): Promise<Permission[]> {
  try {
    // Get user role
    const staffMember = await db
      .select({ role: staff.role })
      .from(staff)
      .where(eq(staff.id, userId))
      .limit(1);

    if (!staffMember.length) {
      return [];
    }

    const userRole = staffMember[0].role;

    // Get role permissions
    const rolePermissionsQuery = db
      .select({ permissionId: rolePermissions.permissionId })
      .from(rolePermissions)
      .innerJoin(roles, eq(rolePermissions.roleId, roles.id))
      .where(eq(roles.name, userRole));

    const rolePermissionIds = (await rolePermissionsQuery).map(rp => rp.permissionId);

    // Get user-specific permissions
    const userSpecificPermissions = await db
      .select({ 
        permissionId: userPermissions.permissionId,
        isGranted: userPermissions.isGranted,
      })
      .from(userPermissions)
      .where(eq(userPermissions.userId, userId));

    // Combine permissions (user-specific overrides role-based)
    const finalPermissionIds = new Set(rolePermissionIds);

    userSpecificPermissions.forEach(up => {
      if (up.isGranted) {
        finalPermissionIds.add(up.permissionId);
      } else {
        finalPermissionIds.delete(up.permissionId);
      }
    });

    // Get permission details
    if (finalPermissionIds.size === 0) {
      return [];
    }

    const userPermissionsList = await db
      .select()
      .from(permissions)
      .where(
        // @ts-ignore - Drizzle ORM limitation with dynamic in queries
        or(...Array.from(finalPermissionIds).map(id => eq(permissions.id, id)))
      );

    return userPermissionsList;

  } catch (error) {
    console.error("Error getting user permissions:", error);
    return [];
  }
}

/**
 * Get all available permissions
 */
export const getAllPermissions = cache(async (): Promise<Permission[]> => {
  try {
    return await db.select().from(permissions).where(eq(permissions.isActive, true));
  } catch (error) {
    console.error("Error getting all permissions:", error);
    return [];
  }
});

/**
 * Get all available roles
 */
export const getAllRoles = cache(async (): Promise<Role[]> => {
  try {
    return await db.select().from(roles).where(eq(roles.isActive, true));
  } catch (error) {
    console.error("Error getting all roles:", error);
    return [];
  }
});

/**
 * Grant a permission to a user
 */
export async function grantUserPermission(
  userId: string,
  permissionId: string,
): Promise<void> {
  try {
    // Check if an override already exists for this user + permission
    const existing = await db
      .select({ id: userPermissions.id })
      .from(userPermissions)
      .where(
        and(
          eq(userPermissions.userId, userId),
          eq(userPermissions.permissionId, permissionId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(userPermissions)
        .set({ isGranted: true, updatedAt: new Date() })
        .where(eq(userPermissions.id, existing[0].id));
    } else {
      await db.insert(userPermissions).values({
        userId,
        permissionId,
        isGranted: true,
      });
    }

    // Clear cache for this user
    clearUserPermissionCache(userId);
  } catch (error) {
    console.error("Error granting user permission:", error);
    throw error;
  }
}

/**
 * Deny a permission to a user
 */
export async function denyUserPermission(
  userId: string,
  permissionId: string,
): Promise<void> {
  try {
    // Check if an override already exists for this user + permission
    const existing = await db
      .select({ id: userPermissions.id })
      .from(userPermissions)
      .where(
        and(
          eq(userPermissions.userId, userId),
          eq(userPermissions.permissionId, permissionId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(userPermissions)
        .set({ isGranted: false, updatedAt: new Date() })
        .where(eq(userPermissions.id, existing[0].id));
    } else {
      await db.insert(userPermissions).values({
        userId,
        permissionId,
        isGranted: false,
      });
    }

    // Clear cache for this user
    clearUserPermissionCache(userId);
  } catch (error) {
    console.error("Error denying user permission:", error);
    throw error;
  }
}

/**
 * Remove a user-specific permission (revert to role-based)
 */
export async function removeUserPermission(
  userId: string,
  permissionId: string,
): Promise<void> {
  try {
    await db
      .delete(userPermissions)
      .where(
        and(
          eq(userPermissions.userId, userId),
          eq(userPermissions.permissionId, permissionId),
        ),
      );

    // Clear cache for this user
    clearUserPermissionCache(userId);
  } catch (error) {
    console.error("Error removing user permission:", error);
    throw error;
  }
}

/**
 * Clear permission cache for a user
 */
function clearUserPermissionCache(userId: string): void {
  const keysToDelete = Array.from(permissionCache.keys()).filter(key => 
    key.startsWith(`${userId}:`)
  );
  keysToDelete.forEach(key => permissionCache.delete(key));
}

/**
 * Permission check decorator for API routes
 */
export function requirePermission(permissionName: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Get user from request (assuming it's passed as first argument)
      const request = args[0];
      const userId = request.auth?.user?.id;

      if (!userId) {
        return new Response("Unauthorized", { status: 401 });
      }

      const hasRequiredPermission = await hasPermission(userId, permissionName);

      if (!hasRequiredPermission) {
        return new Response("Forbidden", { status: 403 });
      }

      return method.apply(this, args);
    };
  };
}

/**
 * Common permission groups for easy checking
 */
export const PERMISSION_GROUPS = {
  DASHBOARD: ["dashboard.view"],
  APPOINTMENTS: ["appointments.view", "appointments.create", "appointments.update", "appointments.delete"],
  APPOINTMENTS_READ_ONLY: ["appointments.view"],
  CUSTOMERS: ["customers.view", "customers.create", "customers.update", "customers.delete"],
  CUSTOMERS_READ_ONLY: ["customers.view"],
  SERVICES: ["services.view", "services.create", "services.update", "services.delete"],
  SERVICES_READ_ONLY: ["services.view"],
  INVENTORY: ["inventory.view", "inventory.create", "inventory.update", "inventory.delete"],
  INVENTORY_READ_ONLY: ["inventory.view"],
  ORDERS: ["orders.view", "orders.create", "orders.update"],
  ORDERS_CHECKOUT: ["orders.checkout"],
  BILLING: ["billing.view", "billing.create", "billing.update", "billing.delete"],
  BILLING_READ_ONLY: ["billing.view"],
  STAFF_MANAGEMENT: ["staff.view", "staff.create", "staff.update", "staff.delete"],
  STAFF_VIEW_ONLY: ["staff.view"],
  REPORTS: ["reports.view", "reports.export"],
  REPORTS_READ_ONLY: ["reports.view"],
  SETTINGS: ["settings.view", "settings.update"],
  PERMISSIONS: ["settings.permissions"],
};
