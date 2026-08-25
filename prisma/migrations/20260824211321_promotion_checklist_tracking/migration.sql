-- CreateTable
CREATE TABLE "checklist_steps" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "monthLabel" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rewardCents" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "checklist_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklist_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_promotion_tracking" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "user_promotion_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "checklist_steps_promotionId_order_idx" ON "checklist_steps"("promotionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_progress_userId_stepId_key" ON "checklist_progress"("userId", "stepId");

-- CreateIndex
CREATE UNIQUE INDEX "user_promotion_tracking_userId_promotionId_key" ON "user_promotion_tracking"("userId", "promotionId");

-- AddForeignKey
ALTER TABLE "checklist_steps" ADD CONSTRAINT "checklist_steps_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_progress" ADD CONSTRAINT "checklist_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_progress" ADD CONSTRAINT "checklist_progress_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "checklist_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_promotion_tracking" ADD CONSTRAINT "user_promotion_tracking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_promotion_tracking" ADD CONSTRAINT "user_promotion_tracking_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

