import { pgTable, uuid, varchar, text, timestamp, decimal, integer, date, boolean } from "drizzle-orm/pg-core";
import { expenseCategoryEnum, stockMovementTypeEnum, recurrenceFrequencyEnum, expenseTypeEnum, expenseStatusEnum } from "./enums";
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
  type: expenseTypeEnum("type").notNull().default("SPONTANEOUS"),
  status: expenseStatusEnum("status").notNull().default("PAID"),
  scheduleId: uuid("schedule_id").references(() => expenseSchedules.id),
  dueDate: date("due_date"),
  payeeStaffId: uuid("payee_staff_id").references(() => staff.id),
  payeeName: varchar("payee_name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const expenseSchedules = pgTable("expense_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: expenseCategoryEnum("category").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  frequency: recurrenceFrequencyEnum("frequency").notNull(),
  interval: integer("interval").notNull().default(1),
  dayOfMonth: integer("day_of_month"),
  dayOfWeek: integer("day_of_week"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  nextDueDate: date("next_due_date").notNull(),
  payeeStaffId: uuid("payee_staff_id").references(() => staff.id),
  payeeName: varchar("payee_name", { length: 255 }),
  autoPost: boolean("auto_post").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: uuid("created_by").notNull().references(() => staff.id),
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
