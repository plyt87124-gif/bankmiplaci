import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Unread notification count per type — used to light up the sidebar
 * badges (Komentarze, Użytkownicy, Przypomnienia karencja) without
 * pulling the full item list (which the bells cap at 20).
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.adminNotification.groupBy({
    by: ["type"],
    where: { read: false },
    _count: { _all: true }
  });

  const counts = Object.fromEntries(rows.map((r) => [r.type, r._count._all]));
  return NextResponse.json({ counts });
}
