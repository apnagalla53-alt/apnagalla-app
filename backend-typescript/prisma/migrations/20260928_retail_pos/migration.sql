-- AlterTable
ALTER TABLE "parties" ADD COLUMN "is_walkin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "sales_invoices" ADD COLUMN "is_pos" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sales_invoices" ADD COLUMN "walkin_name" VARCHAR(255);
ALTER TABLE "sales_invoices" ADD COLUMN "walkin_phone" VARCHAR(50);
