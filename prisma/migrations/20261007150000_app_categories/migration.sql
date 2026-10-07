-- App categories ("Gaming time"): a parent's category for an app (null = guessed from its name), and daily limits
-- per category for each child

-- CreateEnum
CREATE TYPE "AppCategory" AS ENUM ('GAMES', 'SOCIAL', 'VIDEO', 'MESSAGING', 'EDUCATION', 'CREATIVITY', 'BROWSERS', 'OTHER');

-- AlterTable
ALTER TABLE "ChildApp" ADD COLUMN "category" "AppCategory";

-- CreateTable
CREATE TABLE "ChildCategoryLimit" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "category" "AppCategory" NOT NULL,
    "dailyLimitMinutes" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChildCategoryLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChildCategoryLimit_childId_category_key" ON "ChildCategoryLimit"("childId", "category");

-- AddForeignKey
ALTER TABLE "ChildCategoryLimit" ADD CONSTRAINT "ChildCategoryLimit_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;
