CREATE TABLE "staff_pin_attempts" (
	"staff_id" uuid PRIMARY KEY NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "pin_hash" varchar(255);--> statement-breakpoint
ALTER TABLE "staff_pin_attempts" ADD CONSTRAINT "staff_pin_attempts_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;