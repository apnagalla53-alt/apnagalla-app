-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_verified_at" TIMESTAMPTZ,
ADD COLUMN     "google_subject" VARCHAR(255),
ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "password_changed_at" TIMESTAMPTZ,
ADD COLUMN     "temporary_password_expires_at" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "purpose" VARCHAR(32) NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "pending_email" VARCHAR(255),
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "privacy_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(32) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    "note" VARCHAR(2000),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ,

    CONSTRAINT "privacy_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_token_hash_key" ON "auth_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "auth_tokens_user_id_purpose_idx" ON "auth_tokens"("user_id", "purpose");

-- CreateIndex
CREATE INDEX "auth_tokens_expires_at_idx" ON "auth_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "privacy_requests_organization_id_created_at_idx" ON "privacy_requests"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "privacy_requests_user_id_status_idx" ON "privacy_requests"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_subject_key" ON "users"("google_subject");

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

