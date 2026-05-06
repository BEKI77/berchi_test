import { customers } from "./customers";
import { staff } from "./staff";
import { services, serviceCategories } from "./services";
import { products, productCategories } from "./products";
import { appointments } from "./appointments";
import { serviceOrders, serviceOrderItems, serviceOrderProducts } from "./orders";
import { invoices, payments } from "./billing";
import { expenses, stockMovements, commissionLogs, expenseSchedules } from "./operations";
import { salonSettings } from "./settings";
import {
  discountTypeEnum,
  paymentMethodEnum,
  staffRoleEnum,
  appointmentStatusEnum,
  orderStatusEnum,
  invoiceStatusEnum,
  expenseCategoryEnum,
  stockMovementTypeEnum,
  expenseTypeEnum,
  recurrenceFrequencyEnum,
  expenseStatusEnum,
} from "./enums";

// Table types
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Staff = typeof staff.$inferSelect;
export type NewStaff = typeof staff.$inferInsert;
export type Service = typeof services.$inferSelect;
export type ServiceCategory = typeof serviceCategories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductCategory = typeof productCategories.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type ServiceOrder = typeof serviceOrders.$inferSelect;
export type ServiceOrderItem = typeof serviceOrderItems.$inferSelect;
export type ServiceOrderProduct = typeof serviceOrderProducts.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type StockMovement = typeof stockMovements.$inferSelect;
export type CommissionLog = typeof commissionLogs.$inferSelect;
export type ExpenseSchedule = typeof expenseSchedules.$inferSelect;
export type NewExpenseSchedule = typeof expenseSchedules.$inferInsert;
export type SalonSettings = typeof salonSettings.$inferSelect;

// Enum types
export type DiscountType = (typeof discountTypeEnum.enumValues)[number];
export type PaymentMethod = (typeof paymentMethodEnum.enumValues)[number];
export type StaffRole = (typeof staffRoleEnum.enumValues)[number];
export type AppointmentStatus = (typeof appointmentStatusEnum.enumValues)[number];
export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];
export type InvoiceStatus = (typeof invoiceStatusEnum.enumValues)[number];
export type ExpenseCategory = (typeof expenseCategoryEnum.enumValues)[number];
export type StockMovementType = (typeof stockMovementTypeEnum.enumValues)[number];
export type ExpenseType = (typeof expenseTypeEnum.enumValues)[number];
export type RecurrenceFrequency = (typeof recurrenceFrequencyEnum.enumValues)[number];
export type ExpenseStatus = (typeof expenseStatusEnum.enumValues)[number];
