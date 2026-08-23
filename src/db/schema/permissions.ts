import { pgTable, uuid, varchar, boolean, timestamp, text, jsonb , unique } from "drizzle-orm/pg-core";

// Permissions table - defines individual permissions
export const permissions = pgTable("permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).unique().notNull(),
  description: text("description"),
  resource: varchar("resource", { length: 100 }).notNull(), // e.g., "appointments", "customers", "services"
  action: varchar("action", { length: 50 }).notNull(), // e.g., "read", "create", "update", "delete"
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

// Roles table - defines roles with descriptions
export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 50 }).unique().notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

// Role-Permissions junction table - links roles to permissions
export const rolePermissions = pgTable("role_permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  roleId: uuid("role_id").references(() => roles.id, { onDelete: "cascade" }).notNull(),
  permissionId: uuid("permission_id").references(() => permissions.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  // Without this the seed's onConflictDoNothing has nothing to conflict on, so
  // every re-run duplicated every assignment.
  unique("role_permissions_role_id_permission_id_unique").on(t.roleId, t.permissionId),
]);

// User-Permissions junction table - for direct user permission assignments
export const userPermissions = pgTable("user_permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  permissionId: uuid("permission_id").references(() => permissions.id, { onDelete: "cascade" }).notNull(),
  isGranted: boolean("is_granted").default(true).notNull(), // Can be used to deny specific permissions
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => [
  unique("user_permissions_user_id_permission_id_unique").on(t.userId, t.permissionId),
]);

// Permission templates - predefined permission sets for easy setup
export const permissionTemplates = pgTable("permission_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).unique().notNull(),
  description: text("description"),
  permissions: jsonb("permissions").notNull(), // Array of permission IDs
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});
