import { NextRequest, NextResponse } from "next/server";
import { hasPermission } from "./permissions";

/**
 * Middleware function to check permissions for API routes
 */
export async function requirePermission(
  request: NextRequest,
  permissionName: string,
): Promise<boolean> {
  const userId = request.headers.get("x-user-id");
  
  if (!userId) {
    return false;
  }

  return await hasPermission(userId, permissionName);
}

/**
 * Higher-order function to wrap API handlers with permission checks
 */
export function withPermission(permissionName: string) {
  return function (handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>) {
    return async function (request: NextRequest, ...args: any[]): Promise<NextResponse> {
      const hasRequiredPermission = await requirePermission(request, permissionName);
      
      if (!hasRequiredPermission) {
        return NextResponse.json(
          { error: "Forbidden - Insufficient permissions" },
          { status: 403 }
        );
      }

      return handler(request, ...args);
    };
  };
}

/**
 * Permission requirements for different routes and actions
 */
export const ROUTE_PERMISSIONS = {
  // Dashboard
  "GET /api/admin/dashboard": "dashboard.view",
  
  // Appointments
  "GET /api/admin/appointments": "appointments.view",
  "POST /api/admin/appointments": "appointments.create",
  "PUT /api/admin/appointments/[id]": "appointments.update",
  "DELETE /api/admin/appointments/[id]": "appointments.delete",
  
  // Customers
  "GET /api/admin/customers": "customers.view",
  "POST /api/admin/customers": "customers.create",
  "PUT /api/admin/customers/[id]": "customers.update",
  "DELETE /api/admin/customers/[id]": "customers.delete",
  
  // Services
  "GET /api/admin/services": "services.view",
  "POST /api/admin/services": "services.create",
  "PUT /api/admin/services/[id]": "services.update",
  "DELETE /api/admin/services/[id]": "services.delete",
  
  // Inventory/Products
  "GET /api/admin/products": "inventory.view",
  "POST /api/admin/products": "inventory.create",
  "PUT /api/admin/products/[id]": "inventory.update",
  "DELETE /api/admin/products/[id]": "inventory.delete",
  
  // Orders
  "GET /api/orders": "orders.view",
  "POST /api/orders": "orders.create",
  "PUT /api/orders/[id]": "orders.update",
  "POST /api/orders/[id]/checkout": "orders.checkout",
  
  // Staff
  "GET /api/admin/staff": "staff.view",
  "POST /api/admin/staff": "staff.create",
  "PUT /api/admin/staff/[id]": "staff.update",
  "DELETE /api/admin/staff/[id]": "staff.delete",
  
  // Reports
  "GET /api/admin/reports": "reports.view",
  "GET /api/admin/reports/export": "reports.export",
  
  // Settings
  "GET /api/settings": "settings.view",
  "PATCH /api/settings": "settings.update",
  "GET /api/admin/permissions": "settings.permissions",
  "POST /api/admin/permissions": "settings.permissions",
  "GET /api/admin/roles": "settings.permissions",
  "POST /api/admin/roles": "settings.permissions",
  
  // Billing
  "GET /api/admin/invoices": "billing.view",
  "POST /api/admin/invoices": "billing.create",
  "PUT /api/admin/invoices/[id]": "billing.update",
  "DELETE /api/admin/invoices/[id]": "billing.delete",
} as const;

/**
 * Check if a route requires specific permissions
 */
export function getRequiredPermission(method: string, pathname: string): string | null {
  const key = `${method} ${pathname}` as keyof typeof ROUTE_PERMISSIONS;
  return ROUTE_PERMISSIONS[key] || null;
}
