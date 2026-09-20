import { pgTable, uuid, varchar, boolean, timestamp, integer} from "drizzle-orm/pg-core";
import { staffRoleEnum } from "./enums";

export const staff = pgTable("staff", {
  id: uuid("id").primaryKey().defaultRandom(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  // Hash of the stylist's short PIN for the shared tablet. Null means no PIN,
  // so PIN sign-in is off for that person. Only ever the hash, never the PIN.
  pinHash: varchar("pin_hash", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  role: staffRoleEnum("role").notNull(),
  commissionRate: integer("commission_rate").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

// Wrong-PIN counter and lockout, one row per stylist.
//
// Deliberately its own table rather than columns on `staff`. This is state of
// THIS machine, and staff rows will be overwritten by the sync from the cloud;
// keeping the counter here means a sync can never wipe a lockout, and the cloud
// never needs to hear about it.
export const staffPinAttempts = pgTable("staff_pin_attempts", {
  staffId: uuid("staff_id").primaryKey().references(() => staff.id, { onDelete: "cascade" }),
  failedCount: integer("failed_count").default(0).notNull(),
  lockedUntil: timestamp("locked_until"),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});
