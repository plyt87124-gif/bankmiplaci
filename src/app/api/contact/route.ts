import { NextRequest, NextResponse } from "next/server";
import { resolveMx } from "dns/promises";
import { z } from "zod";
import { sendEmail } from "@/lib/email";

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
      subject: `Nowa wiadomość z formularza kontaktowego — ${parsed.data.email}`,
      replyTo: parsed.data.email,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h1 style="font-size: 18px;">Nowa wiadomość z formularza kontaktowego</h1>
          <p><strong>Od:</strong> ${parsed.data.email}</p>
          <p style="white-space: pre-wrap;">${parsed.data.message}</p>
        </div>
      `
    });
  } else {
    console.error("[contact] Brak SUPPORT_EMAIL w zmiennych środowiskowych — wiadomość nie została nigdzie wysłana:", parsed.data);
  }

  return NextResponse.json({ ok: true });
}
