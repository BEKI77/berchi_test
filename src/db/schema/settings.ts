import { pgTable, uuid, varchar, text, boolean, timestamp, decimal } from "drizzle-orm/pg-core";

export const salonSettings = pgTable("salon_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  salonName: varchar("salon_name", { length: 200 }).default("Berchi Salon").notNull(),
  address: varchar("address", { length: 500 }),
  phone: varchar("phone", { length: 20 }),
  logoUrl: varchar("logo_url", { length: 500 }),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("0").notNull(),
  currency: varchar("currency", { length: 10 }).default("ETB").notNull(),
  receiptsEnabled: boolean("receipts_enabled").default(true).notNull(),
  businessHours: text("business_hours"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});
