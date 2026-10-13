ALTER TABLE item_serials ADD COLUMN company_id UUID, ADD COLUMN godown_id UUID,
 ADD COLUMN variant_id UUID, ADD COLUMN batch_id UUID, ADD COLUMN received_date DATE,
 ADD COLUMN receipt_document_id UUID;
UPDATE item_serials s SET company_id = i.company_id FROM items i WHERE i.id = s.item_id;
ALTER TABLE item_serials ALTER COLUMN company_id SET NOT NULL;
CREATE UNIQUE INDEX uix_company_serial_number ON item_serials(company_id, serial_number);
CREATE INDEX item_serials_company_id_godown_id_status_idx ON item_serials(company_id, godown_id, status);
ALTER TABLE serial_allocations ADD COLUMN warranty_snapshot JSONB,
 ADD COLUMN returned_at TIMESTAMP(3), ADD COLUMN return_document_id UUID;
