CREATE TYPE "public"."ExpenseStatus" AS ENUM('DUE', 'PAID', 'SKIPPED', 'OVERDUE');--> statement-breakpoint
CREATE TYPE "public"."ExpenseType" AS ENUM('SPONTANEOUS', 'RECURRING');--> statement-breakpoint
CREATE TYPE "public"."RecurrenceFrequency" AS ENUM('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM');--> statement-breakpoint
CREATE TABLE "expense_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" "ExpenseCategory" NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"frequency" "RecurrenceFrequency" NOT NULL,
	"interval" integer DEFAULT 1 NOT NULL,
	"day_of_month" integer,
	"day_of_week" integer,
	"start_date" date NOT NULL,
	"end_date" date,
	"next_due_date" date NOT NULL,
	"payee_staff_id" uuid,
	"payee_name" varchar(255),
	"auto_post" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "type" "ExpenseType" DEFAULT 'SPONTANEOUS' NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "status" "ExpenseStatus" DEFAULT 'PAID' NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "schedule_id" uuid;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "due_date" date;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "payee_staff_id" uuid;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "payee_name" varchar(255);--> statement-breakpoint
ALTER TABLE "expense_schedules" ADD CONSTRAINT "expense_schedules_payee_staff_id_staff_id_fk" FOREIGN KEY ("payee_staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_schedules" ADD CONSTRAINT "expense_schedules_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_schedule_id_expense_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."expense_schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_payee_staff_id_staff_id_fk" FOREIGN KEY ("payee_staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;