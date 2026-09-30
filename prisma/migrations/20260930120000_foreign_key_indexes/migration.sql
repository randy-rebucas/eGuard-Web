-- Postgres doesn't index foreign keys on its own. These columns are filtered on by most pages,
-- by the maintenance job and by cascade deletes.

-- CreateIndex
CREATE INDEX "User_familyId_idx" ON "User"("familyId");

-- CreateIndex
CREATE INDEX "Child_familyId_idx" ON "Child"("familyId");

-- CreateIndex
CREATE INDEX "Device_familyId_idx" ON "Device"("familyId");

-- CreateIndex
CREATE INDEX "Device_childId_idx" ON "Device"("childId");

-- CreateIndex
CREATE INDEX "PairingCode_childId_idx" ON "PairingCode"("childId");

-- CreateIndex
CREATE INDEX "ConfigChange_childId_idx" ON "ConfigChange"("childId");

-- CreateIndex
CREATE INDEX "CheckRun_familyId_idx" ON "CheckRun"("familyId");

-- CreateIndex
CREATE INDEX "Alert_familyId_resolveKey_idx" ON "Alert"("familyId", "resolveKey");

-- CreateIndex
CREATE INDEX "Alert_notifiedAt_createdAt_idx" ON "Alert"("notifiedAt", "createdAt");

-- CreateIndex
CREATE INDEX "AlertRead_userId_idx" ON "AlertRead"("userId");
