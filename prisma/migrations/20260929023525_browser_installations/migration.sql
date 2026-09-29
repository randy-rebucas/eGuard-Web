-- CreateEnum
CREATE TYPE "PairingKind" AS ENUM ('DEVICE', 'BROWSER');

-- AlterTable
ALTER TABLE "PairingCode" ADD COLUMN     "deviceLabel" TEXT,
ADD COLUMN     "kind" "PairingKind" NOT NULL DEFAULT 'DEVICE';

-- CreateTable
CREATE TABLE "BrowserInstallation" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "deviceLabel" TEXT NOT NULL,
    "browser" TEXT NOT NULL,
    "browserVersion" TEXT,
    "extensionVersion" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "refreshTokenHash" TEXT,
    "prevRefreshTokenHash" TEXT,
    "refreshRotatedAt" TIMESTAMP(3),
    "accessTokenHash" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrowserInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrowserInstallation_refreshTokenHash_key" ON "BrowserInstallation"("refreshTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "BrowserInstallation_prevRefreshTokenHash_key" ON "BrowserInstallation"("prevRefreshTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "BrowserInstallation_accessTokenHash_key" ON "BrowserInstallation"("accessTokenHash");

-- CreateIndex
CREATE INDEX "BrowserInstallation_familyId_idx" ON "BrowserInstallation"("familyId");

-- CreateIndex
CREATE INDEX "BrowserInstallation_childId_idx" ON "BrowserInstallation"("childId");

-- AddForeignKey
ALTER TABLE "BrowserInstallation" ADD CONSTRAINT "BrowserInstallation_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrowserInstallation" ADD CONSTRAINT "BrowserInstallation_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;
