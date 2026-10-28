-- CreateTable
CREATE TABLE "promotion_verifications" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "sources" JSONB NOT NULL,
    "note" TEXT,

    CONSTRAINT "promotion_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "promotion_verifications_promotionId_checkedAt_idx" ON "promotion_verifications"("promotionId", "checkedAt");

-- AddForeignKey
ALTER TABLE "promotion_verifications" ADD CONSTRAINT "promotion_verifications_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
