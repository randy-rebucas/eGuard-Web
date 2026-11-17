-- Store reviews (lib/store-reviews): Play and App Store reviews synced for the console inbox, replies drafted, approved and
-- posted by staff, and per-store sync state.
-- CreateTable
CREATE TABLE "StoreReview" (
    "id" TEXT NOT NULL,
    "store" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "reviewTitle" TEXT,
    "text" TEXT NOT NULL,
    "authorName" TEXT,
    "language" TEXT,
    "territory" TEXT,
    "appVersion" TEXT,
    "device" TEXT,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "textHash" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "sentiment" TEXT,
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "urgency" TEXT,
    "summary" TEXT,
    "likelyChild" BOOLEAN NOT NULL DEFAULT false,
    "classifiedAt" TIMESTAMP(3),
    "classifierVersion" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "storeReplyText" TEXT,
    "storeReplyAt" TIMESTAMP(3),
    "storeReplyId" TEXT,
    "alertedAt" TIMESTAMP(3),
    "ticketId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreReviewReply" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "provider" TEXT,
    "forTextHash" TEXT NOT NULL,
    "trimmed" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "postError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreReviewReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreSyncState" (
    "store" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "newestReviewAt" TIMESTAMP(3),
    "fetched" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSyncState_pkey" PRIMARY KEY ("store")
);

-- CreateIndex
CREATE INDEX "StoreReview_status_reviewedAt_idx" ON "StoreReview"("status", "reviewedAt");

-- CreateIndex
CREATE INDEX "StoreReview_store_reviewedAt_idx" ON "StoreReview"("store", "reviewedAt");

-- CreateIndex
CREATE INDEX "StoreReview_rating_reviewedAt_idx" ON "StoreReview"("rating", "reviewedAt");

-- CreateIndex
CREATE INDEX "StoreReview_classifiedAt_idx" ON "StoreReview"("classifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StoreReview_store_externalId_key" ON "StoreReview"("store", "externalId");

-- CreateIndex
CREATE INDEX "StoreReviewReply_reviewId_createdAt_idx" ON "StoreReviewReply"("reviewId", "createdAt");

-- CreateIndex
CREATE INDEX "StoreReviewReply_status_idx" ON "StoreReviewReply"("status");

-- AddForeignKey
ALTER TABLE "StoreReviewReply" ADD CONSTRAINT "StoreReviewReply_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "StoreReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

