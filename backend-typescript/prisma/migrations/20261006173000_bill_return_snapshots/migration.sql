-- AlterTable
ALTER TABLE "pos_held_bills" ADD COLUMN     "customer_id" UUID,
ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "sales_return_lines" ADD COLUMN     "original_line_id" UUID;
