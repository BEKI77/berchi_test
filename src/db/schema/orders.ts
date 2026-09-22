import { pgTable, uuid, varchar, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { orderStatusEnum } from "./enums";
import { customers } from "./customers";
import { staff } from "./staff";
import { appointments } from "./appointments";
import { services } from "./services";
import { products } from "./products";

export const serviceOrders = pgTable("service_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderNumber: varchar("order_number", { length: 32 }).unique().notNull(),
  customerId: uuid("customer_id").references(() => customers.id),
  // The name the customer gave at reception. Kept on the ticket rather than as
  // a customers row, so a walk-in called "Abebe" does not add another Abebe to
  // the customer list every day. customerId, when set, takes precedence.
  walkInName: varchar("walk_in_name", { length: 100 }),
  serverId: uuid("server_id").references(() => staff.id),
  appointmentId: uuid("appointment_id").references(() => appointments.id),
  status: orderStatusEnum("status").default("IN_PROGRESS").notNull(),
  notes: text("notes"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => [
  index("service_orders_status_started_at_idx").on(t.status, t.startedAt),
  index("service_orders_started_at_idx").on(t.startedAt),
  index("service_orders_server_id_idx").on(t.serverId),
  index("service_orders_customer_id_idx").on(t.customerId),
  index("service_orders_appointment_id_idx").on(t.appointmentId),
]);

export const serviceOrderItems = pgTable("service_order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => serviceOrders.id, { onDelete: "cascade" }),
  serviceId: uuid("service_id").notNull().references(() => services.id),
  unitPrice: integer("unit_price").notNull(),
  quantity: integer("quantity").default(1).notNull(),
  staffId: uuid("staff_id").notNull().references(() => staff.id),
}, (t) => [
  index("service_order_items_order_id_idx").on(t.orderId),
  index("service_order_items_staff_id_idx").on(t.staffId),
  index("service_order_items_service_id_idx").on(t.serviceId),
]);

export const serviceOrderProducts = pgTable("service_order_products", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => serviceOrders.id, { onDelete: "cascade" }),
  orderItemId: uuid("order_item_id").references(() => serviceOrderItems.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(),
}, (t) => [
  index("service_order_products_order_id_idx").on(t.orderId),
  index("service_order_products_order_item_id_idx").on(t.orderItemId),
  index("service_order_products_product_id_idx").on(t.productId),
]);

export const orderItemConsumables = pgTable("order_item_consumables", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderItemId: uuid("order_item_id").notNull().references(() => serviceOrderItems.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id),
  portionsUsed: integer("portions_used").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("order_item_consumables_order_item_id_idx").on(t.orderItemId),
  index("order_item_consumables_product_id_idx").on(t.productId),
]);
