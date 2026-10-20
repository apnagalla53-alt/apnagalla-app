-- business_type remains the authoritative primary. Existing shops need no backfill or onboarding.
ALTER TABLE organizations ADD COLUMN additional_business_types TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE item_brands (
  id UUID NOT NULL,
  company_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  normalized_name VARCHAR(100) NOT NULL,
  CONSTRAINT item_brands_pkey PRIMARY KEY (id),
  CONSTRAINT item_brands_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX item_brands_company_id_normalized_name_key ON item_brands(company_id, normalized_name);
CREATE UNIQUE INDEX item_brands_id_company_id_key ON item_brands(id, company_id);
ALTER TABLE items ADD COLUMN brand_id UUID;
ALTER TABLE items ADD CONSTRAINT items_brand_id_company_id_fkey FOREIGN KEY (brand_id, company_id) REFERENCES item_brands(id, company_id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE item_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_brands FORCE ROW LEVEL SECURITY;
CREATE POLICY evolix_company_scope ON item_brands
  USING (current_setting('app.security_scope',true) = 'system' OR company_id::text = NULLIF(current_setting('app.company_id',true),''))
  WITH CHECK (current_setting('app.security_scope',true) = 'system' OR company_id::text = NULLIF(current_setting('app.company_id',true),''));
-- Runtime grants must be applied using the existing deployment grant procedure.
