-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "tenant_number" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "organizations_tenant_number_key" ON "organizations"("tenant_number");
