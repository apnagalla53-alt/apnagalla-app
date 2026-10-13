-- CreateTable
CREATE TABLE "assistant_intent_configs" (
    "code" VARCHAR(60) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_intent_configs_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "assistant_examples" (
    "id" UUID NOT NULL,
    "intent_code" VARCHAR(60) NOT NULL,
    "phrase" VARCHAR(400) NOT NULL,
    "normalized" VARCHAR(400) NOT NULL,
    "language" VARCHAR(20) NOT NULL,
    "source" VARCHAR(30) NOT NULL DEFAULT 'DEFAULT',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_examples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_conversations" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "auth_session_id" UUID NOT NULL,
    "context" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_query_logs" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "original_message" VARCHAR(400) NOT NULL,
    "normalized_message" VARCHAR(400) NOT NULL,
    "intent_code" VARCHAR(60),
    "confidence" DOUBLE PRECISION,
    "router_type" VARCHAR(20) NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "timings" JSONB NOT NULL,
    "total_ms" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_query_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assistant_examples_normalized_key" ON "assistant_examples"("normalized");

-- CreateIndex
CREATE INDEX "assistant_examples_intent_code_active_idx" ON "assistant_examples"("intent_code", "active");

-- CreateIndex
CREATE INDEX "assistant_conversations_company_id_user_id_expires_at_idx" ON "assistant_conversations"("company_id", "user_id", "expires_at");

-- CreateIndex
CREATE INDEX "assistant_conversations_expires_at_idx" ON "assistant_conversations"("expires_at");

-- CreateIndex
CREATE INDEX "assistant_query_logs_created_at_status_idx" ON "assistant_query_logs"("created_at", "status");

-- CreateIndex
CREATE INDEX "assistant_query_logs_company_id_created_at_idx" ON "assistant_query_logs"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "assistant_query_logs_intent_code_created_at_idx" ON "assistant_query_logs"("intent_code", "created_at");

-- AddForeignKey
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_query_logs" ADD CONSTRAINT "assistant_query_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_query_logs" ADD CONSTRAINT "assistant_query_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_query_logs" ADD CONSTRAINT "assistant_query_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

