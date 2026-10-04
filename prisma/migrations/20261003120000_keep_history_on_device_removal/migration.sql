-- A removed device's screen time, app usage and location visits stay with the child (until retention or the
-- child is deleted) instead of being deleted with the device: deviceId becomes nullable, ON DELETE SET NULL.

-- DropForeignKey
ALTER TABLE "AppUsageDaily" DROP CONSTRAINT "AppUsageDaily_deviceId_fkey";

-- DropForeignKey
ALTER TABLE "LocationVisit" DROP CONSTRAINT "LocationVisit_deviceId_fkey";

-- DropForeignKey
ALTER TABLE "ScreenTimeDaily" DROP CONSTRAINT "ScreenTimeDaily_deviceId_fkey";

-- AlterTable
ALTER TABLE "AppUsageDaily" ALTER COLUMN "deviceId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "LocationVisit" ALTER COLUMN "deviceId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ScreenTimeDaily" ALTER COLUMN "deviceId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "LocationVisit" ADD CONSTRAINT "LocationVisit_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenTimeDaily" ADD CONSTRAINT "ScreenTimeDaily_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppUsageDaily" ADD CONSTRAINT "AppUsageDaily_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

