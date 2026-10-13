-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "username" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "password_hash" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "system_role" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(255) NOT NULL,
    "module" VARCHAR(50) NOT NULL,
    "resource" VARCHAR(100) NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "company_id" UUID,
    "branch_id" UUID,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "scope" VARCHAR(50) NOT NULL DEFAULT 'ALL_COMPANIES',

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" VARCHAR(255),
    "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(512),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_history" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "legal_name" VARCHAR(255),
    "code" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "legal_name" VARCHAR(255) NOT NULL,
    "trade_name" VARCHAR(255),
    "address" TEXT,
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "country" VARCHAR(100) NOT NULL DEFAULT 'India',
    "postal_code" VARCHAR(20),
    "phone" VARCHAR(50),
    "email" VARCHAR(255),
    "gstin" VARCHAR(15),
    "pan" VARCHAR(10),
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    "fy_start_month" INTEGER NOT NULL DEFAULT 4,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "address" TEXT,
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "country" VARCHAR(100) NOT NULL DEFAULT 'India',
    "postal_code" VARCHAR(20),
    "phone" VARCHAR(50),
    "email" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "godowns" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "address" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "godowns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_years" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parties" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "party_type" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "legal_name" VARCHAR(255),
    "gstin" VARCHAR(15),
    "pan" VARCHAR(10),
    "state_code" VARCHAR(10),
    "credit_days" INTEGER,
    "credit_limit" DECIMAL(15,6),
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "decimal_places" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_classes" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "hsn_code" VARCHAR(50) NOT NULL,
    "tax_rate" DECIMAL(10,2) NOT NULL,
    "cgst_rate" DECIMAL(10,2) NOT NULL,
    "sgst_rate" DECIMAL(10,2) NOT NULL,
    "igst_rate" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "tax_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "sku" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "item_type" VARCHAR(50) NOT NULL,
    "primary_unit_id" UUID NOT NULL,
    "tax_class_id" UUID,
    "purchase_rate" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "mrp" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "default_sale_rate" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "document_number" VARCHAR(100) NOT NULL,
    "document_date" DATE NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "expected_delivery_date" DATE,
    "notes" TEXT,
    "total" DECIMAL(15,6) NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_lines" (
    "id" UUID NOT NULL,
    "purchase_order_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "ordered_quantity" DECIMAL(15,6) NOT NULL,
    "received_quantity" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "rate" DECIMAL(15,6) NOT NULL,
    "discount" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "tax" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(15,6) NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "purchase_order_id" UUID,
    "document_number" VARCHAR(100) NOT NULL,
    "document_date" DATE NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "posted_at" TIMESTAMPTZ,
    "posted_by" UUID,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_lines" (
    "id" UUID NOT NULL,
    "goods_receipt_id" UUID NOT NULL,
    "purchase_order_line_id" UUID,
    "item_id" UUID NOT NULL,
    "godown_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "received_quantity" DECIMAL(15,6) NOT NULL,
    "batch_number" VARCHAR(100),
    "expiry_date" DATE,

    CONSTRAINT "goods_receipt_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoices" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "financial_year_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "supplier_invoice_number" VARCHAR(100),
    "supplier_invoice_date" DATE,
    "document_number" VARCHAR(100) NOT NULL,
    "document_date" DATE NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "payment_terms_days" INTEGER,
    "due_date" DATE,
    "taxable_amount" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "paid_amount" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "outstanding_amount" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "posted_at" TIMESTAMPTZ,
    "posted_by" UUID,

    CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoice_lines" (
    "id" UUID NOT NULL,
    "purchase_invoice_id" UUID NOT NULL,
    "goods_receipt_line_id" UUID,
    "purchase_order_line_id" UUID,
    "item_id" UUID NOT NULL,
    "godown_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "quantity" DECIMAL(15,6) NOT NULL,
    "rate" DECIMAL(15,6) NOT NULL,
    "discount_amount" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "taxable_value" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "tax_snapshot_json" TEXT,

    CONSTRAINT "purchase_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "godown_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "movement_type" VARCHAR(50) NOT NULL,
    "quantity_delta" DECIMAL(15,6) NOT NULL,
    "base_quantity_delta" DECIMAL(15,6) NOT NULL,
    "unit_id" UUID NOT NULL,
    "source_document_type" VARCHAR(100) NOT NULL,
    "source_document_id" UUID NOT NULL,
    "source_line_id" UUID,
    "cost_rate" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "value_delta" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_balance_projection" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "godown_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "quantity" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_balance_projection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "account_type" VARCHAR(50) NOT NULL DEFAULT 'ASSET',
    "normal_balance" VARCHAR(10) NOT NULL DEFAULT 'DEBIT',
    "parent_id" UUID,
    "party_id" UUID,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vouchers" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "financial_year_id" UUID NOT NULL,
    "voucher_type" VARCHAR(50) NOT NULL,
    "document_number" VARCHAR(100) NOT NULL,
    "voucher_date" DATE NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "source_document_type" VARCHAR(100),
    "source_document_id" UUID,
    "narration" TEXT,
    "posted_at" TIMESTAMPTZ,
    "posted_by" UUID,
    "reversed_voucher_id" UUID,
    "reversed_by" UUID,
    "reversed_at" TIMESTAMPTZ,
    "reversal_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_lines" (
    "id" UUID NOT NULL,
    "voucher_id" UUID NOT NULL,
    "ledger_account_id" UUID NOT NULL,
    "debit" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "credit" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "party_id" UUID,
    "narration" TEXT,

    CONSTRAINT "voucher_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_allocations" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "voucher_line_id" UUID NOT NULL,
    "reference_document_type" VARCHAR(100) NOT NULL,
    "reference_document_id" UUID NOT NULL,
    "allocation_type" VARCHAR(50) NOT NULL,
    "amount" DECIMAL(15,6) NOT NULL,
    "due_date" DATE,

    CONSTRAINT "bill_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID,
    "user_id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "source_document_type" VARCHAR(100),
    "source_document_id" UUID,
    "affected_voucher_id" UUID,
    "details" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_quotations" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "document_number" VARCHAR(100) NOT NULL,
    "document_date" DATE NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "valid_until" DATE,
    "notes" TEXT,
    "total" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "posted_by" UUID,

    CONSTRAINT "sales_quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_quotation_lines" (
    "id" UUID NOT NULL,
    "sales_quotation_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "quantity" DECIMAL(15,6) NOT NULL,
    "rate" DECIMAL(15,6) NOT NULL,
    "discount" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "tax" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(15,6) NOT NULL DEFAULT 0,

    CONSTRAINT "sales_quotation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "document_number" VARCHAR(100) NOT NULL,
    "document_date" DATE NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "expected_delivery_date" DATE,
    "notes" TEXT,
    "total" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "posted_by" UUID,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_lines" (
    "id" UUID NOT NULL,
    "sales_order_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "ordered_quantity" DECIMAL(15,6) NOT NULL,
    "delivered_quantity" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "rate" DECIMAL(15,6) NOT NULL,
    "discount" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "tax" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(15,6) NOT NULL DEFAULT 0,

    CONSTRAINT "sales_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_challans" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "sales_order_id" UUID,
    "document_number" VARCHAR(100) NOT NULL,
    "document_date" DATE NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "posted_at" TIMESTAMPTZ,
    "posted_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_challans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_challan_lines" (
    "id" UUID NOT NULL,
    "delivery_challan_id" UUID NOT NULL,
    "sales_order_line_id" UUID,
    "item_id" UUID NOT NULL,
    "godown_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "dispatched_quantity" DECIMAL(15,6) NOT NULL,
    "batch_number" VARCHAR(100),
    "expiry_date" DATE,

    CONSTRAINT "delivery_challan_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoices" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "financial_year_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "document_number" VARCHAR(100) NOT NULL,
    "document_date" DATE NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "payment_terms_days" INTEGER,
    "due_date" DATE,
    "taxable_amount" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "paid_amount" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "outstanding_amount" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "posted_at" TIMESTAMPTZ,
    "posted_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoice_lines" (
    "id" UUID NOT NULL,
    "sales_invoice_id" UUID NOT NULL,
    "delivery_challan_line_id" UUID,
    "sales_order_line_id" UUID,
    "item_id" UUID NOT NULL,
    "godown_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "quantity" DECIMAL(15,6) NOT NULL,
    "rate" DECIMAL(15,6) NOT NULL,
    "discount_amount" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "taxable_value" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "tax_snapshot_json" TEXT,

    CONSTRAINT "sales_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_returns" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "financial_year_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "original_invoice_id" UUID,
    "document_number" VARCHAR(100) NOT NULL,
    "document_date" DATE NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "taxable_amount" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "posted_at" TIMESTAMPTZ,
    "posted_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_return_lines" (
    "id" UUID NOT NULL,
    "sales_return_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "godown_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "quantity" DECIMAL(15,6) NOT NULL,
    "rate" DECIMAL(15,6) NOT NULL,
    "taxable_value" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(15,6) NOT NULL DEFAULT 0,

    CONSTRAINT "sales_return_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alembic_version" (
    "version_num" VARCHAR(32) NOT NULL,

    CONSTRAINT "alembic_version_pkey" PRIMARY KEY ("version_num")
);

-- CreateTable
CREATE TABLE "security_audit_logs" (
    "id" SERIAL NOT NULL,

    CONSTRAINT "security_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "roles_organization_id_name_key" ON "roles"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_code_key" ON "organizations"("code");

-- CreateIndex
CREATE INDEX "ix_organizations_code" ON "organizations"("code");

-- CreateIndex
CREATE INDEX "ix_organizations_is_active" ON "organizations"("is_active");

-- CreateIndex
CREATE INDEX "ix_companies_organization_id" ON "companies"("organization_id");

-- CreateIndex
CREATE INDEX "ix_companies_is_active" ON "companies"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "companies_organization_id_code_key" ON "companies"("organization_id", "code");

-- CreateIndex
CREATE INDEX "ix_branches_company_id" ON "branches"("company_id");

-- CreateIndex
CREATE INDEX "ix_branches_is_active" ON "branches"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "branches_company_id_code_key" ON "branches"("company_id", "code");

-- CreateIndex
CREATE INDEX "ix_godowns_branch_id" ON "godowns"("branch_id");

-- CreateIndex
CREATE INDEX "ix_godowns_is_active" ON "godowns"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "godowns_branch_id_code_key" ON "godowns"("branch_id", "code");

-- CreateIndex
CREATE INDEX "ix_financial_years_company_id" ON "financial_years"("company_id");

-- CreateIndex
CREATE INDEX "ix_financial_years_is_active" ON "financial_years"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "financial_years_company_id_label_key" ON "financial_years"("company_id", "label");

-- CreateIndex
CREATE INDEX "parties_code_idx" ON "parties"("code");

-- CreateIndex
CREATE INDEX "parties_name_idx" ON "parties"("name");

-- CreateIndex
CREATE INDEX "parties_gstin_idx" ON "parties"("gstin");

-- CreateIndex
CREATE INDEX "items_sku_idx" ON "items"("sku");

-- CreateIndex
CREATE INDEX "items_name_idx" ON "items"("name");

-- CreateIndex
CREATE INDEX "purchase_orders_document_number_idx" ON "purchase_orders"("document_number");

-- CreateIndex
CREATE INDEX "goods_receipts_document_number_idx" ON "goods_receipts"("document_number");

-- CreateIndex
CREATE INDEX "purchase_invoices_document_number_idx" ON "purchase_invoices"("document_number");

-- CreateIndex
CREATE UNIQUE INDEX "stock_movements_company_id_source_document_type_source_docu_key" ON "stock_movements"("company_id", "source_document_type", "source_document_id", "source_line_id", "movement_type");

-- CreateIndex
CREATE INDEX "ledger_accounts_code_idx" ON "ledger_accounts"("code");

-- CreateIndex
CREATE INDEX "ledger_accounts_account_type_idx" ON "ledger_accounts"("account_type");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_reversed_voucher_id_key" ON "vouchers"("reversed_voucher_id");

-- CreateIndex
CREATE INDEX "vouchers_source_document_type_source_document_id_idx" ON "vouchers"("source_document_type", "source_document_id");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_company_id_voucher_type_source_document_type_sourc_key" ON "vouchers"("company_id", "voucher_type", "source_document_type", "source_document_id");

-- CreateIndex
CREATE INDEX "audit_logs_source_document_type_source_document_id_idx" ON "audit_logs"("source_document_type", "source_document_id");

-- CreateIndex
CREATE INDEX "audit_logs_company_id_created_at_idx" ON "audit_logs"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "sales_quotations_document_number_idx" ON "sales_quotations"("document_number");

-- CreateIndex
CREATE INDEX "sales_orders_document_number_idx" ON "sales_orders"("document_number");

-- CreateIndex
CREATE INDEX "delivery_challans_document_number_idx" ON "delivery_challans"("document_number");

-- CreateIndex
CREATE INDEX "sales_invoices_document_number_idx" ON "sales_invoices"("document_number");

-- CreateIndex
CREATE INDEX "sales_returns_document_number_idx" ON "sales_returns"("document_number");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_history" ADD CONSTRAINT "password_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "godowns" ADD CONSTRAINT "godowns_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_years" ADD CONSTRAINT "financial_years_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parties" ADD CONSTRAINT "parties_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_classes" ADD CONSTRAINT "tax_classes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_primary_unit_id_fkey" FOREIGN KEY ("primary_unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_tax_class_id_fkey" FOREIGN KEY ("tax_class_id") REFERENCES "tax_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_purchase_order_line_id_fkey" FOREIGN KEY ("purchase_order_line_id") REFERENCES "purchase_order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_godown_id_fkey" FOREIGN KEY ("godown_id") REFERENCES "godowns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_purchase_invoice_id_fkey" FOREIGN KEY ("purchase_invoice_id") REFERENCES "purchase_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_goods_receipt_line_id_fkey" FOREIGN KEY ("goods_receipt_line_id") REFERENCES "goods_receipt_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_purchase_order_line_id_fkey" FOREIGN KEY ("purchase_order_line_id") REFERENCES "purchase_order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_godown_id_fkey" FOREIGN KEY ("godown_id") REFERENCES "godowns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_godown_id_fkey" FOREIGN KEY ("godown_id") REFERENCES "godowns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balance_projection" ADD CONSTRAINT "stock_balance_projection_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balance_projection" ADD CONSTRAINT "stock_balance_projection_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balance_projection" ADD CONSTRAINT "stock_balance_projection_godown_id_fkey" FOREIGN KEY ("godown_id") REFERENCES "godowns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balance_projection" ADD CONSTRAINT "stock_balance_projection_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_reversed_by_fkey" FOREIGN KEY ("reversed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_reversed_voucher_id_fkey" FOREIGN KEY ("reversed_voucher_id") REFERENCES "vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_lines" ADD CONSTRAINT "voucher_lines_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_lines" ADD CONSTRAINT "voucher_lines_ledger_account_id_fkey" FOREIGN KEY ("ledger_account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_lines" ADD CONSTRAINT "voucher_lines_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_allocations" ADD CONSTRAINT "bill_allocations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_allocations" ADD CONSTRAINT "bill_allocations_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_allocations" ADD CONSTRAINT "bill_allocations_voucher_line_id_fkey" FOREIGN KEY ("voucher_line_id") REFERENCES "voucher_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotations" ADD CONSTRAINT "sales_quotations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotations" ADD CONSTRAINT "sales_quotations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotations" ADD CONSTRAINT "sales_quotations_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotations" ADD CONSTRAINT "sales_quotations_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotation_lines" ADD CONSTRAINT "sales_quotation_lines_sales_quotation_id_fkey" FOREIGN KEY ("sales_quotation_id") REFERENCES "sales_quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotation_lines" ADD CONSTRAINT "sales_quotation_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotation_lines" ADD CONSTRAINT "sales_quotation_lines_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_challans" ADD CONSTRAINT "delivery_challans_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_challans" ADD CONSTRAINT "delivery_challans_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_challans" ADD CONSTRAINT "delivery_challans_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_challans" ADD CONSTRAINT "delivery_challans_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_challans" ADD CONSTRAINT "delivery_challans_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_challan_lines" ADD CONSTRAINT "delivery_challan_lines_delivery_challan_id_fkey" FOREIGN KEY ("delivery_challan_id") REFERENCES "delivery_challans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_challan_lines" ADD CONSTRAINT "delivery_challan_lines_sales_order_line_id_fkey" FOREIGN KEY ("sales_order_line_id") REFERENCES "sales_order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_challan_lines" ADD CONSTRAINT "delivery_challan_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_challan_lines" ADD CONSTRAINT "delivery_challan_lines_godown_id_fkey" FOREIGN KEY ("godown_id") REFERENCES "godowns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_challan_lines" ADD CONSTRAINT "delivery_challan_lines_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_sales_invoice_id_fkey" FOREIGN KEY ("sales_invoice_id") REFERENCES "sales_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_delivery_challan_line_id_fkey" FOREIGN KEY ("delivery_challan_line_id") REFERENCES "delivery_challan_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_sales_order_line_id_fkey" FOREIGN KEY ("sales_order_line_id") REFERENCES "sales_order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_godown_id_fkey" FOREIGN KEY ("godown_id") REFERENCES "godowns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_sales_return_id_fkey" FOREIGN KEY ("sales_return_id") REFERENCES "sales_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_godown_id_fkey" FOREIGN KEY ("godown_id") REFERENCES "godowns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

