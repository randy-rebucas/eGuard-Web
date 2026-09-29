-- CreateTable
CREATE TABLE "BrowserPolicy" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "safeBrowsing" BOOLEAN NOT NULL DEFAULT true,
    "safeSearch" BOOLEAN NOT NULL DEFAULT true,
    "blockedCategories" TEXT[],
    "blockedDomains" TEXT[],
    "allowedDomains" TEXT[],
    "unknownSitesPolicy" TEXT NOT NULL DEFAULT 'ALLOW',
    "schedule" JSONB,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrowserPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrowserPolicyVersion" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrowserPolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrowserPolicy_childId_key" ON "BrowserPolicy"("childId");

-- CreateIndex
CREATE UNIQUE INDEX "BrowserPolicyVersion_policyId_version_key" ON "BrowserPolicyVersion"("policyId", "version");

-- AddForeignKey
ALTER TABLE "BrowserPolicy" ADD CONSTRAINT "BrowserPolicy_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrowserPolicyVersion" ADD CONSTRAINT "BrowserPolicyVersion_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "BrowserPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
