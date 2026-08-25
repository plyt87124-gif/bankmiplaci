import { NextRequest, NextResponse } from "next/server";
import { checkEligibilityAndNotify } from "@/lib/services/eligibilityNotifications";

export const dynamic = "force-dynamic";

/**
 * Same shared-secret pattern as /api/cron/expire-promotions. Run this
 * daily alongside it — see scripts/check-eligibility.ts for the
 * crontab-friendly equivalent.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await checkEligibilityAndNotify();
  return NextResponse.json({ notified: count });
}
