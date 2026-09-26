-- CreateEnum
CREATE TYPE "Role" AS ENUM ('FAMILY_ADMIN', 'PARENT');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('ANDROID', 'IOS');

-- CreateEnum
CREATE TYPE "DeviceKind" AS ENUM ('PHONE', 'TABLET');

-- CreateEnum
CREATE TYPE "ProtectionKey" AS ENUM ('SCREEN_TIME', 'BEDTIME', 'APP_RESTRICTIONS', 'APP_APPROVAL', 'CONTENT', 'WEB', 'DOWNLOADS', 'LOCATION', 'NOTIFICATIONS', 'UNINSTALL_PROTECTION');

-- CreateEnum
CREATE TYPE "CheckStatus" AS ENUM ('PASS', 'WARNING', 'ACTION_REQUIRED', 'UNSUPPORTED', 'NOT_CONFIGURED');

-- CreateEnum
CREATE TYPE "RequestMode" AS ENUM ('APPLY', 'GUIDED');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'AWAITING_PARENT', 'DELIVERED', 'VERIFIED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'ATTENTION', 'ACTION_REQUIRED', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertCategory" AS ENUM ('PROTECTION', 'DEVICES', 'APPS', 'SCREEN_TIME', 'LOCATION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AppApproval" AS ENUM ('ALLOWED', 'ALWAYS_ALLOWED', 'FILTERED', 'BLOCKED', 'PENDING');

-- CreateEnum
CREATE TYPE "CheckRunStatus" AS ENUM ('RUNNING', 'COMPLETED');

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Manila',
    "plan" TEXT NOT NULL DEFAULT 'eGuard Plus',
    "deviceLimit" INTEGER NOT NULL DEFAULT 8,
    "renewsAt" TIMESTAMP(3),
    "keepLocationHistory" BOOLEAN NOT NULL DEFAULT false,
    "shareAnalytics" BOOLEAN NOT NULL DEFAULT false,
    "retentionDays" INTEGER NOT NULL DEFAULT 90,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PARENT',
    "notifyPush" BOOLEAN NOT NULL DEFAULT true,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifyApproval" BOOLEAN NOT NULL DEFAULT true,
    "weeklySummary" BOOLEAN NOT NULL DEFAULT true,
    "twoFactor" BOOLEAN NOT NULL DEFAULT false,
    "passwordChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Child" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birthYear" INTEGER NOT NULL,
    "hue" INTEGER NOT NULL DEFAULT 205,
    "dailyLimitMinutes" INTEGER NOT NULL DEFAULT 180,
    "weekendLimitMinutes" INTEGER NOT NULL DEFAULT 240,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildPolicy" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "key" "ProtectionKey" NOT NULL,
    "config" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChildPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "kind" "DeviceKind" NOT NULL DEFAULT 'PHONE',
    "platform" "Platform" NOT NULL,
    "osVersion" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "battery" INTEGER,
    "appVersion" TEXT,
    "tokenHash" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "checkRequestedAt" TIMESTAMP(3),
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "simulatedOnline" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceProtection" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "key" "ProtectionKey" NOT NULL,
    "status" "CheckStatus" NOT NULL,
    "reported" JSONB,
    "message" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),

    CONSTRAINT "DeviceProtection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceLocation" (
    "deviceId" TEXT NOT NULL,
    "sharing" BOOLEAN NOT NULL DEFAULT true,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "accuracyM" DOUBLE PRECISION,
    "placeLabel" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceLocation_pkey" PRIMARY KEY ("deviceId")
);

-- CreateTable
CREATE TABLE "PairingCode" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PairingCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreenTimeDaily" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "minutes" INTEGER NOT NULL,

    CONSTRAINT "ScreenTimeDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppUsageDaily" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "app" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,

    CONSTRAINT "AppUsageDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildApp" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "approval" "AppApproval" NOT NULL DEFAULT 'ALLOWED',
    "dailyLimitMinutes" INTEGER,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChildApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigRequest" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "key" "ProtectionKey" NOT NULL,
    "mode" "RequestMode" NOT NULL,
    "desired" JSONB NOT NULL,
    "previous" JSONB,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "ConfigRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigChange" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "key" "ProtectionKey" NOT NULL,
    "title" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfigChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckRun" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "status" "CheckRunStatus" NOT NULL DEFAULT 'RUNNING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CheckRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckRunResult" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "reachable" BOOLEAN,
    "issues" INTEGER,
    "reportedAt" TIMESTAMP(3),

    CONSTRAINT "CheckRunResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "childId" TEXT,
    "deviceId" TEXT,
    "severity" "AlertSeverity" NOT NULL,
    "category" "AlertCategory" NOT NULL,
    "icon" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "resolveKey" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRead" (
    "alertId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertRead_pkey" PRIMARY KEY ("alertId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_familyId_createdAt_idx" ON "AuditLog"("familyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChildPolicy_childId_key_key" ON "ChildPolicy"("childId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Device_tokenHash_key" ON "Device"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceProtection_deviceId_key_key" ON "DeviceProtection"("deviceId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "PairingCode_code_key" ON "PairingCode"("code");

-- CreateIndex
CREATE INDEX "ScreenTimeDaily_childId_date_idx" ON "ScreenTimeDaily"("childId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ScreenTimeDaily_deviceId_date_key" ON "ScreenTimeDaily"("deviceId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AppUsageDaily_childId_date_app_key" ON "AppUsageDaily"("childId", "date", "app");

-- CreateIndex
CREATE UNIQUE INDEX "ChildApp_childId_name_key" ON "ChildApp"("childId", "name");

-- CreateIndex
CREATE INDEX "ConfigRequest_deviceId_status_idx" ON "ConfigRequest"("deviceId", "status");

-- CreateIndex
CREATE INDEX "ConfigRequest_batchId_idx" ON "ConfigRequest"("batchId");

-- CreateIndex
CREATE INDEX "ConfigChange_familyId_createdAt_idx" ON "ConfigChange"("familyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CheckRunResult_runId_deviceId_key" ON "CheckRunResult"("runId", "deviceId");

-- CreateIndex
CREATE INDEX "Alert_familyId_createdAt_idx" ON "Alert"("familyId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Child" ADD CONSTRAINT "Child_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildPolicy" ADD CONSTRAINT "ChildPolicy_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceProtection" ADD CONSTRAINT "DeviceProtection_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceLocation" ADD CONSTRAINT "DeviceLocation_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PairingCode" ADD CONSTRAINT "PairingCode_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenTimeDaily" ADD CONSTRAINT "ScreenTimeDaily_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenTimeDaily" ADD CONSTRAINT "ScreenTimeDaily_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppUsageDaily" ADD CONSTRAINT "AppUsageDaily_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildApp" ADD CONSTRAINT "ChildApp_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigRequest" ADD CONSTRAINT "ConfigRequest_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigRequest" ADD CONSTRAINT "ConfigRequest_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigChange" ADD CONSTRAINT "ConfigChange_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigChange" ADD CONSTRAINT "ConfigChange_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckRun" ADD CONSTRAINT "CheckRun_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckRunResult" ADD CONSTRAINT "CheckRunResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CheckRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckRunResult" ADD CONSTRAINT "CheckRunResult_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRead" ADD CONSTRAINT "AlertRead_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRead" ADD CONSTRAINT "AlertRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
