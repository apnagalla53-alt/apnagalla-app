ALTER TABLE "platform_users"
  ADD COLUMN "mfa_secret_encrypted" TEXT,
  ADD COLUMN "mfa_enabled_at" TIMESTAMPTZ,
  ADD COLUMN "mfa_last_counter" BIGINT,
  ADD COLUMN "mfa_recovery_hashes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "platform_mfa_challenges" (
 "id" UUID NOT NULL,
 "user_id" UUID NOT NULL,
 "purpose" VARCHAR(10) NOT NULL,
 "secret_encrypted" TEXT,
 "device_id" UUID,
 "ip_address" VARCHAR(45),
 "user_agent" VARCHAR(512),
 "expires_at" TIMESTAMPTZ NOT NULL,
 "used_at" TIMESTAMPTZ,
 "attempts" INTEGER NOT NULL DEFAULT 0,
 "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "platform_mfa_challenges_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "platform_mfa_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform_users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "platform_mfa_challenges_user_id_created_at_idx" ON "platform_mfa_challenges"("user_id","created_at");
CREATE INDEX "platform_mfa_challenges_expires_at_idx" ON "platform_mfa_challenges"("expires_at");
CREATE TABLE "security_rate_windows" (
 "key" VARCHAR(100) NOT NULL,
 "count" INTEGER NOT NULL DEFAULT 0,
 "expires_at" TIMESTAMPTZ NOT NULL,
 CONSTRAINT "security_rate_windows_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "security_rate_windows_expires_at_idx" ON "security_rate_windows"("expires_at");

-- API middleware begins unverified; validated guards select a company or a
-- trusted Platform scope. SET LOCAL is applied inside every Prisma transaction.
-- Identity membership and multi-company identity auditing remain explicit API
-- boundaries; they are not business-data tables governed by a single company.
DO $$
DECLARE row RECORD; policy_expression TEXT;
BEGIN
 FOR row IN SELECT table_name FROM information_schema.columns
   WHERE table_schema='public' AND column_name='company_id'
     AND table_name NOT IN ('user_roles','audit_logs')
 LOOP
   EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',row.table_name);
   EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',row.table_name);
   policy_expression := 'current_setting(''app.security_scope'',true) = ''system'' OR company_id::text = NULLIF(current_setting(''app.company_id'',true),'''')';
   EXECUTE format('CREATE POLICY evolix_company_scope ON %I USING (%s) WITH CHECK (%s)',row.table_name,policy_expression,policy_expression);
 END LOOP;
END $$;

-- Child rows are scoped through their owned parents. Iterate for chains such
-- as item -> modifier group -> option. Combine parent checks with AND.
DO $$
DECLARE child RECORD; relation RECORD; expression TEXT; round INTEGER; changed INTEGER;
BEGIN
 FOR round IN 1..8 LOOP
  changed:=0;
  FOR child IN SELECT c.oid,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity AND c.relname NOT IN ('user_roles','audit_logs')
  LOOP
   expression:='';
   FOR relation IN SELECT parent.relname AS parent_name,ca.attname AS child_column,pa.attname AS parent_column
    FROM pg_constraint k JOIN pg_class parent ON parent.oid=k.confrelid
    JOIN pg_attribute ca ON ca.attrelid=k.conrelid AND ca.attnum=k.conkey[1]
    JOIN pg_attribute pa ON pa.attrelid=k.confrelid AND pa.attnum=k.confkey[1]
    WHERE k.contype='f' AND k.conrelid=child.oid AND array_length(k.conkey,1)=1 AND parent.relrowsecurity
   LOOP
    expression:=expression||CASE WHEN expression='' THEN '' ELSE ' AND ' END||
      format('(%I IS NULL OR EXISTS (SELECT 1 FROM %I p WHERE p.%I = %I.%I))',relation.child_column,relation.parent_name,relation.parent_column,child.relname,relation.child_column);
   END LOOP;
   IF expression<>'' THEN
    expression:='current_setting(''app.security_scope'',true) = ''system'' OR (current_setting(''app.security_scope'',true) = ''tenant'' AND '||expression||')';
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',child.relname);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',child.relname);
    EXECUTE format('CREATE POLICY evolix_company_scope ON %I USING (%s) WITH CHECK (%s)',child.relname,expression,expression);
    changed:=changed+1;
   END IF;
  END LOOP;
  EXIT WHEN changed=0;
 END LOOP;
END $$;
