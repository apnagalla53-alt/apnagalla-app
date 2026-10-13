-- AlterTable
ALTER TABLE "features" ADD COLUMN     "beta_tenants" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "rollout_mode" VARCHAR(20) NOT NULL DEFAULT 'ON',
ADD COLUMN     "rollout_percent" INTEGER NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "business_type" VARCHAR(100),
ADD COLUMN     "internal_notes" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "limit_overrides" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "limits" JSONB NOT NULL DEFAULT '{"users":5,"devices":5,"branches":1,"storage_mb":100}',
ADD COLUMN     "monthly_price" DECIMAL(15,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "platform_sessions" ADD COLUMN     "last_active_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "platform_users" ADD COLUMN     "last_active_at" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "last_active_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_active_at" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "tenant_subscriptions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "start_date" TIMESTAMPTZ NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "complimentary" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tenant_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_payments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "tax" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "status" VARCHAR(30) NOT NULL,
    "method" VARCHAR(30) NOT NULL,
    "reference" VARCHAR(255),
    "period_months" INTEGER NOT NULL DEFAULT 1,
    "plan_name" VARCHAR(255) NOT NULL,
    "paid_at" TIMESTAMPTZ NOT NULL,
    "refund_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "refund_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_expenses" (
    "id" UUID NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "expense_date" DATE NOT NULL,
    "method" VARCHAR(30) NOT NULL,
    "reference" VARCHAR(255),
    "note" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_backups" (
    "id" UUID NOT NULL,
    "environment" VARCHAR(50) NOT NULL,
    "type" VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    "status" VARCHAR(30) NOT NULL,
    "storage_key" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL DEFAULT 0,
    "verified_at" TIMESTAMPTZ,
    "error" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_backups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_support_sessions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "platform_user_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "ended_at" TIMESTAMPTZ,

    CONSTRAINT "platform_support_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_announcements" (
    "id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "audience" VARCHAR(30) NOT NULL,
    "tenant_ids" JSONB NOT NULL DEFAULT '[]',
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID NOT NULL,

    CONSTRAINT "platform_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_subscriptions_organization_id_key" ON "tenant_subscriptions"("organization_id");

-- CreateIndex
CREATE INDEX "subscription_payments_organization_id_paid_at_idx" ON "subscription_payments"("organization_id", "paid_at");

-- AddForeignKey
ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_support_sessions" ADD CONSTRAINT "platform_support_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
