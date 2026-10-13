-- AlterTable
ALTER TABLE "items" ADD COLUMN     "category" VARCHAR(100),
ADD COLUMN     "hsn_sac" VARCHAR(50),
ADD COLUMN     "is_system" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "low_stock_threshold" DECIMAL(15,6) NOT NULL DEFAULT 0,
ADD COLUMN     "preferred_supplier_id" UUID;

-- AlterTable
ALTER TABLE "need_lists" ADD COLUMN     "expected_price" DECIMAL(15,6);

-- AlterTable
ALTER TABLE "parties" ADD COLUMN     "address" TEXT,
ADD COLUMN     "credit_allowed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "email" VARCHAR(255),
ADD COLUMN     "max_credit_bills" INTEGER,
ADD COLUMN     "nickname" VARCHAR(100),
ADD COLUMN     "phone" VARCHAR(50),
ADD COLUMN     "state" VARCHAR(100),
ADD COLUMN     "supplier_category" VARCHAR(30) NOT NULL DEFAULT 'REGULAR';

-- AlterTable
ALTER TABLE "purchase_invoices" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "payment_snapshot" JSONB,
ADD COLUMN     "purchase_category" VARCHAR(30) NOT NULL DEFAULT 'REGULAR';

-- AlterTable
ALTER TABLE "sales_invoices" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "payment_snapshot" JSONB,
ADD COLUMN     "sales_channel" VARCHAR(30) NOT NULL DEFAULT 'COUNTER';

-- AlterTable
ALTER TABLE "vouchers" ADD COLUMN     "payment_method" VARCHAR(20);

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_preferred_supplier_id_fkey" FOREIGN KEY ("preferred_supplier_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
