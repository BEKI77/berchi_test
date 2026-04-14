import { pgTable, uuid, varchar, text, timestamp, decimal, integer } from "drizzle-orm/pg-core";
import { orderStatusEnum } from "./enums";
import { customers } from "./customers";
import { staff } from "./staff";
import { appointments } from "./appointments";
import { services } from "./services";
import { products } from "./products";

export const serviceOrders = pgTable("service_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderNumber: varchar("order_number", { length: 20 }).unique().notNull(),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  serverId: uuid("server_id").notNull().references(() => staff.id),
  appointmentId: uuid("appointment_id").references(() => appointments.id),
  status: orderStatusEnum("status").default("IN_PROGRESS").notNull(),
  notes: text("notes"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const serviceOrderItems = pgTable("service_order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => serviceOrders.id, { onDelete: "cascade" }),
  serviceId: uuid("service_id").notNull().references(() => services.id),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").default(1).notNull(),
  staffId: uuid("staff_id").notNull().references(() => staff.id),
});

export const serviceOrderProducts = pgTable("service_order_products", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => serviceOrders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
});
