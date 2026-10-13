-- Additive shop preferences: separate from platform entitlement overrides.
ALTER TABLE "company_configurations" ADD COLUMN "shop_feature_settings" JSONB NOT NULL DEFAULT '{}';
