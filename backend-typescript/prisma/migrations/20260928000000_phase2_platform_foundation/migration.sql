-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "invoice_footer" TEXT,
ADD COLUMN     "logo_url" VARCHAR(512),
ADD COLUMN     "plan_id" UUID,
ADD COLUMN     "primary_color" VARCHAR(7),
ADD COLUMN     "status" "TenantStatus" NOT NULL DEFAULT 'TRIAL';

-- CreateTable
CREATE TABLE "platform_users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "password_hash" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_roles" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "system_role" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "platform_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(255) NOT NULL,
    "module" VARCHAR(50) NOT NULL,
    "resource" VARCHAR(100) NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "description" TEXT,

    CONSTRAINT "platform_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,

    CONSTRAINT "platform_user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "platform_role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "platform_role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "platform_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" VARCHAR(255),
    "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(512),

    CONSTRAINT "platform_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "resource_type" VARCHAR(100),
    "resource_id" UUID,
    "details" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_invitations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "accepted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "owner_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_users_username_key" ON "platform_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "platform_roles_name_key" ON "platform_roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "platform_permissions_code_key" ON "platform_permissions"("code");

-- CreateIndex
CREATE INDEX "platform_audit_logs_resource_type_resource_id_idx" ON "platform_audit_logs"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "platform_audit_logs_created_at_idx" ON "platform_audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE UNIQUE INDEX "owner_invitations_token_hash_key" ON "owner_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "ix_organizations_status" ON "organizations"("status");

-- AddForeignKey
ALTER TABLE "platform_user_roles" ADD CONSTRAINT "platform_user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_user_roles" ADD CONSTRAINT "platform_user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "platform_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_role_permissions" ADD CONSTRAINT "platform_role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "platform_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_role_permissions" ADD CONSTRAINT "platform_role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "platform_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_sessions" ADD CONSTRAINT "platform_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_audit_logs" ADD CONSTRAINT "platform_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_invitations" ADD CONSTRAINT "owner_invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
