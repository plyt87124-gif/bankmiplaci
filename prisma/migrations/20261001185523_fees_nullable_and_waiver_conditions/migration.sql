-- AlterTable
ALTER TABLE "fees" ADD COLUMN     "accountFeeWaiverCondition" TEXT,
ADD COLUMN     "cardFeeWaiverCondition" TEXT,
ALTER COLUMN "accountFeeCents" DROP NOT NULL,
ALTER COLUMN "accountFeeCents" DROP DEFAULT,
ALTER COLUMN "cardFeeCents" DROP NOT NULL,
ALTER COLUMN "cardFeeCents" DROP DEFAULT,
ALTER COLUMN "atmFeeCents" DROP NOT NULL,
ALTER COLUMN "atmFeeCents" DROP DEFAULT;
