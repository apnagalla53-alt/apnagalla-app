-- AlterEnum
ALTER TYPE "TenantStatus" ADD VALUE 'ARCHIVED';

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "archive_previous_status" VARCHAR(30),
ADD COLUMN     "archived_at" TIMESTAMPTZ,
ADD COLUMN     "legal_hold" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "onboarding_data" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "onboarding_state" VARCHAR(40) NOT NULL DEFAULT 'READY',
ADD COLUMN     "password_login_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "phone_e164" VARCHAR(20),
ADD COLUMN     "phone_verified_at" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "mobile_otp_challenges" (
    "id" UUID NOT NULL,
    "phone_e164" VARCHAR(20) NOT NULL,
    "purpose" VARCHAR(20) NOT NULL,
    "user_id" UUID,
    "otp_hash" VARCHAR(64) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "used_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referral_code" VARCHAR(40),
    "terms_accepted_at" TIMESTAMPTZ,

    CONSTRAINT "mobile_otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_campaigns" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "reward_type" VARCHAR(30) NOT NULL DEFAULT 'TRACKING_ONLY',
    "reward_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "qualification" VARCHAR(30) NOT NULL DEFAULT 'PAID_SUBSCRIPTION',
    "active_days" INTEGER NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ,
    "rules" VARCHAR(4000) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "referral_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_codes" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "organization_id" UUID,
    "user_id" UUID,
    "campaign_id" UUID,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_attributions" (
    "id" UUID NOT NULL,
    "code_id" UUID NOT NULL,
    "campaign_id" UUID,
    "referred_user_id" UUID,
    "referred_organization_id" UUID,
    "selected_plan" VARCHAR(20),
    "status" VARCHAR(30) NOT NULL DEFAULT 'SIGNED_UP',
    "reward_status" VARCHAR(30) NOT NULL DEFAULT 'NONE',
    "campaign_snapshot" JSONB NOT NULL DEFAULT '{}',
    "fraud_flags" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "converted_at" TIMESTAMPTZ,
    "qualified_at" TIMESTAMPTZ,
    "rejected_reason" VARCHAR(2000),

    CONSTRAINT "referral_attributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_rewards" (
    "id" UUID NOT NULL,
    "attribution_id" UUID NOT NULL,
    "beneficiary_organization_id" UUID,
    "type" VARCHAR(30) NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "actor_id" UUID NOT NULL,
    "reference" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_deletion_jobs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'REQUESTED',
    "reason" VARCHAR(2000) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "counts" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ,
    "error_code" VARCHAR(100),

    CONSTRAINT "tenant_deletion_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mobile_otp_challenges_phone_e164_created_at_idx" ON "mobile_otp_challenges"("phone_e164", "created_at");

-- CreateIndex
CREATE INDEX "mobile_otp_challenges_expires_at_idx" ON "mobile_otp_challenges"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "referral_campaigns_code_key" ON "referral_campaigns"("code");

-- CreateIndex
CREATE UNIQUE INDEX "referral_codes_code_key" ON "referral_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "referral_codes_organization_id_key" ON "referral_codes"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "referral_attributions_referred_user_id_key" ON "referral_attributions"("referred_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "referral_attributions_referred_organization_id_key" ON "referral_attributions"("referred_organization_id");

-- CreateIndex
CREATE INDEX "referral_attributions_status_created_at_idx" ON "referral_attributions"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "referral_rewards_attribution_id_key" ON "referral_rewards"("attribution_id");

-- CreateIndex
CREATE INDEX "referral_rewards_beneficiary_organization_id_created_at_idx" ON "referral_rewards"("beneficiary_organization_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_deletion_jobs_organization_id_key" ON "tenant_deletion_jobs"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_e164_key" ON "users"("phone_e164");

-- AddForeignKey
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "referral_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_attributions" ADD CONSTRAINT "referral_attributions_code_id_fkey" FOREIGN KEY ("code_id") REFERENCES "referral_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_attributions" ADD CONSTRAINT "referral_attributions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "referral_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_attributions" ADD CONSTRAINT "referral_attributions_referred_user_id_fkey" FOREIGN KEY ("referred_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_attributions" ADD CONSTRAINT "referral_attributions_referred_organization_id_fkey" FOREIGN KEY ("referred_organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_attribution_id_fkey" FOREIGN KEY ("attribution_id") REFERENCES "referral_attributions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "retail_gst_invoices_company_id_financial_year_document_number_k" RENAME TO "retail_gst_invoices_company_id_financial_year_document_numb_key";

