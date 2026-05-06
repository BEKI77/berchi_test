ALTER TYPE "public"."PaymentMethod" ADD VALUE 'CHAPA';--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "chapa_tx_ref" varchar(255);