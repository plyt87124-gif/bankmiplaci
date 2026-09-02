import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // lastActiveAt is touched on every authenticated pageview (see
  // /api/track/pageview), unconditionally — including for internal/owner
  // accounts excluded from visit-count analytics via isInternalUser. Using
  // it directly (instead of a PageView groupBy) is both simpler and
  // correct for those accounts, which previously showed stale/wrong tiers
  // here because they never got a PageView row written at all.
  const users = await db.user.findMany({ select: { id: true, lastLoginAt: true, lastActiveAt: true } });

  const result = users.map((u) => {
    const lastSeenAt =
      u.lastActiveAt && (!u.lastLoginAt || u.lastActiveAt > u.lastLoginAt) ? u.lastActiveAt : u.lastLoginAt;
    return { id: u.id, lastSeenAt: lastSeenAt?.toISOString() ?? null };
  });

  return NextResponse.json({ users: result, serverTime: new Date().toISOString() });
}
