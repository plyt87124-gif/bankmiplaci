import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validation/account";
import { createUserSession } from "@/lib/userSession";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }

  const user = await db.user.findFirst({
    where: { OR: [{ email: parsed.data.identifier }, { username: parsed.data.identifier }] }
  });
  const valid = user ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false;

  // Deliberately generic error — never reveal whether the account exists.
  if (!user || !valid) {
    return NextResponse.json({ error: "Nieprawidłowe dane logowania." }, { status: 401 });
  }

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createUserSession(user.id);
  return NextResponse.json({ ok: true });
}
