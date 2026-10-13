-- AlterTable
ALTER TABLE "goods_receipt_lines" ADD COLUMN     "free_quantity" DECIMAL(15,6) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "purchase_invoice_lines" ADD COLUMN     "free_quantity" DECIMAL(15,6) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "purchase_invoices" ADD COLUMN     "landed_cost_amount" DECIMAL(15,6) NOT NULL DEFAULT 0,
ADD COLUMN     "replaced_return_id" UUID;

-- AlterTable
ALTER TABLE "purchase_order_lines" ADD COLUMN     "free_quantity" DECIMAL(15,6) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sales_invoices" ADD COLUMN     "replaced_return_id" UUID;

-- AlterTable
ALTER TABLE "sales_order_lines" ADD COLUMN     "sales_quotation_line_id" UUID;

-- AlterTable
ALTER TABLE "sales_orders" ADD COLUMN     "sales_quotation_id" UUID;

-- AlterTable
ALTER TABLE "sales_returns" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "reason_id" UUID;

-- CreateTable
CREATE TABLE "purchase_returns" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "financial_year_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "original_invoice_id" UUID,
    "document_number" VARCHAR(100) NOT NULL,
    "document_date" DATE NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "reason_id" UUID,
    "notes" TEXT,
    "taxable_amount" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "posted_at" TIMESTAMPTZ,
    "posted_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_return_lines" (
    "id" UUID NOT NULL,
    "purchase_return_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "godown_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "quantity" DECIMAL(15,6) NOT NULL,
    "rate" DECIMAL(15,6) NOT NULL,
    "taxable_value" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(15,6) NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_return_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_shifts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "opened_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ,
    "opening_balance" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "closing_balance" DECIMAL(15,6),
    "expected_balance" DECIMAL(15,6),
    "variance" DECIMAL(15,6),
    "notes" TEXT,

    CONSTRAINT "pos_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_held_bills" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reference_name" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grand_total" DECIMAL(15,6) NOT NULL DEFAULT 0,

    CONSTRAINT "pos_held_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_held_bill_lines" (
    "id" UUID NOT NULL,
    "pos_held_bill_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "godown_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "quantity" DECIMAL(15,6) NOT NULL,
    "rate" DECIMAL(15,6) NOT NULL,
    "discount_amount" DECIMAL(15,6) NOT NULL DEFAULT 0,

    CONSTRAINT "pos_held_bill_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustments" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "financial_year_id" UUID NOT NULL,
    "document_number" VARCHAR(100) NOT NULL,
    "document_date" DATE NOT NULL,
    "adjustment_type" VARCHAR(10) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "narration" TEXT,
    "posted_at" TIMESTAMPTZ,
    "posted_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustment_lines" (
    "id" UUID NOT NULL,
    "stock_adjustment_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "godown_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "quantity" DECIMAL(15,6) NOT NULL,
    "cost_rate" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "reason" VARCHAR(255),

    CONSTRAINT "stock_adjustment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "financial_year_id" UUID NOT NULL,
    "document_number" VARCHAR(100) NOT NULL,
    "document_date" DATE NOT NULL,
    "source_godown_id" UUID NOT NULL,
    "destination_godown_id" UUID NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "narration" TEXT,
    "posted_at" TIMESTAMPTZ,
    "posted_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfer_lines" (
    "id" UUID NOT NULL,
    "stock_transfer_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "quantity" DECIMAL(15,6) NOT NULL,

    CONSTRAINT "stock_transfer_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opening_stocks" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "financial_year_id" UUID NOT NULL,
    "document_number" VARCHAR(100) NOT NULL,
    "document_date" DATE NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "narration" TEXT,
    "posted_at" TIMESTAMPTZ,
    "posted_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "opening_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opening_stock_lines" (
    "id" UUID NOT NULL,
    "opening_stock_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "godown_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "quantity" DECIMAL(15,6) NOT NULL,
    "cost_rate" DECIMAL(15,6) NOT NULL DEFAULT 0,

    CONSTRAINT "opening_stock_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_counts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "financial_year_id" UUID NOT NULL,
    "document_number" VARCHAR(100) NOT NULL,
    "count_date" DATE NOT NULL,
    "godown_id" UUID NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "notes" TEXT,
    "counted_by" UUID,
    "posted_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "stock_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_count_lines" (
    "id" UUID NOT NULL,
    "stock_count_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "system_quantity" DECIMAL(15,6) NOT NULL,
    "counted_quantity" DECIMAL(15,6) NOT NULL,
    "variance" DECIMAL(15,6) NOT NULL,

    CONSTRAINT "stock_count_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_reasons" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claims" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "claim_type" VARCHAR(50) NOT NULL,
    "document_number" VARCHAR(100) NOT NULL,
    "document_date" DATE NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "reason_id" UUID,
    "notes" TEXT,
    "total_amount" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "sales_invoice_id" UUID,
    "purchase_invoice_id" UUID,
    "sales_return_id" UUID,
    "purchase_return_id" UUID,
    "created_by" UUID,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ,
    "settled_by" UUID,
    "settled_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_lines" (
    "id" UUID NOT NULL,
    "claim_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "quantity" DECIMAL(15,6) NOT NULL,
    "rate" DECIMAL(15,6) NOT NULL,
    "amount" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "claim_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_events" (
    "id" UUID NOT NULL,
    "claim_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "old_status" VARCHAR(50),
    "new_status" VARCHAR(50),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchase_returns_document_number_idx" ON "purchase_returns"("document_number");

-- CreateIndex
CREATE UNIQUE INDEX "stock_adjustments_company_id_document_number_key" ON "stock_adjustments"("company_id", "document_number");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfers_company_id_document_number_key" ON "stock_transfers"("company_id", "document_number");

-- CreateIndex
CREATE UNIQUE INDEX "opening_stocks_company_id_document_number_key" ON "opening_stocks"("company_id", "document_number");

-- CreateIndex
CREATE UNIQUE INDEX "stock_counts_company_id_document_number_key" ON "stock_counts"("company_id", "document_number");

-- CreateIndex
CREATE UNIQUE INDEX "return_reasons_company_id_code_key" ON "return_reasons"("company_id", "code");

-- CreateIndex
CREATE INDEX "claims_party_id_idx" ON "claims"("party_id");

-- CreateIndex
CREATE INDEX "claims_status_idx" ON "claims"("status");

-- CreateIndex
CREATE UNIQUE INDEX "claims_company_id_document_number_key" ON "claims"("company_id", "document_number");

-- CreateIndex
CREATE INDEX "claim_events_claim_id_idx" ON "claim_events"("claim_id");

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_replaced_return_id_fkey" FOREIGN KEY ("replaced_return_id") REFERENCES "purchase_returns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_reason_id_fkey" FOREIGN KEY ("reason_id") REFERENCES "return_reasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "purchase_return_lines_purchase_return_id_fkey" FOREIGN KEY ("purchase_return_id") REFERENCES "purchase_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "purchase_return_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "purchase_return_lines_godown_id_fkey" FOREIGN KEY ("godown_id") REFERENCES "godowns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "purchase_return_lines_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_sales_quotation_id_fkey" FOREIGN KEY ("sales_quotation_id") REFERENCES "sales_quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_sales_quotation_line_id_fkey" FOREIGN KEY ("sales_quotation_line_id") REFERENCES "sales_quotation_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_replaced_return_id_fkey" FOREIGN KEY ("replaced_return_id") REFERENCES "sales_returns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_reason_id_fkey" FOREIGN KEY ("reason_id") REFERENCES "return_reasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_shifts" ADD CONSTRAINT "pos_shifts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_shifts" ADD CONSTRAINT "pos_shifts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_shifts" ADD CONSTRAINT "pos_shifts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_held_bill_lines" ADD CONSTRAINT "pos_held_bill_lines_pos_held_bill_id_fkey" FOREIGN KEY ("pos_held_bill_id") REFERENCES "pos_held_bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_lines" ADD CONSTRAINT "stock_adjustment_lines_stock_adjustment_id_fkey" FOREIGN KEY ("stock_adjustment_id") REFERENCES "stock_adjustments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_lines" ADD CONSTRAINT "stock_adjustment_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_lines" ADD CONSTRAINT "stock_adjustment_lines_godown_id_fkey" FOREIGN KEY ("godown_id") REFERENCES "godowns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_lines" ADD CONSTRAINT "stock_adjustment_lines_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_source_godown_id_fkey" FOREIGN KEY ("source_godown_id") REFERENCES "godowns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_destination_godown_id_fkey" FOREIGN KEY ("destination_godown_id") REFERENCES "godowns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_stock_transfer_id_fkey" FOREIGN KEY ("stock_transfer_id") REFERENCES "stock_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_stocks" ADD CONSTRAINT "opening_stocks_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_stocks" ADD CONSTRAINT "opening_stocks_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_stocks" ADD CONSTRAINT "opening_stocks_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_stocks" ADD CONSTRAINT "opening_stocks_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_stock_lines" ADD CONSTRAINT "opening_stock_lines_opening_stock_id_fkey" FOREIGN KEY ("opening_stock_id") REFERENCES "opening_stocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_stock_lines" ADD CONSTRAINT "opening_stock_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_stock_lines" ADD CONSTRAINT "opening_stock_lines_godown_id_fkey" FOREIGN KEY ("godown_id") REFERENCES "godowns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_stock_lines" ADD CONSTRAINT "opening_stock_lines_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_godown_id_fkey" FOREIGN KEY ("godown_id") REFERENCES "godowns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_counted_by_fkey" FOREIGN KEY ("counted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_stock_count_id_fkey" FOREIGN KEY ("stock_count_id") REFERENCES "stock_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_reasons" ADD CONSTRAINT "return_reasons_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_reason_id_fkey" FOREIGN KEY ("reason_id") REFERENCES "return_reasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_settled_by_fkey" FOREIGN KEY ("settled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_sales_invoice_id_fkey" FOREIGN KEY ("sales_invoice_id") REFERENCES "sales_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_purchase_invoice_id_fkey" FOREIGN KEY ("purchase_invoice_id") REFERENCES "purchase_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_sales_return_id_fkey" FOREIGN KEY ("sales_return_id") REFERENCES "sales_returns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_purchase_return_id_fkey" FOREIGN KEY ("purchase_return_id") REFERENCES "purchase_returns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_lines" ADD CONSTRAINT "claim_lines_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_lines" ADD CONSTRAINT "claim_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_lines" ADD CONSTRAINT "claim_lines_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_events" ADD CONSTRAINT "claim_events_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_events" ADD CONSTRAINT "claim_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "uix_tenant_entitlements" RENAME TO "tenant_entitlements_organization_id_feature_id_key";

