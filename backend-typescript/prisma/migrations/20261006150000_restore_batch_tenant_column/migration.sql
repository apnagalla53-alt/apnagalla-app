-- Restore the existing Slice D tenant field omitted from its migrations.
ALTER TABLE "item_batches" ADD COLUMN "company_id" UUID;
UPDATE "item_batches" AS batch SET "company_id" = item."company_id"
FROM "items" AS item WHERE item."id" = batch."item_id";
ALTER TABLE "item_batches" ALTER COLUMN "company_id" SET NOT NULL;
CREATE INDEX "item_batches_company_id_idx" ON "item_batches"("company_id");
ALTER TABLE "item_batches" ADD CONSTRAINT "item_batches_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
