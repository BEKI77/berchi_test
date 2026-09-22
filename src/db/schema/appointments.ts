import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { appointmentStatusEnum, appointmentSourceEnum } from "./enums";
import { customers } from "./customers";
import { staff } from "./staff";
import { services } from "./services";

export const appointments = pgTable("appointments", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  staffId: uuid("staff_id").references(() => staff.id),
  serviceId: uuid("service_id").notNull().references(() => services.id),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  status: appointmentStatusEnum("status").default("SCHEDULED").notNull(),
  source: appointmentSourceEnum("source").default("MANUAL").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => [
  index("appointments_start_time_idx").on(t.startTime),
  index("appointments_staff_id_start_time_idx").on(t.staffId, t.startTime),
  index("appointments_customer_id_idx").on(t.customerId),
  index("appointments_service_id_idx").on(t.serviceId),
]);
