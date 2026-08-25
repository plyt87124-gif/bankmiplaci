import { NextRequest, NextResponse } from "next/server";
import { expirePastPromotions } from "@/lib/services/promotions";

export const dynamic = "force-dynamic";

/**
 * Meant to be called on a schedule (e.g. Vercel Cron, GitHub Actions,
 * or a plain crontab hitting this URL) once a day. Requires the
 * `Authorization: Bearer <CRON_SECRET>` header so the endpoint can't
 * be triggered by anyone who finds the URL.
 *
 * Note: listActivePromotions() already filters out anything past its
 * end_date at read time, so a missed run never shows an expired
 * promotion as active — this job only keeps the stored `status`
 * column in sync for reporting/admin purposes.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await expirePastPromotions();
  return NextResponse.json({ expired: count });
}
