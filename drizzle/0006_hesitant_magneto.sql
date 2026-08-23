CREATE TABLE "document_counters" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"last_seq" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "invoice_number" SET DATA TYPE varchar(32);--> statement-breakpoint
ALTER TABLE "service_orders" ALTER COLUMN "order_number" SET DATA TYPE varchar(32);--> statement-breakpoint
ALTER TABLE "service_orders" ALTER COLUMN "customer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "service_orders" ALTER COLUMN "server_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "salon_settings" ADD COLUMN "timezone" varchar(64) DEFAULT 'Africa/Addis_Ababa' NOT NULL;--> statement-breakpoint
-- Seed the counters from numbers already issued, so the first ticket after this
-- migration continues the sequence instead of restarting at 0001 and colliding
-- with an existing order_number.
INSERT INTO "document_counters" ("key", "last_seq")
SELECT
  'order:' || split_part("order_number", '-', 2),
  MAX(CAST(split_part("order_number", '-', 3) AS INTEGER))
FROM "service_orders"
WHERE "order_number" ~ '^ORD-[0-9]{8}-[0-9]+$'
GROUP BY split_part("order_number", '-', 2)
ON CONFLICT ("key") DO UPDATE
  SET "last_seq" = GREATEST("document_counters"."last_seq", EXCLUDED."last_seq");
--> statement-breakpoint
INSERT INTO "document_counters" ("key", "last_seq")
SELECT
  'invoice:' || split_part("invoice_number", '-', 2),
  MAX(CAST(split_part("invoice_number", '-', 3) AS INTEGER))
FROM "invoices"
WHERE "invoice_number" ~ '^INV-[0-9]{8}-[0-9]+$'
GROUP BY split_part("invoice_number", '-', 2)
ON CONFLICT ("key") DO UPDATE
  SET "last_seq" = GREATEST("document_counters"."last_seq", EXCLUDED."last_seq");
