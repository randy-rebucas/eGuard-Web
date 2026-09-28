-- Plans become Free (1 child), eGuard Plus (5 children, paid) and Family Pro (10 children).
-- The old free base plan was also called "eGuard Plus": those families move to Free. Children and
-- devices they already have stay; they can't add more until they upgrade.
UPDATE "Family" SET "plan" = 'Free', "deviceLimit" = 2 WHERE "plan" = 'eGuard Plus';
-- The old paid plan (eGuard Family, 15 devices) is Family Pro now; its purchases keep granting it.
UPDATE "Family" SET "plan" = 'Family Pro', "deviceLimit" = 20 WHERE "plan" = 'eGuard Family';

ALTER TABLE "Family" ALTER COLUMN "plan" SET DEFAULT 'Free';
ALTER TABLE "Family" ALTER COLUMN "deviceLimit" SET DEFAULT 2;

-- Free doesn't include location sharing: stop showing the last known location of Free families' devices.
-- Location history (LocationVisit) is kept but hidden until the family upgrades.
UPDATE "DeviceLocation" SET "lat" = NULL, "lng" = NULL, "accuracyM" = NULL, "placeLabel" = NULL, "locatedAt" = NULL
WHERE "deviceId" IN (SELECT d."id" FROM "Device" d JOIN "Family" f ON f."id" = d."familyId" WHERE f."plan" = 'Free');
