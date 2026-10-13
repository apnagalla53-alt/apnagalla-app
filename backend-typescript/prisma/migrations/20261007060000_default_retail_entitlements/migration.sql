-- Upgrade the legacy bootstrap plan once. Do not undo an intentional Platform plan edit.
-- Tenant overrides and global rollout settings remain authoritative.
INSERT INTO features (id, code, name, created_at, updated_at)
SELECT gen_random_uuid(), seed.code, seed.name, now(), now()
FROM (VALUES
  ('RETAIL_POS','Retail POS'), ('KHATA','Khata'), ('PURCHASING','Purchases'),
  ('EXPENSES','Expenses'), ('REPORTS','Reports'), ('INVENTORY','Inventory'),
  ('SALES','Sales'), ('ACCOUNTING','Accounting')
) AS seed(code,name)
ON CONFLICT (code) DO NOTHING;

INSERT INTO plan_features (plan_id, feature_id)
SELECT p.id, f.id
FROM plans p CROSS JOIN features f
WHERE p.code = 'DEFAULT'
  AND f.code IN ('RETAIL_POS','KHATA','PURCHASING','EXPENSES','REPORTS','INVENTORY','SALES','ACCOUNTING')
  AND NOT EXISTS (
    SELECT 1 FROM platform_audit_logs a
    WHERE a.resource_id = p.id AND a.action = 'PLAN_UPDATE'
  )
ON CONFLICT (plan_id,feature_id) DO NOTHING;
