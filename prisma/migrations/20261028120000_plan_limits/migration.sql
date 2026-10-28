-- 2026-10-28 plans: Free 1 child / 1 device, eGuard Plus 3 / 5, eGuard Family (was Family Pro) 6 / 12.
-- Families paying now keep the limits they bought (legacyLimits) until they're back on Free.
ALTER TABLE "Family" ADD COLUMN "childLimit" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Family" ADD COLUMN "legacyLimits" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Family" ALTER COLUMN "deviceLimit" SET DEFAULT 1;

-- "eGuard Family" was a plan retired before Plus and Family Pro, already treated as Free; the name is reused below
UPDATE "Family" SET "plan" = 'Free' WHERE "plan" = 'eGuard Family';
UPDATE "Family" SET "plan" = 'eGuard Family' WHERE "plan" = 'Family Pro';
UPDATE "Broadcast" SET "plans" = array_replace("plans", 'Family Pro', 'eGuard Family') WHERE 'Family Pro' = ANY("plans");

UPDATE "Family" SET "childLimit" = 5, "deviceLimit" = 10, "legacyLimits" = true WHERE "plan" = 'eGuard Plus';
UPDATE "Family" SET "childLimit" = 10, "deviceLimit" = 20, "legacyLimits" = true WHERE "plan" = 'eGuard Family';
-- Free goes to one device; devices already paired stay protected (over the limit, nothing more can be added)
UPDATE "Family" SET "childLimit" = 1, "deviceLimit" = 1 WHERE "plan" NOT IN ('eGuard Plus', 'eGuard Family');
