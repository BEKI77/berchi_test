-- Money becomes an integer number of santim; rates become integer basis points.
--
-- Both use the same conversion: multiply by 100 and round. 1840.00 ETB becomes
-- 184000 santim; a 15.00% rate becomes 1500 basis points.
--
-- The USING clause is essential and is NOT what drizzle-kit generates by
-- default. Without it Postgres applies its own numeric -> integer cast, which
-- rounds 1840.00 to 1840 -- silently dividing every amount in the database by
-- one hundred. Do not remove it.
--
-- Defaults are dropped before the type change and restored after, so no cast
-- is attempted on the default expression.

-- invoices ------------------------------------------------------------------
ALTER TABLE "invoices" ALTER COLUMN "discount_value" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "discount_amount" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "tip_amount" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "subtotal" SET DATA TYPE integer USING ROUND("subtotal" * 100);--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "tax_rate" SET DATA TYPE integer USING ROUND("tax_rate" * 100);--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "tax_amount" SET DATA TYPE integer USING ROUND("tax_amount" * 100);--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "discount_value" SET DATA TYPE integer USING ROUND("discount_value" * 100);--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "discount_amount" SET DATA TYPE integer USING ROUND("discount_amount" * 100);--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "tip_amount" SET DATA TYPE integer USING ROUND("tip_amount" * 100);--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "total_amount" SET DATA TYPE integer USING ROUND("total_amount" * 100);--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "discount_value" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "discount_amount" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "tip_amount" SET DEFAULT 0;--> statement-breakpoint

-- payments ------------------------------------------------------------------
ALTER TABLE "payments" ALTER COLUMN "amount" SET DATA TYPE integer USING ROUND("amount" * 100);--> statement-breakpoint

-- staff ---------------------------------------------------------------------
ALTER TABLE "staff" ALTER COLUMN "commission_rate" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "staff" ALTER COLUMN "commission_rate" SET DATA TYPE integer USING ROUND("commission_rate" * 100);--> statement-breakpoint
ALTER TABLE "staff" ALTER COLUMN "commission_rate" SET DEFAULT 0;--> statement-breakpoint

-- services ------------------------------------------------------------------
ALTER TABLE "services" ALTER COLUMN "base_price" SET DATA TYPE integer USING ROUND("base_price" * 100);--> statement-breakpoint

-- products ------------------------------------------------------------------
ALTER TABLE "products" ALTER COLUMN "usage_price" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "cost_price" SET DATA TYPE integer USING ROUND("cost_price" * 100);--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "sell_price" SET DATA TYPE integer USING ROUND("sell_price" * 100);--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "usage_price" SET DATA TYPE integer USING ROUND("usage_price" * 100);--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "usage_price" SET DEFAULT 0;--> statement-breakpoint

-- order lines ---------------------------------------------------------------
ALTER TABLE "service_order_items" ALTER COLUMN "unit_price" SET DATA TYPE integer USING ROUND("unit_price" * 100);--> statement-breakpoint
ALTER TABLE "service_order_products" ALTER COLUMN "unit_price" SET DATA TYPE integer USING ROUND("unit_price" * 100);--> statement-breakpoint

-- commissions ---------------------------------------------------------------
ALTER TABLE "commission_logs" ALTER COLUMN "commission_rate" SET DATA TYPE integer USING ROUND("commission_rate" * 100);--> statement-breakpoint
ALTER TABLE "commission_logs" ALTER COLUMN "service_amount" SET DATA TYPE integer USING ROUND("service_amount" * 100);--> statement-breakpoint
ALTER TABLE "commission_logs" ALTER COLUMN "commission_amount" SET DATA TYPE integer USING ROUND("commission_amount" * 100);--> statement-breakpoint

-- expenses ------------------------------------------------------------------
ALTER TABLE "expense_schedules" ALTER COLUMN "amount" SET DATA TYPE integer USING ROUND("amount" * 100);--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "amount" SET DATA TYPE integer USING ROUND("amount" * 100);--> statement-breakpoint

-- settings ------------------------------------------------------------------
ALTER TABLE "salon_settings" ALTER COLUMN "tax_rate" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "salon_settings" ALTER COLUMN "tax_rate" SET DATA TYPE integer USING ROUND("tax_rate" * 100);--> statement-breakpoint
ALTER TABLE "salon_settings" ALTER COLUMN "tax_rate" SET DEFAULT 0;
