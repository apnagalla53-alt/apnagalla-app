-- CreateTable
CREATE TABLE "expense_categories" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "icon" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "ledger_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "category_id" UUID,
    "amount" DECIMAL(15,6) NOT NULL,
    "payment_method" VARCHAR(50) NOT NULL,
    "date" DATE NOT NULL,
    "paid_to" VARCHAR(255),
    "bill_number" VARCHAR(100),
    "note" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'POSTED',
    "voucher_id" UUID,
    "attachment_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_company_id_name_key" ON "expense_categories"("company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_voucher_id_key" ON "expenses"("voucher_id");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_attachment_id_key" ON "expenses"("attachment_id");

-- CreateIndex
CREATE INDEX "expenses_company_id_branch_id_date_idx" ON "expenses"("company_id", "branch_id", "date");

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "ledger_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
