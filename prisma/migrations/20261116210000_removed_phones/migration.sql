-- Removed phones and tablets are kept too (lib/removed-computers), without a removal secret: their token's 401 carries
-- the signed uninstall command, which the iPhone app needs before it lifts protection.
ALTER TABLE "RemovedComputer" ALTER COLUMN "removalSecret" DROP NOT NULL;
