-- CreateTable
CREATE TABLE "features" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_features" (
    "plan_id" UUID NOT NULL,
    "feature_id" UUID NOT NULL,

    CONSTRAINT "plan_features_pkey" PRIMARY KEY ("plan_id","feature_id")
);

-- CreateTable
CREATE TABLE "tenant_entitlements" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "feature_id" UUID NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "features_code_key" ON "features"("code");

-- CreateIndex
CREATE UNIQUE INDEX "uix_tenant_entitlements" ON "tenant_entitlements"("organization_id", "feature_id");

-- AddForeignKey
ALTER TABLE "plan_features" ADD CONSTRAINT "plan_features_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_features" ADD CONSTRAINT "plan_features_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "features"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_entitlements" ADD CONSTRAINT "tenant_entitlements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_entitlements" ADD CONSTRAINT "tenant_entitlements_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "features"("id") ON DELETE CASCADE ON UPDATE CASCADE;
