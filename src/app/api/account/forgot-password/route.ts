import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { forgotPasswordSchema } from "@/lib/validation/account";
import { sendEmail } from "@/lib/email";
import { passwordResetEmailHtml } from "@/lib/emailTemplates";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Nieprawidłowy e-mail." }, { status: 400 });

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });

  // Always respond the same way whether or not the account exists,
  // so this endpoint can't be used to enumerate registered emails.
  const genericResponse = { ok: true, message: "Jeśli konto istnieje, wysłaliśmy link do resetu hasła." };

  if (!user) return NextResponse.json(genericResponse);

  const rawToken = crypto.randomBytes(32).toString("hex");
  await db.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) }
  });

  const resetUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/konto/reset-hasla?token=${rawToken}`;

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
