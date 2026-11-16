-- iPhones: how the child app's Screen Time permission was granted, in its own column. Until now it was kept in
-- "accounts" as {"screenTimeAuthorization": "child" | "individual"}; that column is for computers' Windows accounts.
CREATE TYPE "ScreenTimeAuthorization" AS ENUM ('CHILD', 'INDIVIDUAL');

ALTER TABLE "Device" ADD COLUMN "screenTimeAuthorization" "ScreenTimeAuthorization";

UPDATE "Device"
SET "screenTimeAuthorization" = UPPER("accounts"->>'screenTimeAuthorization')::"ScreenTimeAuthorization"
WHERE "platform" = 'IOS'
  AND jsonb_typeof("accounts") = 'object'
  AND "accounts"->>'screenTimeAuthorization' IN ('child', 'individual');

-- Nothing else was ever stored in "accounts" on an iPhone
UPDATE "Device" SET "accounts" = NULL WHERE "platform" = 'IOS' AND jsonb_typeof("accounts") = 'object';
