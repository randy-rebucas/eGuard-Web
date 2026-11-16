-- The parent PIN that opens "Parent settings" on a child's iPhone (lib/device-pin), and what the app rules chosen
-- there cover, as counts (lib/device-app-rules).
ALTER TABLE "Family" ADD COLUMN "devicePinHash" TEXT, ADD COLUMN "devicePinSetAt" TIMESTAMP(3);
ALTER TABLE "Device" ADD COLUMN "appRules" JSONB;
