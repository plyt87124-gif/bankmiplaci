import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/userSession";
import { groupIndexFromOrder, isGroupUnlocked } from "@/lib/checklistSchedule";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Musisz być zalogowany." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const stepId = typeof body?.stepId === "string" ? body.stepId : null;
  const checked = typeof body?.checked === "boolean" ? body.checked : null;
  if (!stepId || checked === null) return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });

  const step = await db.checklistStep.findUnique({
    where: { id: stepId },
    select: { id: true, order: true, rewardCents: true, promotionId: true }
  });
  if (!step) return NextResponse.json({ error: "Nie znaleziono kroku." }, { status: 404 });

  // "Odbierz nagrodę" rows are informational only — their state is derived
  // from the other steps in the same month, never toggled directly.
  if (step.rewardCents !== null) {
    return NextResponse.json({ error: "Tego kroku nie da się odznaczyć ręcznie." }, { status: 400 });
  }

  if (checked) {
    const tracking = await db.userPromotionTracking.findUnique({
      where: { userId_promotionId: { userId: user.id, promotionId: step.promotionId } },
      select: { accountOpenedAt: true }
    });
    const groupIndex = groupIndexFromOrder(step.order);
    if (!isGroupUnlocked(tracking?.accountOpenedAt ?? null, groupIndex)) {
      return NextResponse.json({ error: "Ten miesiąc jeszcze się nie rozpoczął." }, { status: 400 });
    }
  }

  if (checked) {
    await db.checklistProgress.upsert({
      where: { userId_stepId: { userId: user.id, stepId } },
      update: {},
      create: { userId: user.id, stepId }
    });
  } else {
    await db.checklistProgress.deleteMany({ where: { userId: user.id, stepId } });
  }

  return NextResponse.json({ ok: true, checked });
}
