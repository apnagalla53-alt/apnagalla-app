-- AlterTable
ALTER TABLE "parties" ADD COLUMN     "block_reason" TEXT,
ADD COLUMN     "blocked_at" TIMESTAMPTZ,
ADD COLUMN     "temporary_credit_expiry" DATE,
ADD COLUMN     "temporary_credit_limit" DECIMAL(15,6);

-- AlterTable
ALTER TABLE "purchase_invoices" ADD COLUMN     "photo_attachment_url" VARCHAR(1024);

-- AlterTable
ALTER TABLE "vouchers" ADD COLUMN     "photo_attachment_url" VARCHAR(1024);

-- CreateTable
CREATE TABLE "credit_overrides" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "override_type" VARCHAR(50) NOT NULL,
    "requested_by" UUID NOT NULL,
    "approved_by" UUID,
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "override_amount" DECIMAL(15,6),
    "valid_until" DATE,
    "reason" TEXT,
    "approval_notes" TEXT,
    "source_document_type" VARCHAR(100),
    "source_document_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID,
    "ledger_account_id" UUID NOT NULL,
    "bank_name" VARCHAR(100) NOT NULL,
    "account_number" VARCHAR(50) NOT NULL,
    "ifsc_code" VARCHAR(20),
    "branch_name" VARCHAR(100),
    "account_type" VARCHAR(20) NOT NULL DEFAULT 'CURRENT',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cheques" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID,
    "financial_year_id" UUID,
    "cheque_type" VARCHAR(20) NOT NULL,
    "cheque_number" VARCHAR(50) NOT NULL,
    "cheque_date" DATE NOT NULL,
    "amount" DECIMAL(15,6) NOT NULL,
    "party_id" UUID,
    "bank_account_id" UUID,
    "drawee_bank_name" VARCHAR(100),
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "voucher_id" UUID,
    "cleared_date" DATE,
    "bounce_reason" VARCHAR(255),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cheques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_reconciliations" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "reconciliation_date" DATE NOT NULL,
    "statement_balance" DECIMAL(15,6) NOT NULL,
    "book_balance" DECIMAL(15,6) NOT NULL,
    "difference" DECIMAL(15,6) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "need_lists" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "quantity" DECIMAL(15,6) NOT NULL DEFAULT 1,
    "customer_id" UUID,
    "customer_phone" VARCHAR(50),
    "preferred_supplier_id" UUID,
    "needed_by" DATE,
    "priority" VARCHAR(50) NOT NULL DEFAULT 'NORMAL',
    "source" VARCHAR(50) NOT NULL DEFAULT 'SHOP',
    "status" VARCHAR(50) NOT NULL DEFAULT 'NEED',
    "note" TEXT,
    "photo_attachment_url" VARCHAR(1024),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "need_lists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credit_overrides_company_id_party_id_idx" ON "credit_overrides"("company_id", "party_id");

-- CreateIndex
CREATE INDEX "credit_overrides_status_idx" ON "credit_overrides"("status");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_ledger_account_id_key" ON "bank_accounts"("ledger_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "cheques_voucher_id_key" ON "cheques"("voucher_id");

-- CreateIndex
CREATE INDEX "cheques_company_id_status_idx" ON "cheques"("company_id", "status");

-- CreateIndex
CREATE INDEX "cheques_company_id_cheque_type_idx" ON "cheques"("company_id", "cheque_type");

-- CreateIndex
CREATE INDEX "cheques_cheque_date_idx" ON "cheques"("cheque_date");

-- CreateIndex
CREATE INDEX "need_lists_company_id_status_idx" ON "need_lists"("company_id", "status");

-- AddForeignKey
ALTER TABLE "credit_overrides" ADD CONSTRAINT "credit_overrides_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_overrides" ADD CONSTRAINT "credit_overrides_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_ledger_account_id_fkey" FOREIGN KEY ("ledger_account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cheques" ADD CONSTRAINT "cheques_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cheques" ADD CONSTRAINT "cheques_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cheques" ADD CONSTRAINT "cheques_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cheques" ADD CONSTRAINT "cheques_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cheques" ADD CONSTRAINT "cheques_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "need_lists" ADD CONSTRAINT "need_lists_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "need_lists" ADD CONSTRAINT "need_lists_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "need_lists" ADD CONSTRAINT "need_lists_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "need_lists" ADD CONSTRAINT "need_lists_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "need_lists" ADD CONSTRAINT "need_lists_preferred_supplier_id_fkey" FOREIGN KEY ("preferred_supplier_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "need_lists" ADD CONSTRAINT "need_lists_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
