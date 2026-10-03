import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/userSession";
import { touchUserActivity } from "@/lib/userActivity";
import { setAccountOpenedAt } from "@/lib/services/checklistTracking";

/**
 * Lets the owner of an older, unfinished ściąga that has no accountOpenedAt
 * supply the real opening date of the account (Moje konto). All rules - own
 * tracking only, never overwriting an existing date, valid and not-future date -
 * live in setAccountOpenedAt.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Musisz być zalogowany." }, { status: 401 });
  touchUserActivity(user.id);

  const body = await request.json().catch(() => null);
  const trackingId = typeof body?.trackingId === "string" ? body.trackingId : null;
  if (!trackingId) return NextResponse.json({ error: "Brak trackingId." }, { status: 400 });

  const result = await setAccountOpenedAt(db, user.id, trackingId, body?.accountOpenedAt);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
