-- AlterTable
ALTER TABLE "BrowserInstallation" ADD COLUMN     "appliedPolicyVersion" INTEGER,
ADD COLUMN     "lastHealthAt" TIMESTAMP(3),
ADD COLUMN     "protectionState" TEXT;

-- CreateTable
CREATE TABLE "BrowserHealthCheck" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "policyVersion" INTEGER,
    "state" TEXT NOT NULL,
    "checks" JSONB NOT NULL,
    "score" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrowserHealthCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrowserEventDaily" (
    "installationId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "blockedCount" INTEGER NOT NULL,

    CONSTRAINT "BrowserEventDaily_pkey" PRIMARY KEY ("installationId","date","category")
);

-- CreateIndex
CREATE INDEX "BrowserHealthCheck_installationId_createdAt_idx" ON "BrowserHealthCheck"("installationId", "createdAt");

-- AddForeignKey
ALTER TABLE "BrowserHealthCheck" ADD CONSTRAINT "BrowserHealthCheck_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "BrowserInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrowserEventDaily" ADD CONSTRAINT "BrowserEventDaily_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "BrowserInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
