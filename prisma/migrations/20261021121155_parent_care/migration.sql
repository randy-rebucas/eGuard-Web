-- CreateTable
CREATE TABLE "ParentCarePreference" (
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "inApp" BOOLEAN NOT NULL DEFAULT true,
    "push" BOOLEAN NOT NULL DEFAULT false,
    "email" BOOLEAN NOT NULL DEFAULT false,
    "pushConsentAt" TIMESTAMP(3),
    "emailConsentAt" TIMESTAMP(3),
    "briefings" BOOLEAN NOT NULL DEFAULT true,
    "followUps" BOOLEAN NOT NULL DEFAULT true,
    "weeklyPlan" BOOLEAN NOT NULL DEFAULT true,
    "checkIns" BOOLEAN NOT NULL DEFAULT true,
    "monthlyReport" BOOLEAN NOT NULL DEFAULT true,
    "briefingDays" INTEGER[] DEFAULT ARRAY[1, 3, 5]::INTEGER[],
    "deliveryMinute" INTEGER NOT NULL DEFAULT 1170,
    "quietStart" INTEGER NOT NULL DEFAULT 1260,
    "quietEnd" INTEGER NOT NULL DEFAULT 420,
    "cohort" TEXT NOT NULL DEFAULT 'TREATMENT',
    "lastQualifyingAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "plannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentCarePreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ParentCareAutomation" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "config" JSONB NOT NULL,
    "templateKey" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentCareAutomation_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ParentCareEnrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "automationKey" TEXT NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "step" INTEGER NOT NULL DEFAULT 0,
    "nextAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "exitReason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentCareEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentCareJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "automationKey" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "step" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "runAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentCareJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentCareMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "automationKey" TEXT NOT NULL,
    "jobId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "language" TEXT NOT NULL,
    "contentKey" TEXT,
    "link" TEXT NOT NULL,
    "proactive" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'SENDING',
    "providerRef" TEXT,
    "error" TEXT,
    "token" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentCareMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentCareEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentCareEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentCareActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activityKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentCareActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentCarePlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "week" TEXT NOT NULL,
    "activityKeys" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),

    CONSTRAINT "ParentCarePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentCareSuppression" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "until" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentCareSuppression_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParentCarePreference_lastQualifyingAt_idx" ON "ParentCarePreference"("lastQualifyingAt");

-- CreateIndex
CREATE INDEX "ParentCarePreference_plannedAt_idx" ON "ParentCarePreference"("plannedAt");

-- CreateIndex
CREATE INDEX "ParentCareEnrollment_automationKey_status_idx" ON "ParentCareEnrollment"("automationKey", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ParentCareEnrollment_userId_automationKey_subjectKey_key" ON "ParentCareEnrollment"("userId", "automationKey", "subjectKey");

-- CreateIndex
CREATE UNIQUE INDEX "ParentCareJob_idempotencyKey_key" ON "ParentCareJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ParentCareJob_status_runAt_idx" ON "ParentCareJob"("status", "runAt");

-- CreateIndex
CREATE INDEX "ParentCareJob_userId_status_idx" ON "ParentCareJob"("userId", "status");

-- CreateIndex
CREATE INDEX "ParentCareJob_automationKey_status_idx" ON "ParentCareJob"("automationKey", "status");

-- CreateIndex
CREATE INDEX "ParentCareJob_enrollmentId_idx" ON "ParentCareJob"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentCareMessage_dedupeKey_key" ON "ParentCareMessage"("dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "ParentCareMessage_token_key" ON "ParentCareMessage"("token");

-- CreateIndex
CREATE INDEX "ParentCareMessage_userId_createdAt_idx" ON "ParentCareMessage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ParentCareMessage_userId_channel_createdAt_idx" ON "ParentCareMessage"("userId", "channel", "createdAt");

-- CreateIndex
CREATE INDEX "ParentCareMessage_automationKey_createdAt_idx" ON "ParentCareMessage"("automationKey", "createdAt");

-- CreateIndex
CREATE INDEX "ParentCareMessage_status_createdAt_idx" ON "ParentCareMessage"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ParentCareEvent_eventId_key" ON "ParentCareEvent"("eventId");

-- CreateIndex
CREATE INDEX "ParentCareEvent_userId_type_occurredAt_idx" ON "ParentCareEvent"("userId", "type", "occurredAt");

-- CreateIndex
CREATE INDEX "ParentCareEvent_type_occurredAt_idx" ON "ParentCareEvent"("type", "occurredAt");

-- CreateIndex
CREATE INDEX "ParentCareEvent_familyId_occurredAt_idx" ON "ParentCareEvent"("familyId", "occurredAt");

-- CreateIndex
CREATE INDEX "ParentCareActivity_userId_status_idx" ON "ParentCareActivity"("userId", "status");

-- CreateIndex
CREATE INDEX "ParentCareActivity_status_completedAt_idx" ON "ParentCareActivity"("status", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ParentCareActivity_userId_activityKey_key" ON "ParentCareActivity"("userId", "activityKey");

-- CreateIndex
CREATE UNIQUE INDEX "ParentCarePlan_userId_week_key" ON "ParentCarePlan"("userId", "week");

-- CreateIndex
CREATE INDEX "ParentCareSuppression_scope_idx" ON "ParentCareSuppression"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "ParentCareSuppression_userId_scope_reason_key" ON "ParentCareSuppression"("userId", "scope", "reason");

-- AddForeignKey
ALTER TABLE "ParentCarePreference" ADD CONSTRAINT "ParentCarePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentCareEnrollment" ADD CONSTRAINT "ParentCareEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentCareEnrollment" ADD CONSTRAINT "ParentCareEnrollment_automationKey_fkey" FOREIGN KEY ("automationKey") REFERENCES "ParentCareAutomation"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentCareJob" ADD CONSTRAINT "ParentCareJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentCareJob" ADD CONSTRAINT "ParentCareJob_automationKey_fkey" FOREIGN KEY ("automationKey") REFERENCES "ParentCareAutomation"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentCareJob" ADD CONSTRAINT "ParentCareJob_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "ParentCareEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentCareMessage" ADD CONSTRAINT "ParentCareMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentCareMessage" ADD CONSTRAINT "ParentCareMessage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ParentCareJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentCareEvent" ADD CONSTRAINT "ParentCareEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentCareActivity" ADD CONSTRAINT "ParentCareActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentCarePlan" ADD CONSTRAINT "ParentCarePlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentCareSuppression" ADD CONSTRAINT "ParentCareSuppression_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
