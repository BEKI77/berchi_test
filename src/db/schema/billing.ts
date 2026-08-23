import { pgTable, uuid, varchar, timestamp, integer} from "drizzle-orm/pg-core";
import { invoiceStatusEnum, discountTypeEnum, paymentMethodEnum } from "./enums";
import { serviceOrders } from "./orders";

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceNumber: varchar("invoice_number", { length: 32 }).unique().notNull(),
  orderId: uuid("order_id").unique().notNull().references(() => serviceOrders.id),
  subtotal: integer("subtotal").notNull(),
  taxRate: integer("tax_rate").notNull(),
  taxAmount: integer("tax_amount").notNull(),
  discountType: discountTypeEnum("discount_type"),
  discountValue: integer("discount_value").default(0).notNull(),
  discountAmount: integer("discount_amount").default(0).notNull(),
  tipAmount: integer("tip_amount").default(0).notNull(),
  totalAmount: integer("total_amount").notNull(),
  status: invoiceStatusEnum("status").default("PENDING").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id").unique().notNull().references(() => invoices.id),
  method: paymentMethodEnum("method").notNull(),
  amount: integer("amount").notNull(),
  reference: varchar("reference", { length: 255 }),
  chapaTxRef: varchar("chapa_tx_ref", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
