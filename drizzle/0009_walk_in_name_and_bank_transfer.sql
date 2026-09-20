ALTER TYPE "public"."PaymentMethod" ADD VALUE 'BANK_TRANSFER';--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN "walk_in_name" varchar(100);