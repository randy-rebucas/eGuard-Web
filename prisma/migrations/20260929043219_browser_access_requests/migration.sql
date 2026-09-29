-- AlterTable
ALTER TABLE "BrowserPolicy" ADD COLUMN     "temporaryAllows" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "BrowserAccessRequest" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "installationId" TEXT,
    "domain" TEXT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "duration" TEXT,
    "expiresAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrowserAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrowserAccessRequest_childId_status_idx" ON "BrowserAccessRequest"("childId", "status");

-- CreateIndex
CREATE INDEX "BrowserAccessRequest_familyId_createdAt_idx" ON "BrowserAccessRequest"("familyId", "createdAt");

-- AddForeignKey
ALTER TABLE "BrowserAccessRequest" ADD CONSTRAINT "BrowserAccessRequest_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;
