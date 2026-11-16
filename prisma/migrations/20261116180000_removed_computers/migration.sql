-- Computers removed without confirming it (lib/removed-computers): their token still gets eGuard's signed uninstall
-- command for a while, and the parent can still see their offline removal code.
CREATE TABLE "RemovedComputer" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "removalSecret" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RemovedComputer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RemovedComputer_deviceId_key" ON "RemovedComputer"("deviceId");
CREATE UNIQUE INDEX "RemovedComputer_tokenHash_key" ON "RemovedComputer"("tokenHash");
CREATE INDEX "RemovedComputer_familyId_idx" ON "RemovedComputer"("familyId");

ALTER TABLE "RemovedComputer" ADD CONSTRAINT "RemovedComputer_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
