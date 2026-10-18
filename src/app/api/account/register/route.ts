import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createUserSession } from "@/lib/userSession";
import { parseRegisterRequest, TERMS_VERSION } from "./registerInput";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  // Includes the required terms consent (acceptTerms === true): the browser
  // check is only a convenience, this one is the authoritative one.
  const parsed = parseRegisterRequest(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error, field: parsed.field }, { status: 400 });
  }

  const existingEmail = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (existingEmail) {
    return NextResponse.json({ error: "Konto z tym adresem e-mail już istnieje.", field: "email" }, { status: 409 });
  }

  const existingUsername = await db.user.findUnique({ where: { username: parsed.data.username } });
  if (existingUsername) {
    return NextResponse.json({ error: "Ta nazwa użytkownika jest już zajęta.", field: "username" }, { status: 409 });
  }

  let user;
  try {
    user = await db.user.create({
      data: {
        email: parsed.data.email,
        username: parsed.data.username,
        name: parsed.data.name || null,
        passwordHash: await bcrypt.hash(parsed.data.password, 12),
        lastLoginAt: new Date(),
        // Proof of consent: when and to which version of the terms.
        termsAcceptedAt: new Date(),
        termsVersion: TERMS_VERSION
      }
    });
  } catch (error) {
    // Two sign-ups racing for the same e-mail/username pass the checks above
    // together; the unique index decides and the loser gets a clear message.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = String(error.meta?.target ?? "");
      if (target.includes("username")) {
        return NextResponse.json({ error: "Ta nazwa użytkownika jest już zajęta.", field: "username" }, { status: 409 });
      }
      return NextResponse.json({ error: "Konto z tym adresem e-mail już istnieje.", field: "email" }, { status: 409 });
    }
    throw error;
  }

  // Surface it to the admin as an in-app notification (see the bell icon
  // in /admin). Never let a notification-write failure block signup.
  try {
    await db.adminNotification.create({
      data: {
        type: "NEW_USER",
        title: "Nowe konto użytkownika",
        body: `${user.name || user.username} (${user.email}) założył/a konto.`,
        relatedUserId: user.id
      }
    });
  } catch {
    // Never let a notification-write failure block signup.
  }

  await createUserSession(user.id);
  return NextResponse.json({ ok: true });
}
