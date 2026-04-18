import { pgEnum } from "drizzle-orm/pg-core";

export const staffRoleEnum = pgEnum("StaffRole", ["SERVER", "CASHIER", "OWNER"]);

export const appointmentStatusEnum = pgEnum("AppointmentStatus", [
  "SCHEDULED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "NO_SHOW", "CANCELLED", "BLOCKED",
]);

export const appointmentSourceEnum = pgEnum("AppointmentSource", ["MANUAL", "ONLINE"]);

export const orderStatusEnum = pgEnum("OrderStatus", [
  "IN_PROGRESS", "SENT_TO_CASHIER", "CHECKED_OUT", "CANCELLED",
]);

export const invoiceStatusEnum = pgEnum("InvoiceStatus", [
  "PENDING", "PAID", "REFUNDED", "VOIDED",
]);

export const discountTypeEnum = pgEnum("DiscountType", ["PERCENTAGE", "FIXED"]);

export const paymentMethodEnum = pgEnum("PaymentMethod", ["CASH", "CARD", "MOBILE"]);

export const expenseCategoryEnum = pgEnum("ExpenseCategory", [
  "SUPPLIES", "RENT", "UTILITIES", "EQUIPMENT", "MARKETING", "SALARIES", "OTHER",
]);

export const stockMovementTypeEnum = pgEnum("StockMovementType", [
  "RESTOCK", "USED_IN_SERVICE", "SOLD", "ADJUSTMENT", "DAMAGED",
]);
