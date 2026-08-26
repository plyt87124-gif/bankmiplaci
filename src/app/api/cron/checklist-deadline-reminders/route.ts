import { NextRequest, NextResponse } from "next/server";
import { sendChecklistDeadlineReminders } from "@/lib/services/checklistReminders";

export const dynamic = "force-dynamic";

/**
 * Meant to be called on a schedule (see vercel.json) once a day. Emails
 * every user who is actively tracking a ściąga and has an unlocked month
 * group they haven't fully checked off, with 7 days or fewer left before
 * the next month unlocks. Requires the same
 * `Authorization: Bearer <CRON_SECRET>` header as the other cron routes.
 */
async function handler(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notified = await sendChecklistDeadlineReminders();
  return NextResponse.json({ notified });
}

// Vercel Cron sends GET; POST is kept for manual/API-triggered runs.
export const GET = handler;
export const POST = handler;
