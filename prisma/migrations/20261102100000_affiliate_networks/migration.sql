-- CreateEnum
CREATE TYPE "AffiliateNetwork" AS ENUM ('EBROKER', 'COMPERIA');

-- AlterTable
ALTER TABLE "promotions" ADD COLUMN     "affiliateNetwork" "AffiliateNetwork",
ADD COLUMN     "affiliateNetworkPinned" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "clicks" ADD COLUMN     "affiliateNetwork" "AffiliateNetwork";

-- CreateTable
CREATE TABLE "affiliate_offers" (
    "id" TEXT NOT NULL,
    "network" "AffiliateNetwork" NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "cpsCents" INTEGER,
    "cpaCents" INTEGER,
    "conditions" TEXT,
    "notes" TEXT,
    "newClientOnly" BOOLEAN,
    "ownApplicationsAllowed" BOOLEAN,
    "ownApplicationsNote" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "trackingUrl" TEXT,
    "detailUrl" TEXT,
    "promotionId" TEXT,
    "contentHash" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "missingSince" TIMESTAMP(3),

    CONSTRAINT "affiliate_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_contests" (
    "id" TEXT NOT NULL,
    "network" "AffiliateNetwork" NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "tiers" JSONB NOT NULL DEFAULT '[]',
    "offerExternalIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceUrl" TEXT,
    "contentHash" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "missingSince" TIMESTAMP(3),

    CONSTRAINT "affiliate_contests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_applications" (
    "id" TEXT NOT NULL,
    "network" "AffiliateNetwork" NOT NULL,
    "externalId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "bankName" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "commissionModel" TEXT,
    "amountCents" INTEGER,
    "status" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "settledAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stageChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_changes" (
    "id" TEXT NOT NULL,
    "network" "AffiliateNetwork",
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "promotionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "affiliate_offers_promotionId_idx" ON "affiliate_offers"("promotionId");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_offers_network_externalId_key" ON "affiliate_offers"("network", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_contests_network_externalId_key" ON "affiliate_contests"("network", "externalId");

-- CreateIndex
CREATE INDEX "affiliate_applications_stage_idx" ON "affiliate_applications"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_applications_network_externalId_key" ON "affiliate_applications"("network", "externalId");

-- CreateIndex
CREATE INDEX "affiliate_changes_createdAt_idx" ON "affiliate_changes"("createdAt");

-- AddForeignKey
ALTER TABLE "affiliate_offers" ADD CONSTRAINT "affiliate_offers_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: every link added before this migration came from eBrokerPartner.
UPDATE "promotions" SET "affiliateNetwork" = 'EBROKER' WHERE "affiliateUrl" ILIKE '%ebrokerpartner.pl%';
