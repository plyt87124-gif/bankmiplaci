-- AlterTable
ALTER TABLE "page_views" ADD COLUMN     "ipHash" TEXT;

-- CreateIndex
CREATE INDEX "page_views_ipHash_createdAt_idx" ON "page_views"("ipHash", "createdAt");

