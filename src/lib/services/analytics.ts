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

/** Traffic origin, same ipHash-based de-duplication as getPageBreakdown — a visitor who lands via search and then browses 5 pages counts once under "search", not once per page. */
export async function getSourceBreakdown(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db.$queryRaw<{ source: string; count: bigint }[]>`
    SELECT COALESCE("source", 'direct') AS source, COUNT(DISTINCT COALESCE("ipHash", "sessionId"))::bigint AS count
    FROM "page_views"
    WHERE "createdAt" >= ${since}
    GROUP BY source
    ORDER BY count DESC
    LIMIT 10`;
  return rows.map((r) => ({ source: r.source, count: Number(r.count) }));
}

/**
 * Aggregate engagement with the ściąga ("cheat sheet") feature across all
 * users — how many are actively tracking a promotion, how many finished
 * one, and on average how far through their checklist the active ones are.
 */
export async function getChecklistStats() {
  const [activeCount, completedCount, activeTrackings] = await Promise.all([
    db.userPromotionTracking.count({ where: { completedAt: null } }),
    db.userPromotionTracking.count({ where: { completedAt: { not: null } } }),
    db.userPromotionTracking.findMany({
      where: { completedAt: null },
      select: { userId: true, promotion: { select: { checklistSteps: { select: { id: true, rewardCents: true } } } } }
    })
  ]);

  if (activeTrackings.length === 0) {
    return { activeCount, completedCount, avgProgressPercent: 0 };
  }

  const userIds = [...new Set(activeTrackings.map((t) => t.userId))];
  const progress = await db.checklistProgress.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, stepId: true }
  });
  const checkedByUser = new Map<string, Set<string>>();
  for (const p of progress) {
    const set = checkedByUser.get(p.userId) ?? new Set<string>();
    set.add(p.stepId);
    checkedByUser.set(p.userId, set);
  }

  let totalPercent = 0;
  let counted = 0;
  for (const t of activeTrackings) {
    const actionSteps = t.promotion.checklistSteps.filter((s) => s.rewardCents === null);
    if (actionSteps.length === 0) continue;
    const checked = checkedByUser.get(t.userId) ?? new Set<string>();
    const done = actionSteps.filter((s) => checked.has(s.id)).length;
    totalPercent += (done / actionSteps.length) * 100;
    counted += 1;
  }

  return { activeCount, completedCount, avgProgressPercent: counted > 0 ? Math.round(totalPercent / counted) : 0 };
}

/**
 * Site-wide karencja-cleared email funnel: how many emails went out, how
 * many of those links were opened, and how many of those visits ended in
 * a "Przejdź do promocji" click (matched via the same campaign-token
 * mechanism as the per-user view on /admin/przypomnienia-karencja).
 */
export async function getEligibilityFunnelStats() {
  const rows = await db.userBankHistory.findMany({
    where: { eligibilityNotifiedAt: { not: null } },
    select: { eligibilityEmailToken: true, eligibilityLinkClickedAt: true }
  });

  const emailsSent = rows.length;
  const linksClicked = rows.filter((r) => r.eligibilityLinkClickedAt !== null).length;

  const tokens = rows.map((r) => r.eligibilityEmailToken).filter((t): t is string => !!t);
  const ctaClicked =
    tokens.length > 0
      ? (
          await db.click.findMany({
            where: { campaign: { in: tokens } },
            select: { campaign: true },
            distinct: ["campaign"]
          })
        ).length
      : 0;

  return { emailsSent, linksClicked, ctaClicked };
}

/**
 * Impressions/clicks summed per bank (not just per promotion) — a fan-out
 * join (bank -> promotions -> impressions/clicks), so counts are kept
 * DISTINCT per side to avoid inflation from the join itself.
 */
export async function getBankBreakdown(days = 30, limit = 10) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db.$queryRaw<{ name: string; impressions: bigint; clicks: bigint }[]>`
    SELECT b.name AS name,
           COUNT(DISTINCT i.id)::bigint AS impressions,
           COUNT(DISTINCT c.id)::bigint AS clicks
    FROM banks b
    JOIN promotions p ON p."bankId" = b.id
    LEFT JOIN impressions i ON i."promotionId" = p.id AND i."createdAt" >= ${since}
    LEFT JOIN clicks c ON c."promotionId" = p.id AND c."createdAt" >= ${since}
    GROUP BY b.id, b.name
    HAVING COUNT(DISTINCT i.id) > 0 OR COUNT(DISTINCT c.id) > 0
    ORDER BY impressions DESC
    LIMIT ${limit}`;
  return rows.map((r) => ({ name: r.name, impressions: Number(r.impressions), clicks: Number(r.clicks) }));
}

export interface CampaignBreakdownRow {
  utmSource: string;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  impressions: number;
  clicks: number;
  ctr: number;
}

interface CampaignGroupRow {
  utmSource: string;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  count: bigint;
}

/**
 * Clicks/impressions grouped by UTM attribution (utm_source/medium/
 * campaign/content — see docs/marketing/utm-standard.md). Impressions and
 * clicks are two separate tables with their own utm_* columns (captured
 * independently, at view-time and click-time), so this runs two GROUP BYs
 * and merges them in JS by the (source, medium, campaign, content) key —
 * simpler and safer than an SQL join across two unrelated tables, and
 * avoids fan-out entirely.
 */
export async function getCampaignBreakdown(days = 30): Promise<CampaignBreakdownRow[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [impressionRows, clickRows] = await Promise.all([
    db.$queryRaw<CampaignGroupRow[]>`
      SELECT "utmSource", "utmMedium", "utmCampaign", "utmContent", COUNT(*)::bigint AS count
      FROM "impressions"
      WHERE "utmSource" IS NOT NULL AND "createdAt" >= ${since}
      GROUP BY "utmSource", "utmMedium", "utmCampaign", "utmContent"`,
    db.$queryRaw<CampaignGroupRow[]>`
      SELECT "utmSource", "utmMedium", "utmCampaign", "utmContent", COUNT(*)::bigint AS count
      FROM "clicks"
      WHERE "utmSource" IS NOT NULL AND "createdAt" >= ${since}
      GROUP BY "utmSource", "utmMedium", "utmCampaign", "utmContent"`
  ]);

  const keyOf = (r: CampaignGroupRow) => [r.utmSource, r.utmMedium, r.utmCampaign, r.utmContent].join(" ");

  const merged = new Map<string, CampaignBreakdownRow>();
  for (const r of impressionRows) {
    merged.set(keyOf(r), {
      utmSource: r.utmSource,
      utmMedium: r.utmMedium,
      utmCampaign: r.utmCampaign,
      utmContent: r.utmContent,
      impressions: Number(r.count),
      clicks: 0,
      ctr: 0
    });
  }
  for (const r of clickRows) {
    const k = keyOf(r);
    const existing = merged.get(k);
    if (existing) existing.clicks = Number(r.count);
    else
      merged.set(k, {
        utmSource: r.utmSource,
        utmMedium: r.utmMedium,
        utmCampaign: r.utmCampaign,
        utmContent: r.utmContent,
        impressions: 0,
        clicks: Number(r.count),
        ctr: 0
      });
  }

  return Array.from(merged.values())
    .map((r) => ({ ...r, ctr: r.impressions > 0 ? Number(((r.clicks / r.impressions) * 100).toFixed(1)) : 0 }))
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
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
