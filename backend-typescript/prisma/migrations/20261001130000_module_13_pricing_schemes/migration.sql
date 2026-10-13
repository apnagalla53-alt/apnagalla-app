-- AlterTable
ALTER TABLE "parties" ADD COLUMN     "price_list_id" UUID;

-- AlterTable
ALTER TABLE "pos_held_bill_lines" ADD COLUMN     "free_quantity" DECIMAL(15,6) NOT NULL DEFAULT 0,
ADD COLUMN     "pricing_trace_json" TEXT;

-- AlterTable
ALTER TABLE "sales_invoice_lines" ADD COLUMN     "free_quantity" DECIMAL(15,6) NOT NULL DEFAULT 0,
ADD COLUMN     "pricing_trace_json" TEXT;

-- AlterTable
ALTER TABLE "sales_order_lines" ADD COLUMN     "free_quantity" DECIMAL(15,6) NOT NULL DEFAULT 0,
ADD COLUMN     "pricing_trace_json" TEXT;

-- AlterTable
ALTER TABLE "sales_quotation_lines" ADD COLUMN     "free_quantity" DECIMAL(15,6) NOT NULL DEFAULT 0,
ADD COLUMN     "pricing_trace_json" TEXT;

-- CreateTable
CREATE TABLE "price_lists" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'INR',
    "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    "valid_from" DATE,
    "valid_to" DATE,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "customer_type" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_list_items" (
    "id" UUID NOT NULL,
    "price_list_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "unit_id" UUID,
    "rate" DECIMAL(15,6) NOT NULL,
    "min_qty" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "max_qty" DECIMAL(15,6),
    "discount_percent" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_item_prices" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "unit_id" UUID,
    "rate" DECIMAL(15,6) NOT NULL,
    "min_qty" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "max_qty" DECIMAL(15,6),
    "valid_from" DATE,
    "valid_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_item_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_schemes" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "scheme_type" VARCHAR(50) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    "valid_from" DATE,
    "valid_to" DATE,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "customer_type" VARCHAR(50),
    "party_id" UUID,
    "item_id" UUID,
    "buy_quantity" DECIMAL(15,6),
    "get_quantity" DECIMAL(15,6),
    "free_item_id" UUID,
    "discount_percent" DECIMAL(10,2),
    "discount_amount" DECIMAL(15,6),
    "min_order_amount" DECIMAL(15,6),
    "max_benefit" DECIMAL(15,6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_schemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_traces" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "document_type" VARCHAR(50) NOT NULL,
    "document_id" UUID NOT NULL,
    "line_id" UUID,
    "item_id" UUID NOT NULL,
    "party_id" UUID,
    "pricing_engine_version" VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    "base_price" DECIMAL(15,6) NOT NULL,
    "resolved_rate" DECIMAL(15,6) NOT NULL,
    "price_list_id" UUID,
    "price_list_item_id" UUID,
    "customer_rate_id" UUID,
    "quantity_slab_id" UUID,
    "promotion_id" UUID,
    "original_quantity" DECIMAL(15,6) NOT NULL,
    "charged_quantity" DECIMAL(15,6) NOT NULL,
    "free_quantity" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "discount_percent" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "final_unit_price" DECIMAL(15,6) NOT NULL,
    "final_line_amount" DECIMAL(15,6) NOT NULL,
    "precedence_reason" VARCHAR(255),
    "trace_details_json" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_traces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "price_lists_company_id_status_idx" ON "price_lists"("company_id", "status");

-- CreateIndex
CREATE INDEX "price_lists_valid_from_valid_to_idx" ON "price_lists"("valid_from", "valid_to");

-- CreateIndex
CREATE UNIQUE INDEX "price_lists_company_id_code_key" ON "price_lists"("company_id", "code");

-- CreateIndex
CREATE INDEX "price_list_items_price_list_id_item_id_idx" ON "price_list_items"("price_list_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "price_list_items_price_list_id_item_id_min_qty_key" ON "price_list_items"("price_list_id", "item_id", "min_qty");

-- CreateIndex
CREATE INDEX "customer_item_prices_company_id_party_id_item_id_idx" ON "customer_item_prices"("company_id", "party_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_item_prices_party_id_item_id_min_qty_key" ON "customer_item_prices"("party_id", "item_id", "min_qty");

-- CreateIndex
CREATE INDEX "promotion_schemes_company_id_status_idx" ON "promotion_schemes"("company_id", "status");

-- CreateIndex
CREATE INDEX "promotion_schemes_valid_from_valid_to_idx" ON "promotion_schemes"("valid_from", "valid_to");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_schemes_company_id_code_key" ON "promotion_schemes"("company_id", "code");

-- CreateIndex
CREATE INDEX "pricing_traces_company_id_document_type_document_id_idx" ON "pricing_traces"("company_id", "document_type", "document_id");

-- CreateIndex
CREATE INDEX "pricing_traces_line_id_idx" ON "pricing_traces"("line_id");

-- CreateIndex
CREATE INDEX "pricing_traces_item_id_idx" ON "pricing_traces"("item_id");

-- AddForeignKey
ALTER TABLE "parties" ADD CONSTRAINT "parties_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_item_prices" ADD CONSTRAINT "customer_item_prices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_item_prices" ADD CONSTRAINT "customer_item_prices_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_item_prices" ADD CONSTRAINT "customer_item_prices_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_item_prices" ADD CONSTRAINT "customer_item_prices_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_schemes" ADD CONSTRAINT "promotion_schemes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_schemes" ADD CONSTRAINT "promotion_schemes_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_schemes" ADD CONSTRAINT "promotion_schemes_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_schemes" ADD CONSTRAINT "promotion_schemes_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_schemes" ADD CONSTRAINT "promotion_schemes_free_item_id_fkey" FOREIGN KEY ("free_item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_traces" ADD CONSTRAINT "pricing_traces_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_traces" ADD CONSTRAINT "pricing_traces_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_traces" ADD CONSTRAINT "pricing_traces_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
