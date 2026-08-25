import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { registerSchema } from "@/lib/validation/account";
import { createUserSession } from "@/lib/userSession";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane." }, { status: 400 });
  }

  const existingEmail = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (existingEmail) {
    return NextResponse.json({ error: "Konto z tym adresem e-mail już istnieje." }, { status: 409 });
  }

  const existingUsername = await db.user.findUnique({ where: { username: parsed.data.username } });
  if (existingUsername) {
    return NextResponse.json({ error: "Ta nazwa użytkownika jest już zajęta." }, { status: 409 });
  }

  const user = await db.user.create({
    data: {
      email: parsed.data.email,
      username: parsed.data.username,
      name: parsed.data.name,
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      lastLoginAt: new Date()
    }
  });

  await createUserSession(user.id);
  return NextResponse.json({ ok: true });
}
