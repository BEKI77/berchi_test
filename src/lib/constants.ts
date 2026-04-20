export const APP_NAME = "Berchi Salon";

export const ROLES = {
  SERVER: "SERVER",
  CASHIER: "CASHIER",
  OWNER: "OWNER",
} as const;

export const ORDER_STATUSES = {
  IN_PROGRESS: "IN_PROGRESS",
  SENT_TO_CASHIER: "SENT_TO_CASHIER",
  CHECKED_OUT: "CHECKED_OUT",
  CANCELLED: "CANCELLED",
} as const;

export const INVOICE_STATUSES = {
  PENDING: "PENDING",
  PAID: "PAID",
  REFUNDED: "REFUNDED",
  VOIDED: "VOIDED",
} as const;

export const PAYMENT_METHODS = {
  CASH: "CASH",
  CARD: "CARD",
  MOBILE: "MOBILE",
} as const;

export const EXPENSE_CATEGORIES = {
  SUPPLIES: "SUPPLIES",
  RENT: "RENT",
  UTILITIES: "UTILITIES",
  EQUIPMENT: "EQUIPMENT",
  MARKETING: "MARKETING",
  SALARIES: "SALARIES",
  OTHER: "OTHER",
} as const;

export const APPOINTMENT_STATUSES = {
  SCHEDULED: "SCHEDULED",
  CONFIRMED: "CONFIRMED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  NO_SHOW: "NO_SHOW",
  CANCELLED: "CANCELLED",
} as const;

export const DEFAULT_BUSINESS_HOURS: Record<string, { open: string; close: string }> = {
  monday: { open: "09:00", close: "20:00" },
  tuesday: { open: "09:00", close: "20:00" },
  wednesday: { open: "09:00", close: "20:00" },
  thursday: { open: "09:00", close: "20:00" },
  friday: { open: "09:00", close: "20:00" },
  saturday: { open: "09:00", close: "18:00" },
  sunday: { open: "closed", close: "closed" },
};

export const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
