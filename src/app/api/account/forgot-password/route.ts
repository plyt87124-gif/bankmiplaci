import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { forgotPasswordSchema } from "@/lib/validation/account";
import { sendEmail } from "@/lib/email";
import { passwordResetEmailHtml } from "@/lib/emailTemplates";
import { createPasswordResetToken, passwordResetUrl } from "@/lib/passwordReset";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Nieprawidłowy e-mail." }, { status: 400 });

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });

  // Always respond the same way whether or not the account exists,
  // so this endpoint can't be used to enumerate registered emails.
  const genericResponse = { ok: true, message: "Jeśli konto istnieje, wysłaliśmy link do resetu hasła." };

  if (!user) return NextResponse.json(genericResponse);

  const rawToken = await createPasswordResetToken(user.id);
  const resetUrl = passwordResetUrl(rawToken);

  await sendEmail({
    to: user.email,
    subject: "Reset hasła — Bankmiplaci",
    html: passwordResetEmailHtml(resetUrl)
  });

  const isDev = process.env.NODE_ENV !== "production";
  if (isDev) {
    // eslint-disable-next-line no-console
    console.log(`[dev] Link resetu hasła dla ${user.email}: ${resetUrl}`);
  }
  return NextResponse.json(isDev ? { ...genericResponse, devResetUrl: resetUrl } : genericResponse);
}
