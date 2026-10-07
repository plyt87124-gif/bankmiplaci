import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { PROMO_WATCH_TYPES } from "@/lib/adminNotificationTypes";

// "PROMO_WATCH" is a bell that groups every offer-monitoring notification type.
const typeFilter = (t: string | undefined) => (t === "PROMO_WATCH" ? { in: PROMO_WATCH_TYPES } : (t as never));

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const type = request.nextUrl.searchParams.get("type") ?? undefined;

  const notifications = await db.adminNotification.findMany({
    where: { type: typeFilter(type), read: false },
    orderBy: { createdAt: "desc" },
    take: 20
  });

  return NextResponse.json({ notifications });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const id = body?.id as string | undefined;
  const markAllType = body?.markAllType as string | undefined;

  if (id) {
    await db.adminNotification.update({ where: { id }, data: { read: true } });
  } else if (markAllType) {
    await db.adminNotification.updateMany({ where: { type: typeFilter(markAllType), read: false }, data: { read: true } });
  }

  return NextResponse.json({ ok: true });
}
