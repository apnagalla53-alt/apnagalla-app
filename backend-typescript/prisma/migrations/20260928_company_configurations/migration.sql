-- CreateTable
CREATE TABLE "company_configurations" (
    "company_id" UUID NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'INR',
    "default_branch_id" UUID,
    "default_cash_ledger_id" UUID,
    "default_bank_ledger_id" UUID,
    "tax_configuration" JSONB,
    "invoice_configuration" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_configurations_pkey" PRIMARY KEY ("company_id")
);

-- AddForeignKey
ALTER TABLE "company_configurations" ADD CONSTRAINT "company_configurations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_configurations" ADD CONSTRAINT "company_configurations_default_branch_id_fkey" FOREIGN KEY ("default_branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_configurations" ADD CONSTRAINT "company_configurations_default_cash_ledger_id_fkey" FOREIGN KEY ("default_cash_ledger_id") REFERENCES "ledger_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_configurations" ADD CONSTRAINT "company_configurations_default_bank_ledger_id_fkey" FOREIGN KEY ("default_bank_ledger_id") REFERENCES "ledger_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
