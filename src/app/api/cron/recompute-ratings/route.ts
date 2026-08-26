import { NextRequest, NextResponse } from "next/server";
import { recomputeRatings } from "@/lib/services/ratings";

export const dynamic = "force-dynamic";

/**
 * Safety net for the "ocena serwisu" algorithm (see
 * src/lib/services/ratings.ts). Every admin write path already calls
 * recomputeRatings() directly, so this shouldn't normally find anything
 * to do — it exists to catch drift from a manual DB edit or a missed
 * hook. Requires `Authorization: Bearer <CRON_SECRET>`, same as
 * /api/cron/expire-promotions.
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
