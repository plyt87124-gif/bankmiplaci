import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { resetPasswordSchema } from "@/lib/validation/account";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane." }, { status: 400 });
  }

  const tokenRecord = await db.passwordResetToken.findUnique({ where: { tokenHash: hashToken(parsed.data.token) } });

  if (!tokenRecord || tokenRecord.usedAt || tokenRecord.expiresAt < new Date()) {
    return NextResponse.json({ error: "Link jest nieprawidłowy lub wygasł. Wygeneruj nowy." }, { status: 400 });
  }

  await db.$transaction([
    db.user.update({
      where: { id: tokenRecord.userId },
      data: { passwordHash: await bcrypt.hash(parsed.data.password, 12) }
    }),
    db.passwordResetToken.update({ where: { id: tokenRecord.id }, data: { usedAt: new Date() } })
  ]);

  return NextResponse.json({ ok: true });
}
