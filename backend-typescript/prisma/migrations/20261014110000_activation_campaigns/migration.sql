CREATE TABLE activation_campaigns (
 id UUID PRIMARY KEY,
 code VARCHAR(40) NOT NULL UNIQUE,
 name VARCHAR(200) NOT NULL,
 enabled BOOLEAN NOT NULL DEFAULT false,
 plan_code VARCHAR(20) NOT NULL,
 trial_days INTEGER NOT NULL CHECK (trial_days BETWEEN 1 AND 60),
 max_redemptions INTEGER CHECK (max_redemptions > 0),
 starts_at TIMESTAMPTZ NOT NULL,
 ends_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL,
 CHECK (plan_code IN ('STARTER','SMART','PRO')),
 CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE TABLE activation_redemptions (
 id UUID PRIMARY KEY,
 campaign_id UUID NOT NULL REFERENCES activation_campaigns(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 user_id UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
 organization_id UUID UNIQUE REFERENCES organizations(id) ON DELETE SET NULL ON UPDATE CASCADE,
 plan_code VARCHAR(20) NOT NULL,
 trial_days INTEGER NOT NULL,
 redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX activation_redemptions_campaign_id_idx ON activation_redemptions(campaign_id);
-- Campaign metadata and redemptions are reachable only through authorized services.
ALTER TABLE activation_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE activation_campaigns FORCE ROW LEVEL SECURITY;
CREATE POLICY activation_system_scope ON activation_campaigns
 USING (current_setting('app.security_scope',true) = 'system')
 WITH CHECK (current_setting('app.security_scope',true) = 'system');
ALTER TABLE activation_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activation_redemptions FORCE ROW LEVEL SECURITY;
CREATE POLICY activation_system_scope ON activation_redemptions
 USING (current_setting('app.security_scope',true) = 'system')
 WITH CHECK (current_setting('app.security_scope',true) = 'system');
