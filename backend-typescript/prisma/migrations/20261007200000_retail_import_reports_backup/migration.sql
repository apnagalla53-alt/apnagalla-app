-- DropForeignKey
ALTER TABLE "retail_calendar_tasks" DROP CONSTRAINT "retail_calendar_tasks_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "retail_calendar_tasks" DROP CONSTRAINT "retail_calendar_tasks_company_id_fkey";

-- CreateTable
CREATE TABLE "retail_import_jobs" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "financial_year_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "preset" VARCHAR(30) NOT NULL,
    "kind" VARCHAR(30) NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "configuration" JSONB NOT NULL,
    "headers" JSONB NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'PREVIEW',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retail_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retail_import_rows" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "source" JSONB NOT NULL,
    "normalized" JSONB NOT NULL,
    "errors" JSONB NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'READY',
    "entity_id" UUID,

    CONSTRAINT "retail_import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retail_import_identities" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "kind" VARCHAR(30) NOT NULL,
    "source_key" VARCHAR(64) NOT NULL,
    "entity_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retail_import_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retail_migration_choices" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "choice" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retail_migration_choices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retail_report_preferences" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "time" VARCHAR(5) NOT NULL DEFAULT '19:30',
    "language" VARCHAR(5) NOT NULL DEFAULT 'hi',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retail_report_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retail_report_notifications" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "day" VARCHAR(10) NOT NULL,
    "summary" JSONB NOT NULL,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retail_report_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retail_data_backup_requests" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "request_key" VARCHAR(64) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'REQUESTED',
    "contacted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retail_data_backup_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "retail_import_jobs_company_id_created_at_idx" ON "retail_import_jobs"("company_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "retail_import_jobs_company_id_branch_id_fingerprint_key" ON "retail_import_jobs"("company_id", "branch_id", "fingerprint");

-- CreateIndex
CREATE INDEX "retail_import_rows_job_id_status_number_idx" ON "retail_import_rows"("job_id", "status", "number");

-- CreateIndex
CREATE UNIQUE INDEX "retail_import_rows_job_id_number_key" ON "retail_import_rows"("job_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "retail_import_identities_company_id_kind_source_key_key" ON "retail_import_identities"("company_id", "kind", "source_key");

-- CreateIndex
CREATE UNIQUE INDEX "retail_migration_choices_company_id_user_id_key" ON "retail_migration_choices"("company_id", "user_id");

-- CreateIndex
CREATE INDEX "retail_report_preferences_enabled_time_idx" ON "retail_report_preferences"("enabled", "time");

-- CreateIndex
CREATE UNIQUE INDEX "retail_report_preferences_company_id_branch_id_user_id_key" ON "retail_report_preferences"("company_id", "branch_id", "user_id");

-- CreateIndex
CREATE INDEX "retail_report_notifications_company_id_user_id_created_at_idx" ON "retail_report_notifications"("company_id", "user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "retail_report_notifications_company_id_branch_id_user_id_da_key" ON "retail_report_notifications"("company_id", "branch_id", "user_id", "day");

-- CreateIndex
CREATE INDEX "retail_data_backup_requests_contacted_at_created_at_idx" ON "retail_data_backup_requests"("contacted_at", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "retail_data_backup_requests_company_id_user_id_request_key_key" ON "retail_data_backup_requests"("company_id", "user_id", "request_key");

-- AddForeignKey
ALTER TABLE "retail_calendar_tasks" ADD CONSTRAINT "retail_calendar_tasks_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retail_calendar_tasks" ADD CONSTRAINT "retail_calendar_tasks_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retail_import_jobs" ADD CONSTRAINT "retail_import_jobs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retail_import_jobs" ADD CONSTRAINT "retail_import_jobs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retail_import_jobs" ADD CONSTRAINT "retail_import_jobs_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retail_import_jobs" ADD CONSTRAINT "retail_import_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retail_import_rows" ADD CONSTRAINT "retail_import_rows_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "retail_import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retail_import_identities" ADD CONSTRAINT "retail_import_identities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retail_migration_choices" ADD CONSTRAINT "retail_migration_choices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retail_migration_choices" ADD CONSTRAINT "retail_migration_choices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retail_report_preferences" ADD CONSTRAINT "retail_report_preferences_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retail_report_preferences" ADD CONSTRAINT "retail_report_preferences_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retail_report_preferences" ADD CONSTRAINT "retail_report_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retail_report_notifications" ADD CONSTRAINT "retail_report_notifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retail_report_notifications" ADD CONSTRAINT "retail_report_notifications_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retail_report_notifications" ADD CONSTRAINT "retail_report_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retail_data_backup_requests" ADD CONSTRAINT "retail_data_backup_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retail_data_backup_requests" ADD CONSTRAINT "retail_data_backup_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

