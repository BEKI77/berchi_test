import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

dotenv.config();

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client, { schema });

const { permissions, roles, rolePermissions, permissionTemplates } = schema;

// Define default permissions for the salon system
const defaultPermissions = [
  // Dashboard permissions
  { name: "dashboard.view", description: "View dashboard", resource: "dashboard", action: "read" },
  
  // Appointments permissions
  { name: "appointments.view", description: "View appointments", resource: "appointments", action: "read" },
  { name: "appointments.create", description: "Create appointments", resource: "appointments", action: "create" },
  { name: "appointments.update", description: "Update appointments", resource: "appointments", action: "update" },
  { name: "appointments.delete", description: "Delete appointments", resource: "appointments", action: "delete" },
  { name: "appointments.manage_slots", description: "Manage appointment slots", resource: "appointments", action: "manage_slots" },
  
  // Customers permissions
  { name: "customers.view", description: "View customers", resource: "customers", action: "read" },
  { name: "customers.create", description: "Create customers", resource: "customers", action: "create" },
  { name: "customers.update", description: "Update customers", resource: "customers", action: "update" },
  { name: "customers.delete", description: "Delete customers", resource: "customers", action: "delete" },
  
  // Services permissions
  { name: "services.view", description: "View services", resource: "services", action: "read" },
  { name: "services.create", description: "Create services", resource: "services", action: "create" },
  { name: "services.update", description: "Update services", resource: "services", action: "update" },
  { name: "services.delete", description: "Delete services", resource: "services", action: "delete" },
  
  // Products/Inventory permissions
  { name: "inventory.view", description: "View inventory", resource: "inventory", action: "read" },
  { name: "inventory.create", description: "Add products to inventory", resource: "inventory", action: "create" },
  { name: "inventory.update", description: "Update inventory", resource: "inventory", action: "update" },
  { name: "inventory.delete", description: "Remove products from inventory", resource: "inventory", action: "delete" },
  
  // Orders permissions
  { name: "orders.view", description: "View orders", resource: "orders", action: "read" },
  { name: "orders.create", description: "Create orders", resource: "orders", action: "create" },
  { name: "orders.update", description: "Update orders", resource: "orders", action: "update" },
  { name: "orders.checkout", description: "Process checkout", resource: "orders", action: "checkout" },
  
  // Staff permissions
  { name: "staff.view", description: "View staff members", resource: "staff", action: "read" },
  { name: "staff.create", description: "Create staff accounts", resource: "staff", action: "create" },
  { name: "staff.update", description: "Update staff accounts", resource: "staff", action: "update" },
  { name: "staff.delete", description: "Delete staff accounts", resource: "staff", action: "delete" },
  
  // Reports permissions
  { name: "reports.view", description: "View reports", resource: "reports", action: "read" },
  { name: "reports.export", description: "Export reports", resource: "reports", action: "export" },
  
  // Settings permissions
  { name: "settings.view", description: "View settings", resource: "settings", action: "read" },
  { name: "settings.update", description: "Update settings", resource: "settings", action: "update" },
  { name: "settings.permissions", description: "Manage permissions", resource: "settings", action: "permissions" },
  
  // Billing/Invoices permissions
  { name: "billing.view", description: "View billing and invoices", resource: "billing", action: "read" },
  { name: "billing.create", description: "Create invoices", resource: "billing", action: "create" },
  { name: "billing.update", description: "Update invoices", resource: "billing", action: "update" },
  { name: "billing.delete", description: "Delete invoices", resource: "billing", action: "delete" },

  // Expenses permissions
  { name: "expenses.view", description: "View expenses", resource: "expenses", action: "read" },
  { name: "expenses.create", description: "Log new expenses", resource: "expenses", action: "create" },
  { name: "expenses.update", description: "Update expenses", resource: "expenses", action: "update" },
  { name: "expenses.delete", description: "Delete expenses", resource: "expenses", action: "delete" },

  // Expense schedules permissions
  { name: "expenses.schedule.view", description: "View expense schedules", resource: "expenses", action: "schedule_view" },
  { name: "expenses.schedule.manage", description: "Manage expense schedules", resource: "expenses", action: "schedule_manage" },
];

// Define default roles
const defaultRoles = [
  { name: "OWNER", description: "Full access to all system features" },
  { name: "SERVER", description: "Can manage appointments, orders, and customer interactions" },
  { name: "CASHIER", description: "Can process payments and manage checkout" },
];

async function seedPermissions() {
  console.log("Starting permissions seeding...");

  try {
    // Insert permissions
    console.log("Inserting permissions...");
    const insertedPermissions = await db
      .insert(permissions)
      .values(defaultPermissions)
      .onConflictDoNothing({ target: permissions.name })
      .returning();

    console.log(`Inserted ${insertedPermissions.length} permissions`);

    // Insert roles
    console.log("Inserting roles...");
    const insertedRoles = await db
      .insert(roles)
      .values(defaultRoles)
      .onConflictDoNothing({ target: roles.name })
      .returning();

    console.log(`Inserted ${insertedRoles.length} roles`);

    // Get all permissions for role assignment
    const allPermissions = await db.select().from(permissions);
    const permissionMap = new Map(allPermissions.map(p => [p.name, p.id]));

    // Read the roles back rather than relying on what this run inserted.
    // On a re-run nothing is inserted, and reading from insertedRoles meant the
    // whole assignment step below was silently skipped -- so adding a
    // permission to an existing role never took effect.
    const allRoles = await db.select().from(roles);
    const ownerRole = allRoles.find(r => r.name === "OWNER");
    const serverRole = allRoles.find(r => r.name === "SERVER");
    const cashierRole = allRoles.find(r => r.name === "CASHIER");

    // Assign permissions to roles
    const rolePermissionAssignments: Array<{ roleId: string; permissionId: string }> = [];

    if (ownerRole) {
      // OWNER gets all permissions
      allPermissions.forEach(permission => {
        rolePermissionAssignments.push({
          roleId: ownerRole.id,
          permissionId: permission.id,
        });
      });
    }

    // Define permission sets for different roles
    const serverPermissionNames = [
      "dashboard.view",
      "appointments.view", "appointments.create", "appointments.update",
      "customers.view", "customers.create", "customers.update",
      "services.view",
      "inventory.view",
      "orders.view", "orders.create", "orders.update",
      "staff.view",
    ];

    const cashierPermissionNames = [
      "dashboard.view",
      "appointments.view",
      "customers.view", "customers.update",
      "services.view",
      "inventory.view",
      // orders.update lets the cashier add a service the stylist forgot before
      // closing the ticket. The items endpoint takes an explicit staffId, so
      // the work is still credited to the stylist who performed it.
      // Reception is the cashier's desk: it issues the ticket number when the
      // customer walks in, adds anything the stylist forgot, and closes it.
      "orders.view", "orders.create", "orders.update", "orders.checkout",
      "billing.view", "billing.create", "billing.update",
    ];

    if (serverRole) {
      // SERVER gets specific permissions
      serverPermissionNames.forEach(permissionName => {
        const permissionId = permissionMap.get(permissionName);
        if (permissionId) {
          rolePermissionAssignments.push({
            roleId: serverRole.id,
            permissionId,
          });
        }
      });
    }

    if (cashierRole) {
      // CASHIER gets specific permissions
      cashierPermissionNames.forEach(permissionName => {
        const permissionId = permissionMap.get(permissionName);
        if (permissionId) {
          rolePermissionAssignments.push({
            roleId: cashierRole.id,
            permissionId,
          });
        }
      });
    }

    // Insert role permissions
    if (rolePermissionAssignments.length > 0) {
      console.log("Assigning permissions to roles...");
      await db.insert(rolePermissions).values(rolePermissionAssignments).onConflictDoNothing();
      console.log(`Assigned ${rolePermissionAssignments.length} permissions to roles`);
    }

    // Create permission templates
    console.log("Creating permission templates...");
    const templates = [
      {
        name: "Full Access",
        description: "Complete access to all system features",
        permissions: allPermissions.map(p => p.id),
      },
      {
        name: "Basic Server",
        description: "Essential permissions for salon servers",
        permissions: serverPermissionNames
          .map((name: string) => permissionMap.get(name))
          .filter(Boolean) as string[],
      },
      {
        name: "Cashier Only",
        description: "Permissions focused on checkout and billing",
        permissions: cashierPermissionNames
          .map((name: string) => permissionMap.get(name))
          .filter(Boolean) as string[],
      },
    ];

    await db.insert(permissionTemplates).values(templates).onConflictDoNothing({ target: permissionTemplates.name });
    console.log(`Created ${templates.length} permission templates`);

    console.log("Permissions seeding completed successfully!");

  } catch (error) {
    console.error("Error seeding permissions:", error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the seeding
if (require.main === module) {
  seedPermissions()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { seedPermissions };
