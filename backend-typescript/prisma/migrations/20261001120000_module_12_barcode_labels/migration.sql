-- CreateTable
CREATE TABLE "item_barcodes" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "barcode" VARCHAR(100) NOT NULL,
    "barcode_type" VARCHAR(50) NOT NULL DEFAULT 'CODE128',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "item_barcodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "label_templates" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "template_type" VARCHAR(50) NOT NULL DEFAULT 'PRODUCT',
    "paper_type" VARCHAR(50) NOT NULL DEFAULT 'ROLL',
    "width_mm" DECIMAL(8,2) NOT NULL DEFAULT 50,
    "height_mm" DECIMAL(8,2) NOT NULL DEFAULT 25,
    "columns" INTEGER NOT NULL DEFAULT 1,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "config_json" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "label_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_barcodes_company_id_barcode_is_active_idx" ON "item_barcodes"("company_id", "barcode", "is_active");

-- CreateIndex
CREATE INDEX "item_barcodes_item_id_idx" ON "item_barcodes"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_barcodes_company_id_barcode_key" ON "item_barcodes"("company_id", "barcode");

-- CreateIndex
CREATE INDEX "label_templates_company_id_template_type_idx" ON "label_templates"("company_id", "template_type");

-- AddForeignKey
ALTER TABLE "item_barcodes" ADD CONSTRAINT "item_barcodes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_barcodes" ADD CONSTRAINT "item_barcodes_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "label_templates" ADD CONSTRAINT "label_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
