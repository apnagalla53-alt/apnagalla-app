-- Additive migration. Legacy sales remain NULL/unknown; no price backfill.
CREATE TABLE inventory_cost_states (
 id UUID PRIMARY KEY, company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
 item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
 variant_key VARCHAR(40) NOT NULL,
 quantity DECIMAL(24,12) NOT NULL DEFAULT 0,
 unknown_quantity DECIMAL(24,12) NOT NULL DEFAULT 0,
 known_value DECIMAL(24,12) NOT NULL DEFAULT 0,
 updated_at TIMESTAMPTZ NOT NULL,
 CONSTRAINT inventory_cost_nonnegative CHECK(quantity >= 0 AND unknown_quantity >= 0 AND unknown_quantity <= quantity AND known_value >= 0)
);
CREATE UNIQUE INDEX inventory_cost_states_company_id_item_id_variant_key_key ON inventory_cost_states(company_id,item_id,variant_key);
CREATE INDEX inventory_cost_states_company_id_item_id_idx ON inventory_cost_states(company_id,item_id);
ALTER TABLE stock_movements ADD COLUMN cost_status VARCHAR(20), ADD COLUMN unknown_quantity_delta DECIMAL(24,12), ADD COLUMN cost_line_id UUID;
ALTER TABLE stock_movements ALTER COLUMN value_delta TYPE DECIMAL(24,12), ALTER COLUMN cost_rate TYPE DECIMAL(24,12);
CREATE INDEX stock_movements_company_id_source_document_id_cost_line_id_idx ON stock_movements(company_id,source_document_id,cost_line_id);
ALTER TABLE sales_invoice_lines ADD COLUMN cost_status VARCHAR(20), ADD COLUMN cogs_total DECIMAL(24,12), ADD COLUMN cost_per_base_unit DECIMAL(24,12), ADD COLUMN net_revenue DECIMAL(24,12), ADD COLUMN gross_profit DECIMAL(24,12), ADD COLUMN cost_snapshot JSONB;
ALTER TABLE sales_return_lines ADD COLUMN cost_status VARCHAR(20), ADD COLUMN cogs_total DECIMAL(24,12), ADD COLUMN cost_per_base_unit DECIMAL(24,12), ADD COLUMN net_revenue DECIMAL(24,12), ADD COLUMN gross_profit DECIMAL(24,12), ADD COLUMN cost_snapshot JSONB;
ALTER TABLE purchase_invoice_lines ADD COLUMN effective_inventory_cost DECIMAL(24,12), ADD COLUMN base_unit_cost_snapshot DECIMAL(24,12);
ALTER TABLE opening_stock_lines ALTER COLUMN cost_rate DROP NOT NULL, ALTER COLUMN cost_rate DROP DEFAULT;
