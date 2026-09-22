CREATE TABLE IF NOT EXISTS "product_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" text NOT NULL,
	"uploaded_by" uuid,
	"mode" text DEFAULT 'ADD_NEW' NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"imported_rows" integer DEFAULT 0 NOT NULL,
	"duplicate_rows" integer DEFAULT 0 NOT NULL,
	"failed_rows" integer DEFAULT 0 NOT NULL,
	"stock_rows" integer DEFAULT 0 NOT NULL,
	"batches_created" integer DEFAULT 0 NOT NULL,
	"movements_created" integer DEFAULT 0 NOT NULL,
	"categories_created" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'COMPLETED' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "product_imports" ADD CONSTRAINT "product_imports_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_product_imports_created_at" ON "product_imports" USING btree ("created_at" DESC);
