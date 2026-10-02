-- AlterTable
ALTER TABLE "checklist_steps" ADD COLUMN     "availableUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "promotions" ADD COLUMN     "affiliateLinkEnabled" BOOLEAN NOT NULL DEFAULT true;
