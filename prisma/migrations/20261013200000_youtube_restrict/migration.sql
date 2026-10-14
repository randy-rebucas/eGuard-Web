-- AlterTable
ALTER TABLE "BrowserPolicy" ADD COLUMN     "youtubeRestrict" TEXT NOT NULL DEFAULT 'MODERATE';

-- Existing policies: Restricted Mode follows SafeSearch, so a family that turned SafeSearch off isn't filtered anew.
-- The version stays: the extension takes a same-version policy whose content changed.
UPDATE "BrowserPolicy" SET "youtubeRestrict" = 'OFF' WHERE "safeSearch" = false;
