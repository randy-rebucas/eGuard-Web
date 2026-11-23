-- A removed device is kept after its family is deleted, so its token's 401 still carries the signed uninstall command
-- (an iPhone lifts its protection only with it; a computer removes itself). Maintenance still drops it when it expires.
ALTER TABLE "RemovedComputer" ALTER COLUMN "familyId" DROP NOT NULL;
ALTER TABLE "RemovedComputer" DROP CONSTRAINT "RemovedComputer_familyId_fkey";
ALTER TABLE "RemovedComputer" ADD CONSTRAINT "RemovedComputer_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;
