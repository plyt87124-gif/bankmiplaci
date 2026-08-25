-- AlterTable
ALTER TABLE "promotions" ADD COLUMN     "cooldownCutoffDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

