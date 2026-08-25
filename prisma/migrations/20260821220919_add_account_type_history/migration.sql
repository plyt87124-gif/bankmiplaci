-- DropIndex
DROP INDEX "user_bank_history_userId_bankId_key";

-- AlterTable
ALTER TABLE "impressions" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "user_bank_history" ADD COLUMN     "accountType" "AccountType" NOT NULL DEFAULT 'PERSONAL';

-- CreateIndex
CREATE INDEX "impressions_userId_idx" ON "impressions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_bank_history_userId_bankId_accountType_key" ON "user_bank_history"("userId", "bankId", "accountType");

-- AddForeignKey
ALTER TABLE "impressions" ADD CONSTRAINT "impressions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

