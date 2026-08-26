-- AlterTable
ALTER TABLE "user_bank_history" ADD COLUMN     "eligibilityClearedAt" TIMESTAMP(3),
ADD COLUMN     "eligibilityEmailToken" TEXT,
ADD COLUMN     "eligibilityLinkClickedAt" TIMESTAMP(3),
ADD COLUMN     "eligibilityPromotionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "user_bank_history_eligibilityEmailToken_key" ON "user_bank_history"("eligibilityEmailToken");

-- AddForeignKey
ALTER TABLE "user_bank_history" ADD CONSTRAINT "user_bank_history_eligibilityPromotionId_fkey" FOREIGN KEY ("eligibilityPromotionId") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

