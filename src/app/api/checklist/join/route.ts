import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/userSession";
import { touchUserActivity } from "@/lib/userActivity";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Musisz być zalogowany." }, { status: 401 });
  touchUserActivity(user.id);

  const body = await request.json().catch(() => null);
  const promotionId = typeof body?.promotionId === "string" ? body.promotionId : null;
  if (!promotionId) return NextResponse.json({ error: "Brak promotionId." }, { status: 400 });

  const rawOpenedAt = typeof body?.accountOpenedAt === "string" ? new Date(body.accountOpenedAt) : null;
  if (!rawOpenedAt || Number.isNaN(rawOpenedAt.getTime()) || rawOpenedAt.getTime() > Date.now()) {
    return NextResponse.json({ error: "Podaj prawidłową datę otwarcia konta (nie z przyszłości)." }, { status: 400 });
  }
  const accountOpenedAt = rawOpenedAt;

  const promotion = await db.promotion.findUnique({
    where: { id: promotionId },
    select: { id: true, checklistSteps: { select: { id: true } } }
  });
  if (!promotion) return NextResponse.json({ error: "Nie znaleziono promocji." }, { status: 404 });

  const existing = await db.userPromotionTracking.findUnique({
    where: { userId_promotionId: { userId: user.id, promotionId } }
  });

  if (existing?.completedAt) {
    // Restarting a promotion the user already completed once (e.g. their
    // karencja cleared, or they corrected their bank-history dates) — wipe
    // last cycle's checkmarks so the new round starts at 0, and re-open
    // the tracking.
    await db.$transaction([
      db.checklistProgress.deleteMany({
        where: { userId: user.id, stepId: { in: promotion.checklistSteps.map((s) => s.id) } }
      }),
      db.userPromotionTracking.update({
        where: { id: existing.id },
        data: { completedAt: null, joinedAt: new Date(), accountOpenedAt }
      })
    ]);
  } else {
    await db.userPromotionTracking.upsert({
      where: { userId_promotionId: { userId: user.id, promotionId } },
      update: { accountOpenedAt },
      create: { userId: user.id, promotionId, accountOpenedAt }
    });
  }

  return NextResponse.json({ ok: true });
}
