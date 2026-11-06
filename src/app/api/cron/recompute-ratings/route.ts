import { NextRequest, NextResponse } from "next/server";
import { recomputeRatings } from "@/lib/services/ratings";

export const dynamic = "force-dynamic";

/**
 * Daily recompute of the "ocena serwisu" (see src/lib/services/ratings.ts), scheduled in vercel.json
 * right after expire-promotions. The rating depends on the date, not only on edits: a contest that
 * ended yesterday stops counting, the months of a karencja run on. Every admin write path and the
 * affiliate sync also call recomputeRatings() directly; this run catches everything that changes
 * only because time passed (and any drift from a manual DB edit). Requires
 * `Authorization: Bearer <CRON_SECRET>`, same as /api/cron/expire-promotions.
 */
async function handler(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await recomputeRatings();
  return NextResponse.json({ updated: count });
}

// Vercel Cron sends GET; POST is kept for manual/API-triggered runs.
export const GET = handler;
export const POST = handler;
