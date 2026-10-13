ALTER TABLE "items" ADD COLUMN "inventory_tracking" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "sales_invoice_lines" ADD COLUMN "inventory_tracked" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "parties" ADD COLUMN "visit_date" DATE, ADD COLUMN "visit_cycle" VARCHAR(20) NOT NULL DEFAULT 'NONE';
ALTER TABLE "company_configurations" ADD COLUMN "checkout_voice_configuration" JSONB;
CREATE TABLE "retail_calendar_tasks" (
 "id" UUID NOT NULL, "company_id" UUID NOT NULL, "branch_id" UUID NOT NULL,
 "title" VARCHAR(200) NOT NULL, "date" DATE NOT NULL, "completed" BOOLEAN NOT NULL DEFAULT false,
 "created_by" UUID NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "retail_calendar_tasks_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "retail_calendar_tasks_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT,
 CONSTRAINT "retail_calendar_tasks_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT
);
CREATE INDEX "retail_calendar_tasks_company_id_branch_id_date_idx" ON "retail_calendar_tasks"("company_id", "branch_id", "date");
