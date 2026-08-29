-- AlterTable
ALTER TABLE "clicks" ADD COLUMN     "ipHash" TEXT,
ADD COLUMN     "trafficSource" TEXT,
ADD COLUMN     "utmCampaign" TEXT,
ADD COLUMN     "utmContent" TEXT,
ADD COLUMN     "utmMedium" TEXT,
ADD COLUMN     "utmSource" TEXT,
ADD COLUMN     "utmTerm" TEXT;

-- AlterTable
ALTER TABLE "impressions" ADD COLUMN     "trafficSource" TEXT,
ADD COLUMN     "utmCampaign" TEXT,
ADD COLUMN     "utmContent" TEXT,
ADD COLUMN     "utmMedium" TEXT,
ADD COLUMN     "utmSource" TEXT,
ADD COLUMN     "utmTerm" TEXT;

-- CreateIndex
CREATE INDEX "clicks_promotionId_ipHash_createdAt_idx" ON "clicks"("promotionId", "ipHash", "createdAt");

