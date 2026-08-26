-- AlterTable
ALTER TABLE "user_promotion_tracking" ADD COLUMN     "remindedGroupIndexes" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

