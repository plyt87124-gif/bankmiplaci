-- AlterTable
ALTER TABLE "articles" ADD COLUMN     "promotionId" TEXT;

-- CreateIndex
CREATE INDEX "articles_promotionId_idx" ON "articles"("promotionId");

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
