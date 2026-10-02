import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/userSession";
import { touchUserActivity } from "@/lib/userActivity";
import { joinChecklist } from "@/lib/services/checklistTracking";

/**
 * Start tracking a promotion's ściąga with the real account-opening date. All
 * rules (date validation shared with /opened-at, a saved date is never replaced,
 * the restart lock for completed ściągi, atomic writes) live in joinChecklist.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Musisz być zalogowany." }, { status: 401 });
  touchUserActivity(user.id);

  const body = await request.json().catch(() => null);
  const promotionId = typeof body?.promotionId === "string" ? body.promotionId : null;
  if (!promotionId) return NextResponse.json({ error: "Brak promotionId." }, { status: 400 });

  const result = await joinChecklist(db, user.id, promotionId, body?.accountOpenedAt);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
