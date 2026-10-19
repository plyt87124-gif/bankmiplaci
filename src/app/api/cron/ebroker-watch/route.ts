import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { runEbrokerWatch, watchDailyReport } from "@/lib/services/ebrokerWatch";

export const dynamic = "force-dynamic";

const DEFAULT_CATALOG_URL = "https://bankmiplaci.ebrokerpartner.pl/xml-file";
const MAX_BYTES = 5 * 1024 * 1024;

async function fetchCatalogXml(): Promise<string> {
  const url = process.env.EBROKER_CATALOG_URL ?? DEFAULT_CATALOG_URL;
  if (!url.startsWith("https://")) throw new Error("EBROKER_CATALOG_URL musi zaczynać się od https://");
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000), cache: "no-store" });
  if (!res.ok) throw new Error(`Katalog eBroker: HTTP ${res.status}`);
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new Error("Katalog eBroker jest większy niż dopuszczalny limit.");
  return text;
}

/**
 * Once a day (see vercel.json): compares the public eBroker catalog with the
 * stored snapshot and raises admin notifications + one e-mail digest. Never
 * creates, extends or expires a promotion — see services/ebrokerWatch.ts.
 */
async function handler(request: NextRequest) {
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { result, notifications } = await runEbrokerWatch(db, fetchCatalogXml);

    // Every day, also when nothing changed (so the owner knows the check ran). ADMIN_EMAIL, else SUPPORT_EMAIL.
    const adminEmail = process.env.ADMIN_EMAIL ?? process.env.SUPPORT_EMAIL;
    if (adminEmail) {
      const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
      const mail = watchDailyReport(result, notifications, `${site}/admin`);
      await sendEmail({ to: adminEmail, subject: mail.subject, html: mail.html });
    }
    return NextResponse.json(result);
  } catch (error) {
    // A failed read changes nothing in the data; tell the admin once per day.
    const message = error instanceof Error ? error.message : String(error);
    console.error("[ebroker-watch]", message);
    const day = new Date().toISOString().slice(0, 10);
    await db.adminNotification
      .create({
        data: {
          type: "EBROKER_CAMPAIGN_REMOVED",
          title: "Nie udało się odczytać katalogu eBroker",
          body: `Dzienna kontrola ofert nie zadziałała: ${message}. Dane nie zostały zmienione.`,
          dedupKey: `ebroker-read-error:${day}`
        }
      })
      .catch(() => undefined);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export const GET = handler;
export const POST = handler;
