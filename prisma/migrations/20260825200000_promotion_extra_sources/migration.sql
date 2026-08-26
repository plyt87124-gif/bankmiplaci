-- AlterTable
ALTER TABLE "fees" ADD COLUMN     "sourceUrl" TEXT;

-- AlterTable
ALTER TABLE "promotions" ADD COLUMN     "additionalSourceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

