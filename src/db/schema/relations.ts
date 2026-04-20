import { relations } from "drizzle-orm";
import { customers } from "./customers";
import { staff } from "./staff";
import { serviceCategories, services, serviceConsumables } from "./services";
import { productCategories, products } from "./products";
import { appointments } from "./appointments";
import { serviceOrders, serviceOrderItems, serviceOrderProducts, orderItemConsumables } from "./orders";
import { invoices, payments } from "./billing";
import { expenses, stockMovements, commissionLogs, productUsageLogs } from "./operations";

// ── Customers ──────────────────────────────────────────────
export const customersRelations = relations(customers, ({ many }) => ({
  appointments: many(appointments),
  serviceOrders: many(serviceOrders),
}));

// ── Staff ──────────────────────────────────────────────────
export const staffRelations = relations(staff, ({ many }) => ({
  appointments: many(appointments),
  serviceOrders: many(serviceOrders),
  serviceOrderItems: many(serviceOrderItems),
  expenses: many(expenses),
  stockMovements: many(stockMovements),
  commissionLogs: many(commissionLogs),
  productUsageLogs: many(productUsageLogs),
}));

// ── Service Categories ─────────────────────────────────────
export const serviceCategoriesRelations = relations(serviceCategories, ({ many }) => ({
  services: many(services),
}));

// ── Services ───────────────────────────────────────────────
export const servicesRelations = relations(services, ({ one, many }) => ({
  category: one(serviceCategories, {
    fields: [services.categoryId],
    references: [serviceCategories.id],
  }),
  appointments: many(appointments),
  serviceOrderItems: many(serviceOrderItems),
  consumables: many(serviceConsumables),
}));

// ── Service Consumables ─────────────────────────────────────
export const serviceConsumablesRelations = relations(serviceConsumables, ({ one }) => ({
  service: one(services, {
    fields: [serviceConsumables.serviceId],
    references: [services.id],
  }),
  product: one(products, {
    fields: [serviceConsumables.productId],
    references: [products.id],
  }),
}));

// ── Product Categories ─────────────────────────────────────
export const productCategoriesRelations = relations(productCategories, ({ many }) => ({
  products: many(products),
}));

// ── Products ───────────────────────────────────────────────
export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(productCategories, {
    fields: [products.categoryId],
    references: [productCategories.id],
  }),
  serviceOrderProducts: many(serviceOrderProducts),
  stockMovements: many(stockMovements),
  consumables: many(serviceConsumables),
  usageLogs: many(productUsageLogs),
  orderItemConsumables: many(orderItemConsumables),
}));

// ── Appointments ───────────────────────────────────────────
export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
  customer: one(customers, {
    fields: [appointments.customerId],
    references: [customers.id],
  }),
  staff: one(staff, {
    fields: [appointments.staffId],
    references: [staff.id],
  }),
  service: one(services, {
    fields: [appointments.serviceId],
    references: [services.id],
  }),
  serviceOrders: many(serviceOrders),
}));

// ── Service Orders ─────────────────────────────────────────
export const serviceOrdersRelations = relations(serviceOrders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [serviceOrders.customerId],
    references: [customers.id],
  }),
  server: one(staff, {
    fields: [serviceOrders.serverId],
    references: [staff.id],
  }),
  appointment: one(appointments, {
    fields: [serviceOrders.appointmentId],
    references: [appointments.id],
  }),
  items: many(serviceOrderItems),
  products: many(serviceOrderProducts),
  invoice: one(invoices),
  productUsageLogs: many(productUsageLogs),
}));

// ── Service Order Items ────────────────────────────────────
export const serviceOrderItemsRelations = relations(serviceOrderItems, ({ one, many }) => ({
  order: one(serviceOrders, {
    fields: [serviceOrderItems.orderId],
    references: [serviceOrders.id],
  }),
  service: one(services, {
    fields: [serviceOrderItems.serviceId],
    references: [services.id],
  }),
  staff: one(staff, {
    fields: [serviceOrderItems.staffId],
    references: [staff.id],
  }),
  commissionLogs: many(commissionLogs),
  consumablesUsed: many(orderItemConsumables),
  products: many(serviceOrderProducts),
}));

// ── Service Order Products ─────────────────────────────────
export const serviceOrderProductsRelations = relations(serviceOrderProducts, ({ one }) => ({
  order: one(serviceOrders, {
    fields: [serviceOrderProducts.orderId],
    references: [serviceOrders.id],
  }),
  product: one(products, {
    fields: [serviceOrderProducts.productId],
    references: [products.id],
  }),
  orderItem: one(serviceOrderItems, {
    fields: [serviceOrderProducts.orderItemId],
    references: [serviceOrderItems.id],
  }),
}));

// ── Order Item Consumables ─────────────────────────────────
export const orderItemConsumablesRelations = relations(orderItemConsumables, ({ one }) => ({
  orderItem: one(serviceOrderItems, {
    fields: [orderItemConsumables.orderItemId],
    references: [serviceOrderItems.id],
  }),
  product: one(products, {
    fields: [orderItemConsumables.productId],
    references: [products.id],
  }),
}));

// ── Invoices ───────────────────────────────────────────────
export const invoicesRelations = relations(invoices, ({ one }) => ({
  order: one(serviceOrders, {
    fields: [invoices.orderId],
    references: [serviceOrders.id],
  }),
  payment: one(payments),
}));

// ── Payments ───────────────────────────────────────────────
export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
}));

// ── Expenses ───────────────────────────────────────────────
export const expensesRelations = relations(expenses, ({ one }) => ({
  staff: one(staff, {
    fields: [expenses.loggedBy],
    references: [staff.id],
  }),
}));

// ── Stock Movements ────────────────────────────────────────
export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  product: one(products, {
    fields: [stockMovements.productId],
    references: [products.id],
  }),
  staff: one(staff, {
    fields: [stockMovements.performedBy],
    references: [staff.id],
  }),
}));

// ── Product Usage Logs ─────────────────────────────────────
export const productUsageLogsRelations = relations(productUsageLogs, ({ one }) => ({
  product: one(products, {
    fields: [productUsageLogs.productId],
    references: [products.id],
  }),
  order: one(serviceOrders, {
    fields: [productUsageLogs.orderId],
    references: [serviceOrders.id],
  }),
  staff: one(staff, {
    fields: [productUsageLogs.staffId],
    references: [staff.id],
  }),
}));

// ── Commission Logs ────────────────────────────────────────
export const commissionLogsRelations = relations(commissionLogs, ({ one }) => ({
  staff: one(staff, {
    fields: [commissionLogs.staffId],
    references: [staff.id],
  }),
  serviceOrderItem: one(serviceOrderItems, {
    fields: [commissionLogs.serviceOrderItemId],
    references: [serviceOrderItems.id],
  }),
}));
