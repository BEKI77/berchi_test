CREATE TABLE "service_consumables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"portions_required" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_item_consumables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_item_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"portions_used" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"portions_used" integer NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "portions_per_unit" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "remaining_portions" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "is_consumable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "portions_change" integer;--> statement-breakpoint
ALTER TABLE "service_consumables" ADD CONSTRAINT "service_consumables_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_consumables" ADD CONSTRAINT "service_consumables_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_consumables" ADD CONSTRAINT "order_item_consumables_order_item_id_service_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."service_order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_consumables" ADD CONSTRAINT "order_item_consumables_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_usage_logs" ADD CONSTRAINT "product_usage_logs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_usage_logs" ADD CONSTRAINT "product_usage_logs_order_id_service_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."service_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_usage_logs" ADD CONSTRAINT "product_usage_logs_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;