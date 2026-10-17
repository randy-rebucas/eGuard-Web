-- AlterTable
ALTER TABLE "Broadcast" ADD COLUMN     "audience" TEXT NOT NULL DEFAULT 'PARENTS';

-- AlterTable
ALTER TABLE "BroadcastDelivery" ADD COLUMN     "subscriberId" TEXT;

-- CreateTable
CREATE TABLE "Subscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "lists" TEXT[],
    "source" TEXT NOT NULL,
    "confirmTokenHash" TEXT,
    "confirmSentAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscriber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_email_key" ON "Subscriber"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_confirmTokenHash_key" ON "Subscriber"("confirmTokenHash");

-- CreateIndex
CREATE INDEX "Subscriber_confirmedAt_idx" ON "Subscriber"("confirmedAt");

-- CreateIndex
CREATE INDEX "Subscriber_createdAt_idx" ON "Subscriber"("createdAt");

-- CreateIndex
CREATE INDEX "BroadcastDelivery_subscriberId_idx" ON "BroadcastDelivery"("subscriberId");

-- AddForeignKey
ALTER TABLE "BroadcastDelivery" ADD CONSTRAINT "BroadcastDelivery_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE SET NULL ON UPDATE CASCADE;
