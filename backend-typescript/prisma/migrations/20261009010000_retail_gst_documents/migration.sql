CREATE TABLE "retail_gst_invoices" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "sales_invoice_id" UUID NOT NULL,
  "financial_year" VARCHAR(9) NOT NULL,
  "document_number" VARCHAR(16) NOT NULL,
  "issue_date" DATE NOT NULL,
  "snapshot" JSONB NOT NULL,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "retail_gst_invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "retail_gst_invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "retail_gst_invoices_sales_invoice_id_fkey" FOREIGN KEY ("sales_invoice_id") REFERENCES "sales_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "retail_gst_invoices_sales_invoice_id_key" ON "retail_gst_invoices"("sales_invoice_id");
CREATE UNIQUE INDEX "retail_gst_invoices_company_id_financial_year_document_number_key" ON "retail_gst_invoices"("company_id","financial_year","document_number");
CREATE INDEX "retail_gst_invoices_company_id_branch_id_created_at_idx" ON "retail_gst_invoices"("company_id","branch_id","created_at");
CREATE TABLE "retail_gst_sequences" (
  "company_id" UUID NOT NULL,
  "financial_year" VARCHAR(9) NOT NULL,
  "last_number" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "retail_gst_sequences_pkey" PRIMARY KEY ("company_id","financial_year"),
  CONSTRAINT "retail_gst_sequences_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "retail_gst_sequences_last_number_check" CHECK ("last_number" BETWEEN 0 AND 999999)
);
