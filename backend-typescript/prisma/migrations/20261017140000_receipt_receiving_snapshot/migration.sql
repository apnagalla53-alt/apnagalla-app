-- Nullable, immutable receiving details for new customer collections.
-- Existing receipts stay unassigned; their receiving bank cannot be inferred.
ALTER TABLE "vouchers" ADD COLUMN "receiving_snapshot" JSONB;
