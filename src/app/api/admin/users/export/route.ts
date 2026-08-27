import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function escapeCsv(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Exports the users list (respecting the same q/active filters as the admin page) as CSV. */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const activeOnly = searchParams.get("active") === "1";
  const activeSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const users = await db.user.findMany({
    where: {
      ...(activeOnly ? { lastLoginAt: { gte: activeSince } } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
              { username: { contains: q, mode: "insensitive" } }
            ]
          }
        : {})
    },
    orderBy: { createdAt: "desc" },
    select: {
      email: true,
      name: true,
      username: true,
      createdAt: true,
      lastLoginAt: true,
      _count: { select: { clicks: true, comments: true, impressions: true, promotionTracking: true } }
    }
  });

  const header = ["Email", "Imię", "Nazwa użytkownika", "Data rejestracji", "Ostatnie logowanie", "Wyświetlenia", "Kliknięcia", "Komentarze", "Ściągi"].join(",");
  const rows = users.map((u) =>
    [
      u.email,
      u.name ?? "",
      u.username ?? "",
      u.createdAt.toISOString(),
      u.lastLoginAt?.toISOString() ?? "",
      u._count.impressions,
      u._count.clicks,
      u._count.comments,
      u._count.promotionTracking
    ]
      .map(escapeCsv)
      .join(",")
  );

  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="uzytkownicy-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
