import { pgTable, uuid, varchar, text, timestamp, decimal, integer, date } from "drizzle-orm/pg-core";
import { expenseCategoryEnum, stockMovementTypeEnum } from "./enums";
import { staff } from "./staff";
import { products } from "./products";
import { serviceOrderItems, serviceOrders } from "./orders";

export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  description: varchar("description", { length: 500 }).notNull(),
  category: expenseCategoryEnum("category").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  date: date("date").notNull(),
  loggedBy: uuid("logged_by").notNull().references(() => staff.id),
  receiptUrl: varchar("receipt_url", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const stockMovements = pgTable("stock_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => products.id),
  type: stockMovementTypeEnum("type").notNull(),
  quantityChange: integer("quantity_change").notNull(),
  portionsChange: integer("portions_change"),
  referenceId: varchar("reference_id"),
  note: text("note"),
  performedBy: uuid("performed_by").notNull().references(() => staff.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const productUsageLogs = pgTable("product_usage_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => products.id),
  orderId: uuid("order_id").notNull().references(() => serviceOrders.id),
  staffId: uuid("staff_id").notNull().references(() => staff.id),
  portionsUsed: integer("portions_used").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const commissionLogs = pgTable("commission_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  staffId: uuid("staff_id").notNull().references(() => staff.id),
  invoiceId: uuid("invoice_id").notNull(),
  serviceOrderItemId: uuid("service_order_item_id").notNull().references(() => serviceOrderItems.id),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).notNull(),
  serviceAmount: decimal("service_amount", { precision: 10, scale: 2 }).notNull(),
  commissionAmount: decimal("commission_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
