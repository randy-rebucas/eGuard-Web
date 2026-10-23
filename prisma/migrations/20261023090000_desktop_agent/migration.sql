-- CreateEnum
CREATE TYPE "AppSource" AS ENUM ('CATALOG', 'LAUNCHER', 'UNKNOWN_PUBLISHER');

-- CreateEnum
CREATE TYPE "AppIdentifierKind" AS ENUM ('STEAM', 'EPIC', 'RIOT', 'BATTLENET', 'EA', 'UBISOFT', 'GOG', 'MSSTORE', 'EXE', 'PACKAGE', 'BUNDLE');

-- CreateEnum
CREATE TYPE "DesktopCatalogKind" AS ENUM ('GAME', 'TRUSTED_PUBLISHER');

-- CreateEnum
CREATE TYPE "DesktopMatchType" AS ENUM ('LAUNCHER_ID', 'EXE_NAME', 'SIGNER', 'PRODUCT_NAME');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Platform" ADD VALUE 'WINDOWS';
ALTER TYPE "Platform" ADD VALUE 'MACOS';

-- AlterEnum
ALTER TYPE "DeviceKind" ADD VALUE 'COMPUTER';

-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "removalDeletesHistory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "removalRequestedAt" TIMESTAMP(3),
ADD COLUMN     "removalRequestedBy" TEXT,
ADD COLUMN     "removalSecret" TEXT;

-- AlterTable
ALTER TABLE "ChildApp" ADD COLUMN     "source" "AppSource";

-- CreateTable
CREATE TABLE "AppIdentifier" (
    "id" TEXT NOT NULL,
    "childAppId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "kind" "AppIdentifierKind" NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "AppIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesktopCatalogEntry" (
    "id" TEXT NOT NULL,
    "kind" "DesktopCatalogKind" NOT NULL,
    "matchType" "DesktopMatchType" NOT NULL,
    "match" TEXT NOT NULL,
    "displayName" TEXT,
    "category" "AppCategory",
    "trending" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesktopCatalogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppIdentifier_childAppId_idx" ON "AppIdentifier"("childAppId");

-- CreateIndex
CREATE UNIQUE INDEX "AppIdentifier_childId_platform_kind_value_key" ON "AppIdentifier"("childId", "platform", "kind", "value");

-- CreateIndex
CREATE INDEX "DesktopCatalogEntry_updatedAt_idx" ON "DesktopCatalogEntry"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DesktopCatalogEntry_kind_matchType_match_key" ON "DesktopCatalogEntry"("kind", "matchType", "match");

-- AddForeignKey
ALTER TABLE "AppIdentifier" ADD CONSTRAINT "AppIdentifier_childAppId_fkey" FOREIGN KEY ("childAppId") REFERENCES "ChildApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

