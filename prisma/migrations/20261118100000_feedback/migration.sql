-- In-app feedback and NPS (lib/feedback, docs/features/feedback.md): what parents told us, and when each was last asked.
-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "score" INTEGER,
    "bucket" TEXT,
    "comment" TEXT,
    "contactOk" BOOLEAN NOT NULL DEFAULT false,
    "platform" TEXT NOT NULL,
    "appVersion" TEXT,
    "trigger" TEXT NOT NULL,
    "followUp" TEXT NOT NULL DEFAULT 'NONE',
    "ticketId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackState" (
    "userId" TEXT NOT NULL,
    "npsSeenAt" TIMESTAMP(3),
    "npsAnsweredAt" TIMESTAMP(3),
    "npsDismissedAt" TIMESTAMP(3),
    "lastFeedbackAt" TIMESTAMP(3),
    "ratePromptedAt" JSONB NOT NULL DEFAULT '{}',
    "ratePromptCount" INTEGER NOT NULL DEFAULT 0,
    "ratePromptYearFrom" TIMESTAMP(3),
    "testimonialInvitedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackState_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_ticketId_key" ON "Feedback"("ticketId");

-- CreateIndex
CREATE INDEX "Feedback_familyId_createdAt_idx" ON "Feedback"("familyId", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_kind_createdAt_idx" ON "Feedback"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_bucket_followUp_idx" ON "Feedback"("bucket", "followUp");

-- CreateIndex
CREATE INDEX "Feedback_followUp_createdAt_idx" ON "Feedback"("followUp", "createdAt");

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackState" ADD CONSTRAINT "FeedbackState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

