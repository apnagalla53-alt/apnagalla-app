ALTER TABLE company_configurations ADD COLUMN payment_configuration JSONB;
CREATE TABLE request_idempotency (
 id UUID PRIMARY KEY, company_id UUID NOT NULL, key VARCHAR(100) NOT NULL,
 fingerprint VARCHAR(64) NOT NULL, user_id UUID NOT NULL, response JSONB NOT NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT request_idempotency_company_id_key_key UNIQUE(company_id,key)
);
CREATE TABLE daily_cash_counts (
 id UUID PRIMARY KEY, company_id UUID NOT NULL, branch_id UUID NOT NULL, date DATE NOT NULL,
 opening_cash DECIMAL(15,2), actual_cash DECIMAL(15,2), note VARCHAR(1000), updated_by UUID NOT NULL,
 updated_at TIMESTAMP(3) NOT NULL,
 CONSTRAINT daily_cash_counts_company_id_branch_id_date_key UNIQUE(company_id,branch_id,date)
);
CREATE INDEX ix_sales_company_branch_date ON sales_invoices(company_id,branch_id,document_date);
CREATE INDEX ix_purchase_company_branch_date ON purchase_invoices(company_id,branch_id,document_date);
CREATE INDEX ix_stock_company_location_item ON stock_balance_projection(company_id,branch_id,godown_id,item_id,variant_id,batch_id);
CREATE INDEX ix_bill_alloc_company_party_ref ON bill_allocations(company_id,party_id,reference_document_id);
CREATE INDEX ix_party_company_type_name ON parties(company_id,party_type,name);
CREATE UNIQUE INDEX uix_items_company_sku ON items(company_id,sku);
CREATE UNIQUE INDEX uix_parties_company_code ON parties(company_id,code);
