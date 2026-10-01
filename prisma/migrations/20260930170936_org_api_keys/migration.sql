-- CreateTable
CREATE TABLE "OrgApiKey" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "access" TEXT NOT NULL DEFAULT 'READ',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "OrgApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrgApiKey_tokenHash_key" ON "OrgApiKey"("tokenHash");

-- CreateIndex
CREATE INDEX "OrgApiKey_orgId_idx" ON "OrgApiKey"("orgId");

-- AddForeignKey
ALTER TABLE "OrgApiKey" ADD CONSTRAINT "OrgApiKey_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgApiKey" ADD CONSTRAINT "OrgApiKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
