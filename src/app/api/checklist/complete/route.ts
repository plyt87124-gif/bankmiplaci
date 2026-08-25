import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/userSession";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Musisz być zalogowany." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const promotionId = typeof body?.promotionId === "string" ? body.promotionId : null;
  if (!promotionId) return NextResponse.json({ error: "Brak promotionId." }, { status: 400 });

  // Closure date is user-supplied (not always "today") because a notice
  // period means the account may close later than the day they confirm here.
  const rawClosedAt = typeof body?.closedAt === "string" ? new Date(body.closedAt) : new Date();
  if (Number.isNaN(rawClosedAt.getTime())) {
    return NextResponse.json({ error: "Nieprawidłowa data zamknięcia konta." }, { status: 400 });
  }
  const closedAt = rawClosedAt;

  const promotion = await db.promotion.findUnique({
    where: { id: promotionId },
    select: { id: true, bankId: true, accountType: true, bank: { select: { name: true } } }
  });
  if (!promotion) return NextResponse.json({ error: "Nie znaleziono promocji." }, { status: 404 });

  await db.$transaction([
    db.userPromotionTracking.update({
      where: { userId_promotionId: { userId: user.id, promotionId } },
      data: { completedAt: closedAt }
    }),
    db.userBankHistory.upsert({
      where: { userId_bankId_accountType: { userId: user.id, bankId: promotion.bankId, accountType: promotion.accountType } },
      update: { wasClientUntil: closedAt, eligibilityNotifiedAt: null },
      create: { userId: user.id, bankId: promotion.bankId, accountType: promotion.accountType, wasClientUntil: closedAt }
    })
  ]);

  return NextResponse.json({
    ok: true,
    bankName: promotion.bank.name,
    closedAt
  });
}
