ALTER TABLE goods_receipt_lines ADD COLUMN acquisition_cost_rate DECIMAL(24,12);
ALTER TABLE purchase_invoice_lines ADD COLUMN entered_purchase_rate DECIMAL(24,12), ADD COLUMN landed_cost_allocation DECIMAL(24,12);
