-- AlterTable
ALTER TABLE "Family" ADD COLUMN "paymongoCustomerId" TEXT;

-- AlterTable
ALTER TABLE "StorePurchase" ADD COLUMN "paymentId" TEXT,
ADD COLUMN "remindedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Family_paymongoCustomerId_key" ON "Family"("paymongoCustomerId");

-- CreateIndex
CREATE INDEX "StorePurchase_paymentId_idx" ON "StorePurchase"("paymentId");
