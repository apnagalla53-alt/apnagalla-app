-- CreateTable
CREATE TABLE "sales_invoice_line_batch_allocations" (
    "id" UUID NOT NULL,
    "sales_invoice_line_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "quantity" DECIMAL(15,6) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_invoice_line_batch_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_return_line_batch_allocations" (
    "id" UUID NOT NULL,
    "sales_return_line_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "quantity" DECIMAL(15,6) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_return_line_batch_allocations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "sales_invoice_line_batch_allocations" ADD CONSTRAINT "sales_invoice_line_batch_allocations_sales_invoice_line_id_fkey" FOREIGN KEY ("sales_invoice_line_id") REFERENCES "sales_invoice_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_line_batch_allocations" ADD CONSTRAINT "sales_invoice_line_batch_allocations_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "item_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_line_batch_allocations" ADD CONSTRAINT "sales_return_line_batch_allocations_sales_return_line_id_fkey" FOREIGN KEY ("sales_return_line_id") REFERENCES "sales_return_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_line_batch_allocations" ADD CONSTRAINT "sales_return_line_batch_allocations_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "item_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
