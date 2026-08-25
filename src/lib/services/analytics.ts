import { db } from "@/lib/db";

export interface DailyCount {
  date: string; // "YYYY-MM-DD"
  count: number;
}

interface DailyCountRow {
  day: Date;
  count: bigint;
}

/**
 * Prisma's groupBy can't truncate a timestamp to a day, so daily trends go
 * through a raw query. Table name is passed in (not user input) — always a
 * hardcoded literal at the call site below, never interpolated from a request.
 */
async function dailyTrend(table: "page_views" | "clicks" | "impressions", days: number): Promise<DailyCount[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db.$queryRawUnsafe<DailyCountRow[]>(
    `SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*)::bigint AS count
     FROM "${table}"
     WHERE "createdAt" >= $1
     GROUP BY day
     ORDER BY day ASC`,
    since
  );

  // Fill in zero-count days so the chart doesn't skip gaps.
  const byDate = new Map(rows.map((r) => [r.day.toISOString().slice(0, 10), Number(r.count)]));
  const result: DailyCount[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    result.push({ date: d, count: byDate.get(d) ?? 0 });
  }
  return result;
}

/**
 * Unique visitors per day — de-duplicated by ipHash (falling back to
 * sessionId for the rare row where the IP couldn't be read), not a raw
 * hit count. A visitor reloading the same page 10 times counts once.
 */
export async function getPageViewsTrend(days = 30): Promise<DailyCount[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db.$queryRaw<DailyCountRow[]>`
    SELECT DATE_TRUNC('day', "createdAt") AS day,
           COUNT(DISTINCT COALESCE("ipHash", "sessionId"))::bigint AS count
    FROM "page_views"
    WHERE "createdAt" >= ${since}
    GROUP BY day
    ORDER BY day ASC`;

  const byDate = new Map(rows.map((r) => [r.day.toISOString().slice(0, 10), Number(r.count)]));
  const result: DailyCount[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    result.push({ date: d, count: byDate.get(d) ?? 0 });
  }
  return result;
}

export function getClicksTrend(days = 30) {
  return dailyTrend("clicks", days);
}

/** Unique visitors per page, same ipHash-based de-duplication as above. */
export async function getPageBreakdown(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db.$queryRaw<{ path: string; count: bigint }[]>`
    SELECT "path", COUNT(DISTINCT COALESCE("ipHash", "sessionId"))::bigint AS count
    FROM "page_views"
    WHERE "createdAt" >= ${since}
    GROUP BY "path"
    ORDER BY count DESC
    LIMIT 10`;
  return rows.map((r) => ({ path: r.path, count: Number(r.count) }));
}

export async function getTopPromotionsByMetric(metric: "impressions" | "clicks", limit = 10) {
  const promotions = await db.promotion.findMany({
    take: limit,
    include: { bank: true, _count: { select: { clicks: true, impressions: true } } },
    orderBy: { [metric]: { _count: "desc" } }
  });

  return promotions.map((p) => ({
    id: p.id,
    name: `${p.bank.name} — ${p.name}`,
    impressions: p._count.impressions,
    clicks: p._count.clicks,
    ctr: p._count.impressions > 0 ? Number(((p._count.clicks / p._count.impressions) * 100).toFixed(1)) : 0
  }));
}

export async function getTrafficTotals(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [uniquePageViewsRows, clicks, uniqueVisitors] = await Promise.all([
    // Unique visitors (by ipHash) across the whole window — NOT a sum of
    // the daily-unique trend above, which would double-count someone who
    // visited on multiple different days.
    db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT COALESCE("ipHash", "sessionId"))::bigint AS count
      FROM "page_views"
      WHERE "createdAt" >= ${since}`,
    db.click.count({ where: { createdAt: { gte: since } } }),
    db.pageView.findMany({
      where: { createdAt: { gte: since }, userId: { not: null } },
      distinct: ["userId"],
      select: { userId: true }
    })
  ]);

  return { pageViews: Number(uniquePageViewsRows[0]?.count ?? 0), clicks, uniqueLoggedInVisitors: uniqueVisitors.length };
}
