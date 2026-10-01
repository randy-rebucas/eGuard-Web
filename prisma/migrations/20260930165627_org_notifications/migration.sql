-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "digestSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "VoucherBatch" ADD COLUMN     "expiryRemindedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "OrgEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgEvent_orgId_createdAt_idx" ON "OrgEvent"("orgId", "createdAt");

-- AddForeignKey
ALTER TABLE "OrgEvent" ADD CONSTRAINT "OrgEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
