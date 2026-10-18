import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { getSwitchAccounts } from "@/lib/adminAccounts";
import { clearUserSession, createUserSession } from "@/lib/userSession";

export const dynamic = "force-dynamic";

/**
 * Admin only: starts (or ends) the visitor session of one of the owner's two
 * own accounts without a password, so the owner can flip between "admin
 * testing" and "ordinary user" with one click (see lib/adminAccounts.ts).
 * Anyone without an admin session gets 401 and nothing happens.
 *
 * Body: { account: "tester" | "own" | "none" }.
 */
export async function POST(request: Request) {
  if (!(await getServerSession(authOptions))) {
    return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { account?: unknown } | null;
  const account = body?.account;

  if (account === "none") {
    await clearUserSession();
    return NextResponse.json({ ok: true, name: null });
  }

  const target = getSwitchAccounts().find((a) => a.key === account);
  if (!target) {
    return NextResponse.json({ error: "Nieznane konto albo brak ustawienia w zmiennych środowiskowych." }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { email: target.email }, select: { id: true, name: true } });
  if (!user) {
    return NextResponse.json(
      { error: `Konto ${target.email} nie istnieje - zarejestruj je zwykłą rejestracją na stronie.` },
      { status: 404 }
    );
  }

  await createUserSession(user.id);
  return NextResponse.json({ ok: true, name: user.name });
}
