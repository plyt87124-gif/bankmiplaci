-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AdminNotificationType" ADD VALUE 'EBROKER_NEW_CAMPAIGN';
ALTER TYPE "AdminNotificationType" ADD VALUE 'EBROKER_CAMPAIGN_CHANGED';
ALTER TYPE "AdminNotificationType" ADD VALUE 'EBROKER_CAMPAIGN_REMOVED';
ALTER TYPE "AdminNotificationType" ADD VALUE 'PROMOTION_CHECK_NEEDED';
ALTER TYPE "AdminNotificationType" ADD VALUE 'PROMOTION_AUTO_ADDED';
ALTER TYPE "AdminNotificationType" ADD VALUE 'PROMOTION_EXPIRED';

-- AlterTable
ALTER TABLE "admin_notifications" ADD COLUMN     "dedupKey" TEXT;

-- CreateTable
CREATE TABLE "ebroker_campaigns" (
    "oid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "trackingUrl" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "watched" BOOLEAN NOT NULL DEFAULT false,
    "promotionId" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "missingSince" TIMESTAMP(3),
    "ignored" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ebroker_campaigns_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE INDEX "ebroker_campaigns_watched_promotionId_idx" ON "ebroker_campaigns"("watched", "promotionId");

-- CreateIndex
CREATE UNIQUE INDEX "admin_notifications_dedupKey_key" ON "admin_notifications"("dedupKey");

