import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { absoluteUrl } from "@/lib/seo/siteUrl";
import { overdueDigestEmail, raiseOverdueNotifications } from "@/lib/services/verification";

export const dynamic = "force-dynamic";

/**
 * Once a day (see vercel.json), after the daily verification run has had time to
 * finish: any active, still-open offer whose verification is older than the alert
 * threshold gets an admin notification (once per offer per day) and the owner one
 * e-mail. It reads and notifies only - it never moves a verification date; the
 * date moves only when the documents were really compared (services/verification.ts).
 */
async function handler(request: NextRequest) {
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { overdue, created } = await raiseOverdueNotifications(db);

  // One e-mail per day, and only when something new was raised (a stuck offer is not mailed again the same day).
  const adminEmail = process.env.ADMIN_EMAIL ?? process.env.SUPPORT_EMAIL;
  if (adminEmail && created.length > 0) {
    const mail = overdueDigestEmail(created, absoluteUrl("/admin"));
    if (mail) await sendEmail({ to: adminEmail, subject: mail.subject, html: mail.html });
  }
  return NextResponse.json({ overdue: overdue.length, notified: created.length });
}

export const GET = handler;
export const POST = handler;
