import { NextRequest, NextResponse } from "next/server";
import { resolveMx } from "dns/promises";
import { z } from "zod";
import { sendEmail } from "@/lib/email";
import { buildContactEmailHtml, contactEmailSubject } from "@/app/kontakt/contactEmail";

const contactSchema = z.object({
  email: z.string().email(),
  message: z.string().min(5).max(4000)
});

/**
 * Confirms the email's domain can actually receive mail (has MX records).
 * This can't confirm the specific mailbox exists — mail servers deliberately
 * don't answer that to resist spammer probing — but it catches typo'd or
 * made-up domains ("gmial.com"), which is the common real-world case.
 */
async function domainAcceptsMail(email: string): Promise<boolean> {
  const domain = email.split("@")[1];
  if (!domain) return false;
  try {
    const records = await resolveMx(domain);
    return records.length > 0;
  } catch {
    return false;
  }
}

// Add rate limiting (e.g. Upstash Ratelimit) here before going live —
// this endpoint has no abuse protection yet.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = contactSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Nieprawidłowe dane formularza." }, { status: 400 });
  }

  if (!(await domainAcceptsMail(parsed.data.email))) {
    return NextResponse.json(
      { ok: false, error: "Taki adres e-mail nie istnieje albo nie może odbierać wiadomości. Sprawdź, czy nie ma literówki." },
      { status: 400 }
    );
  }

  const supportEmail = process.env.SUPPORT_EMAIL;
  if (supportEmail) {
    await sendEmail({
      to: supportEmail,
      subject: contactEmailSubject(parsed.data.email),
      replyTo: parsed.data.email,
      // The visitor's text is escaped: it must never become live markup in the operator's mail client.
      html: buildContactEmailHtml(parsed.data)
    });
  } else {
    // Deliberately no address and no message text in the log: that is personal data.
    console.error("[contact] Brak SUPPORT_EMAIL w zmiennych środowiskowych — wiadomość z formularza nie została nigdzie wysłana.");
  }

  return NextResponse.json({ ok: true });
}
