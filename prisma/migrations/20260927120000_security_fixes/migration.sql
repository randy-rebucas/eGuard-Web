-- Apple/Google sign-ups have no password they know until they set one. Those accounts were created in
-- the same request as their identity (accounts linked later got theirs long after sign-up).
ALTER TABLE "User" ADD COLUMN "passwordSet" BOOLEAN NOT NULL DEFAULT true;
UPDATE "User" u SET "passwordSet" = false
WHERE EXISTS (SELECT 1 FROM "OAuthIdentity" i WHERE i."userId" = u.id AND i."createdAt" - u."createdAt" < interval '10 seconds');

-- "Forgot password" links
CREATE TABLE "PasswordReset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PasswordReset_tokenHash_key" ON "PasswordReset"("tokenHash");
CREATE INDEX "PasswordReset_userId_createdAt_idx" ON "PasswordReset"("userId", "createdAt");
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rate limits shared across server instances
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "RateLimit_resetAt_idx" ON "RateLimit"("resetAt");

-- App usage per device: a phone and a tablet no longer overwrite each other's minutes.
-- Existing rows are attributed to the child's primary (else oldest) device; rows for children without one are dropped.
ALTER TABLE "AppUsageDaily" ADD COLUMN "deviceId" TEXT;
UPDATE "AppUsageDaily" a SET "deviceId" = (
  SELECT d.id FROM "Device" d WHERE d."childId" = a."childId" ORDER BY d."isPrimary" DESC, d."createdAt" ASC LIMIT 1
);
DELETE FROM "AppUsageDaily" WHERE "deviceId" IS NULL;
ALTER TABLE "AppUsageDaily" ALTER COLUMN "deviceId" SET NOT NULL;
DROP INDEX "AppUsageDaily_childId_date_app_key";
CREATE UNIQUE INDEX "AppUsageDaily_deviceId_date_app_key" ON "AppUsageDaily"("deviceId", "date", "app");
CREATE INDEX "AppUsageDaily_childId_date_idx" ON "AppUsageDaily"("childId", "date");
ALTER TABLE "AppUsageDaily" ADD CONSTRAINT "AppUsageDaily_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The free base plan doesn't renew; it used to get a date a month out that then showed as "expired"
UPDATE "Family" f SET "renewsAt" = NULL
WHERE f.plan = 'eGuard Plus'
  AND NOT EXISTS (SELECT 1 FROM "StorePurchase" p WHERE p."familyId" = f.id AND p.state <> 'REPLACED');

-- Alert emails: each alert is emailed once. Existing alerts count as handled so nothing old gets sent.
ALTER TABLE "Alert" ADD COLUMN "notifiedAt" TIMESTAMP(3);
UPDATE "Alert" SET "notifiedAt" = CURRENT_TIMESTAMP;
