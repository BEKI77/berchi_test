import { pgTable, uuid, varchar, timestamp, decimal } from "drizzle-orm/pg-core";
import { invoiceStatusEnum, discountTypeEnum, paymentMethodEnum } from "./enums";
import { serviceOrders } from "./orders";

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceNumber: varchar("invoice_number", { length: 20 }).unique().notNull(),
  orderId: uuid("order_id").unique().notNull().references(() => serviceOrders.id),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull(),
  discountType: discountTypeEnum("discount_type"),
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }).default("0").notNull(),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0").notNull(),
  tipAmount: decimal("tip_amount", { precision: 10, scale: 2 }).default("0").notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  status: invoiceStatusEnum("status").default("PENDING").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id").unique().notNull().references(() => invoices.id),
  method: paymentMethodEnum("method").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  reference: varchar("reference", { length: 255 }),
  chapaTxRef: varchar("chapa_tx_ref", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
