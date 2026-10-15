-- Optional item-master selling price for a configured sellable pack.
-- Null retains the base-price conversion fallback. Existing factors/documents are unchanged.
ALTER TABLE "item_unit_conversions" ADD COLUMN "selling_price" DECIMAL(15,6);
ALTER TABLE "item_unit_conversions" ADD CONSTRAINT "item_unit_selling_price_nonnegative" CHECK ("selling_price" IS NULL OR "selling_price" >= 0);
