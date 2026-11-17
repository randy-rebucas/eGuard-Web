-- Testimonials with consent, and site figures checked by hand (lib/testimonials, lib/social-proof-data).
-- CreateTable
CREATE TABLE "Testimonial" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "feedbackId" TEXT,
    "source" TEXT NOT NULL,
    "originalText" TEXT,
    "quote" TEXT,
    "displayName" TEXT,
    "quoteHash" TEXT,
    "consentEmail" TEXT,
    "consentAt" TIMESTAMP(3),
    "consentTextVersion" INTEGER,
    "tokenHash" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "publishedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteStat" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "checkedOn" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteStat_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Testimonial_tokenHash_key" ON "Testimonial"("tokenHash");

-- CreateIndex
CREATE INDEX "Testimonial_status_sortOrder_idx" ON "Testimonial"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "Testimonial_userId_idx" ON "Testimonial"("userId");

-- AddForeignKey
ALTER TABLE "Testimonial" ADD CONSTRAINT "Testimonial_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

