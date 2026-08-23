import { pgTable, uuid, varchar, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";

export const productCategories = pgTable("product_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).unique().notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  sku: varchar("sku", { length: 50 }).unique(),
  categoryId: uuid("category_id").notNull().references(() => productCategories.id),
  costPrice: integer("cost_price").notNull(),
  sellPrice: integer("sell_price").notNull(),
  usagePrice: integer("usage_price").default(0).notNull(),
  quantityOnHand: integer("quantity_on_hand").default(0).notNull(),
  reorderLevel: integer("reorder_level").default(5).notNull(),
  portionsPerUnit: integer("portions_per_unit").default(1),
  remainingPortions: integer("remaining_portions").default(0),
  isConsumable: boolean("is_consumable").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});
