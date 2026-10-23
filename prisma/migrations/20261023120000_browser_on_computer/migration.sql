-- AlterTable
ALTER TABLE "BrowserInstallation" ADD COLUMN     "deviceId" TEXT;

-- CreateIndex
CREATE INDEX "BrowserInstallation_deviceId_idx" ON "BrowserInstallation"("deviceId");

-- AddForeignKey
ALTER TABLE "BrowserInstallation" ADD CONSTRAINT "BrowserInstallation_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

