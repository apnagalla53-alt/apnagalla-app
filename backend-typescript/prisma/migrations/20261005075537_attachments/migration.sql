/*
  Warnings:

  - You are about to drop the column `photo_attachment_url` on the `need_lists` table. All the data in the column will be lost.
  - You are about to drop the column `photo_attachment_url` on the `purchase_invoices` table. All the data in the column will be lost.
  - You are about to drop the column `photo_attachment_url` on the `vouchers` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "need_lists" DROP COLUMN "photo_attachment_url";

-- AlterTable
ALTER TABLE "purchase_invoices" DROP COLUMN "photo_attachment_url";

-- AlterTable
ALTER TABLE "vouchers" DROP COLUMN "photo_attachment_url";

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" UUID NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "original_file_name" VARCHAR(255) NOT NULL,
    "stored_file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_provider" VARCHAR(50) NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attachments_company_id_entity_type_entity_id_idx" ON "attachments"("company_id", "entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
