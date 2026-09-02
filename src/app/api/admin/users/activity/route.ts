import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [users, lastPageViews] = await Promise.all([
    db.user.findMany({ select: { id: true, lastLoginAt: true } }),
    // PageView fires on every page navigation while logged in (see
    // PageViewTracker), not just at login — a much fresher "was actually
    // browsing" signal than lastLoginAt, which is what lets the "online
    // now" tier exist at all.
    db.pageView.groupBy({ by: ["userId"], where: { userId: { not: null } }, _max: { createdAt: true } })
  ]);

  const lastSeenByUserId = new Map(lastPageViews.map((row) => [row.userId as string, row._max.createdAt]));

  const result = users.map((u) => {
    const lastPageViewAt = lastSeenByUserId.get(u.id) ?? null;
    const lastSeenAt =
      lastPageViewAt && (!u.lastLoginAt || lastPageViewAt > u.lastLoginAt) ? lastPageViewAt : u.lastLoginAt;
    return { id: u.id, lastSeenAt: lastSeenAt?.toISOString() ?? null };
  });

  return NextResponse.json({ users: result, serverTime: new Date().toISOString() });
}
