-- Migration Data
UPDATE "items" SET "item_type" = 'STOCK_ITEM' WHERE "item_type" = 'GOODS';

-- AlterTable
ALTER TABLE "delivery_challan_lines" ADD COLUMN     "base_quantity" DECIMAL(15,6),
ADD COLUMN     "batch_id" UUID,
ADD COLUMN     "conversion_factor" DECIMAL(15,6),
ADD COLUMN     "dimensions" JSONB,
ADD COLUMN     "entered_quantity" DECIMAL(15,6),
ADD COLUMN     "entered_unit_id" UUID,
ADD COLUMN     "modifiers" JSONB,
ADD COLUMN     "serial_ids" JSONB,
ADD COLUMN     "variant_id" UUID;

-- AlterTable
ALTER TABLE "goods_receipt_lines" ADD COLUMN     "base_quantity" DECIMAL(15,6),
ADD COLUMN     "batch_id" UUID,
ADD COLUMN     "conversion_factor" DECIMAL(15,6),
ADD COLUMN     "dimensions" JSONB,
ADD COLUMN     "entered_quantity" DECIMAL(15,6),
ADD COLUMN     "entered_unit_id" UUID,
ADD COLUMN     "modifiers" JSONB,
ADD COLUMN     "serial_ids" JSONB,
ADD COLUMN     "variant_id" UUID;

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "compatibility_tags" TEXT,
ADD COLUMN     "custom_attributes" JSONB,
ADD COLUMN     "has_variants" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_bundle" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "selling_mode" VARCHAR(50) NOT NULL DEFAULT 'PIECE',
ADD COLUMN     "track_batch" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "track_serial" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "warranty_days" INTEGER;

-- AlterTable
ALTER TABLE "pos_held_bill_lines" ADD COLUMN     "base_quantity" DECIMAL(15,6),
ADD COLUMN     "batch_id" UUID,
ADD COLUMN     "conversion_factor" DECIMAL(15,6),
ADD COLUMN     "dimensions" JSONB,
ADD COLUMN     "entered_quantity" DECIMAL(15,6),
ADD COLUMN     "entered_unit_id" UUID,
ADD COLUMN     "modifiers" JSONB,
ADD COLUMN     "serial_ids" JSONB,
ADD COLUMN     "variant_id" UUID;

-- AlterTable
ALTER TABLE "purchase_invoice_lines" ADD COLUMN     "base_quantity" DECIMAL(15,6),
ADD COLUMN     "batch_id" UUID,
ADD COLUMN     "conversion_factor" DECIMAL(15,6),
ADD COLUMN     "dimensions" JSONB,
ADD COLUMN     "entered_quantity" DECIMAL(15,6),
ADD COLUMN     "entered_unit_id" UUID,
ADD COLUMN     "modifiers" JSONB,
ADD COLUMN     "serial_ids" JSONB,
ADD COLUMN     "variant_id" UUID;

-- AlterTable
ALTER TABLE "purchase_order_lines" ADD COLUMN     "base_quantity" DECIMAL(15,6),
ADD COLUMN     "batch_id" UUID,
ADD COLUMN     "conversion_factor" DECIMAL(15,6),
ADD COLUMN     "dimensions" JSONB,
ADD COLUMN     "entered_quantity" DECIMAL(15,6),
ADD COLUMN     "entered_unit_id" UUID,
ADD COLUMN     "modifiers" JSONB,
ADD COLUMN     "serial_ids" JSONB,
ADD COLUMN     "variant_id" UUID;

-- AlterTable
ALTER TABLE "purchase_return_lines" ADD COLUMN     "base_quantity" DECIMAL(15,6),
ADD COLUMN     "batch_id" UUID,
ADD COLUMN     "conversion_factor" DECIMAL(15,6),
ADD COLUMN     "dimensions" JSONB,
ADD COLUMN     "entered_quantity" DECIMAL(15,6),
ADD COLUMN     "entered_unit_id" UUID,
ADD COLUMN     "modifiers" JSONB,
ADD COLUMN     "serial_ids" JSONB,
ADD COLUMN     "variant_id" UUID;

-- AlterTable
ALTER TABLE "sales_invoice_lines" ADD COLUMN     "base_quantity" DECIMAL(15,6),
ADD COLUMN     "batch_id" UUID,
ADD COLUMN     "bundle_snapshot" JSONB,
ADD COLUMN     "conversion_factor" DECIMAL(15,6),
ADD COLUMN     "dimensions" JSONB,
ADD COLUMN     "entered_quantity" DECIMAL(15,6),
ADD COLUMN     "entered_unit_id" UUID,
ADD COLUMN     "modifier_snapshot" JSONB,
ADD COLUMN     "modifiers" JSONB,
ADD COLUMN     "serial_ids" JSONB,
ADD COLUMN     "variant_id" UUID,
ADD COLUMN     "warranty_snapshot" JSONB;

-- AlterTable
ALTER TABLE "sales_order_lines" ADD COLUMN     "base_quantity" DECIMAL(15,6),
ADD COLUMN     "batch_id" UUID,
ADD COLUMN     "conversion_factor" DECIMAL(15,6),
ADD COLUMN     "dimensions" JSONB,
ADD COLUMN     "entered_quantity" DECIMAL(15,6),
ADD COLUMN     "entered_unit_id" UUID,
ADD COLUMN     "modifiers" JSONB,
ADD COLUMN     "serial_ids" JSONB,
ADD COLUMN     "variant_id" UUID;

-- AlterTable
ALTER TABLE "sales_quotation_lines" ADD COLUMN     "base_quantity" DECIMAL(15,6),
ADD COLUMN     "batch_id" UUID,
ADD COLUMN     "conversion_factor" DECIMAL(15,6),
ADD COLUMN     "dimensions" JSONB,
ADD COLUMN     "entered_quantity" DECIMAL(15,6),
ADD COLUMN     "entered_unit_id" UUID,
ADD COLUMN     "modifiers" JSONB,
ADD COLUMN     "serial_ids" JSONB,
ADD COLUMN     "variant_id" UUID;

-- AlterTable
ALTER TABLE "sales_return_lines" ADD COLUMN     "base_quantity" DECIMAL(15,6),
ADD COLUMN     "batch_id" UUID,
ADD COLUMN     "conversion_factor" DECIMAL(15,6),
ADD COLUMN     "dimensions" JSONB,
ADD COLUMN     "entered_quantity" DECIMAL(15,6),
ADD COLUMN     "entered_unit_id" UUID,
ADD COLUMN     "modifiers" JSONB,
ADD COLUMN     "serial_ids" JSONB,
ADD COLUMN     "variant_id" UUID;

-- AlterTable
ALTER TABLE "stock_balance_projection" ADD COLUMN     "batch_id" UUID,
ADD COLUMN     "variant_id" UUID;

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "batch_id" UUID,
ADD COLUMN     "serial_id" UUID,
ADD COLUMN     "variant_id" UUID;

-- CreateTable
CREATE TABLE "retail_capability_settings" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "variants_enabled" BOOLEAN NOT NULL DEFAULT false,
    "multi_unit_enabled" BOOLEAN NOT NULL DEFAULT false,
    "weight_enabled" BOOLEAN NOT NULL DEFAULT false,
    "length_enabled" BOOLEAN NOT NULL DEFAULT false,
    "area_enabled" BOOLEAN NOT NULL DEFAULT false,
    "batch_enabled" BOOLEAN NOT NULL DEFAULT false,
    "serial_enabled" BOOLEAN NOT NULL DEFAULT false,
    "images_enabled" BOOLEAN NOT NULL DEFAULT false,
    "services_enabled" BOOLEAN NOT NULL DEFAULT false,
    "bundles_enabled" BOOLEAN NOT NULL DEFAULT false,
    "modifiers_enabled" BOOLEAN NOT NULL DEFAULT false,
    "compatibility_enabled" BOOLEAN NOT NULL DEFAULT false,
    "advanced_pricing" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "retail_capability_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_variants" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "sku" VARCHAR(100),
    "barcode" VARCHAR(100),
    "attributes" JSONB NOT NULL,
    "purchase_rate" DECIMAL(15,6),
    "mrp" DECIMAL(15,6),
    "default_sale_rate" DECIMAL(15,6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "item_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_unit_conversions" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "from_unit_id" UUID NOT NULL,
    "to_unit_id" UUID NOT NULL,
    "conversion_factor" DECIMAL(15,6) NOT NULL,

    CONSTRAINT "item_unit_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_batches" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "batch_number" VARCHAR(100) NOT NULL,
    "manufacturing_date" DATE,
    "expiry_date" DATE,
    "mrp" DECIMAL(15,6),
    "purchase_rate" DECIMAL(15,6),

    CONSTRAINT "item_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_serials" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "serial_number" VARCHAR(100) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE',
    "warranty_start" DATE,
    "warranty_end" DATE,
    "sold_to_id" UUID,
    "sales_invoice_id" UUID,

    CONSTRAINT "item_serials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_bundle_components" (
    "id" UUID NOT NULL,
    "bundle_item_id" UUID NOT NULL,
    "component_item_id" UUID NOT NULL,
    "quantity" DECIMAL(15,6) NOT NULL,

    CONSTRAINT "item_bundle_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_modifier_groups" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "min_select" INTEGER NOT NULL DEFAULT 0,
    "max_select" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "item_modifier_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_modifier_options" (
    "id" UUID NOT NULL,
    "modifier_group_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "price_delta" DECIMAL(15,6) NOT NULL DEFAULT 0,

    CONSTRAINT "item_modifier_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_option_definitions" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "values" JSONB NOT NULL,

    CONSTRAINT "variant_option_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serial_allocations" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "serial_id" UUID NOT NULL,
    "source_document_type" VARCHAR(100) NOT NULL,
    "source_document_id" UUID NOT NULL,
    "source_line_id" UUID NOT NULL,

    CONSTRAINT "serial_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "retail_capability_settings_company_id_key" ON "retail_capability_settings"("company_id");

-- CreateIndex
CREATE INDEX "item_variants_item_id_idx" ON "item_variants"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_unit_conversions_item_id_from_unit_id_to_unit_id_key" ON "item_unit_conversions"("item_id", "from_unit_id", "to_unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_batches_item_id_batch_number_key" ON "item_batches"("item_id", "batch_number");

-- CreateIndex
CREATE UNIQUE INDEX "item_serials_item_id_serial_number_key" ON "item_serials"("item_id", "serial_number");

-- CreateIndex
CREATE UNIQUE INDEX "variant_option_definitions_company_id_name_key" ON "variant_option_definitions"("company_id", "name");

-- CreateIndex
CREATE INDEX "serial_allocations_source_document_type_source_document_id_idx" ON "serial_allocations"("source_document_type", "source_document_id");

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_entered_unit_id_fkey" FOREIGN KEY ("entered_unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "item_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_entered_unit_id_fkey" FOREIGN KEY ("entered_unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "item_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_entered_unit_id_fkey" FOREIGN KEY ("entered_unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "item_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "purchase_return_lines_entered_unit_id_fkey" FOREIGN KEY ("entered_unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "purchase_return_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "purchase_return_lines_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "item_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "item_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_serial_id_fkey" FOREIGN KEY ("serial_id") REFERENCES "item_serials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balance_projection" ADD CONSTRAINT "stock_balance_projection_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balance_projection" ADD CONSTRAINT "stock_balance_projection_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "item_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotation_lines" ADD CONSTRAINT "sales_quotation_lines_entered_unit_id_fkey" FOREIGN KEY ("entered_unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotation_lines" ADD CONSTRAINT "sales_quotation_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotation_lines" ADD CONSTRAINT "sales_quotation_lines_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "item_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_entered_unit_id_fkey" FOREIGN KEY ("entered_unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "item_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_challan_lines" ADD CONSTRAINT "delivery_challan_lines_entered_unit_id_fkey" FOREIGN KEY ("entered_unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_challan_lines" ADD CONSTRAINT "delivery_challan_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_challan_lines" ADD CONSTRAINT "delivery_challan_lines_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "item_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_entered_unit_id_fkey" FOREIGN KEY ("entered_unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "item_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_entered_unit_id_fkey" FOREIGN KEY ("entered_unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "item_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_held_bill_lines" ADD CONSTRAINT "pos_held_bill_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_held_bill_lines" ADD CONSTRAINT "pos_held_bill_lines_entered_unit_id_fkey" FOREIGN KEY ("entered_unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_held_bill_lines" ADD CONSTRAINT "pos_held_bill_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_held_bill_lines" ADD CONSTRAINT "pos_held_bill_lines_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "item_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retail_capability_settings" ADD CONSTRAINT "retail_capability_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_variants" ADD CONSTRAINT "item_variants_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_unit_conversions" ADD CONSTRAINT "item_unit_conversions_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_unit_conversions" ADD CONSTRAINT "item_unit_conversions_from_unit_id_fkey" FOREIGN KEY ("from_unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_unit_conversions" ADD CONSTRAINT "item_unit_conversions_to_unit_id_fkey" FOREIGN KEY ("to_unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_batches" ADD CONSTRAINT "item_batches_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_serials" ADD CONSTRAINT "item_serials_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_serials" ADD CONSTRAINT "item_serials_sold_to_id_fkey" FOREIGN KEY ("sold_to_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_serials" ADD CONSTRAINT "item_serials_sales_invoice_id_fkey" FOREIGN KEY ("sales_invoice_id") REFERENCES "sales_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_bundle_components" ADD CONSTRAINT "item_bundle_components_bundle_item_id_fkey" FOREIGN KEY ("bundle_item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_bundle_components" ADD CONSTRAINT "item_bundle_components_component_item_id_fkey" FOREIGN KEY ("component_item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_modifier_groups" ADD CONSTRAINT "item_modifier_groups_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_modifier_options" ADD CONSTRAINT "item_modifier_options_modifier_group_id_fkey" FOREIGN KEY ("modifier_group_id") REFERENCES "item_modifier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_option_definitions" ADD CONSTRAINT "variant_option_definitions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serial_allocations" ADD CONSTRAINT "serial_allocations_serial_id_fkey" FOREIGN KEY ("serial_id") REFERENCES "item_serials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serial_allocations" ADD CONSTRAINT "serial_allocations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serial_allocations" ADD CONSTRAINT "fk_sil_sa" FOREIGN KEY ("source_line_id") REFERENCES "sales_invoice_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Add partial unique constraints for StockBalanceProjection
CREATE UNIQUE INDEX uix_sbp_standard ON stock_balance_projection (item_id, godown_id) WHERE variant_id IS NULL AND batch_id IS NULL;
CREATE UNIQUE INDEX uix_sbp_variant ON stock_balance_projection (item_id, godown_id, variant_id) WHERE variant_id IS NOT NULL AND batch_id IS NULL;
CREATE UNIQUE INDEX uix_sbp_batch ON stock_balance_projection (item_id, godown_id, batch_id) WHERE variant_id IS NULL AND batch_id IS NOT NULL;
CREATE UNIQUE INDEX uix_sbp_variant_batch ON stock_balance_projection (item_id, godown_id, variant_id, batch_id) WHERE variant_id IS NOT NULL AND batch_id IS NOT NULL;
