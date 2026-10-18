/**
 * /admin/statystyki vs a tiny connection pool — hermetic regression test.
 *
 * WHAT THIS IS: a deterministic MODEL of a connection queue (pool of N
 * slots, fixed per-query hold time, pool timeout on *waiting for a slot*,
 * all on a virtual clock). The fake `db` below is installed as the
 * `globalThis.prisma` singleton that src/lib/db.ts reuses, so the REAL
 * src/lib/services/analytics.ts code runs against it — including the nested
 * queries inside getTrafficTotals / getChecklistStats /
 * getEligibilityFunnelStats / getCampaignBreakdown. No database, no .env,
 * no network; a PrismaClient is never constructed.
 *
 * WHAT THIS IS NOT: a reproduction of Prisma's pool or proof of the
 * production cause. The P2024 thrown here is the model's own error carrying
 * Prisma's code, raised when a query waits for a slot longer than the
 * timeout (Prisma's P2024 is also about acquiring a connection, not about a
 * query that already started). Fetching sequentially bounds the queue a
 * single page load creates; it does not stop OTHER concurrent requests from
 * exhausting the pool.
 */
import test, { mock } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Virtual-clock connection pool
// ---------------------------------------------------------------------------

interface Timer {
  at: number;
  seq: number;
  fn: () => void;
  cancelled: boolean;
}

class PoolTimeoutError extends Error {
  code = "P2024";
  constructor(waitedMs: number) {
    super(`Timed out fetching a new connection from the (model) connection pool after ${waitedMs}ms`);
  }
}

class VirtualPool {
  now = 0;
  private timers: Timer[] = [];
  private seq = 0;
  private busy = 0;
  private waiters: { resolve: () => void; timer: Timer }[] = [];
  private queryCount = 0;
  maxInFlight = 0;
  maxWaiting = 0;
  readonly log: string[] = [];

  constructor(
    readonly size: number,
    readonly queryMs: number,
    readonly poolTimeoutMs: number,
    /** 1-based index of a query that should fail (to check errors are not masked). */
    readonly failQueryNo?: number
  ) {}

  private schedule(ms: number, fn: () => void): Timer {
    const t: Timer = { at: this.now + ms, seq: this.seq++, fn, cancelled: false };
    this.timers.push(t);
    return t;
  }

  private acquire(): Promise<void> {
    if (this.busy < this.size) {
      this.busy++;
      this.maxInFlight = Math.max(this.maxInFlight, this.busy);
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const waiter = {
        resolve,
        timer: this.schedule(this.poolTimeoutMs, () => {
          this.waiters = this.waiters.filter((w) => w !== waiter);
          reject(new PoolTimeoutError(this.poolTimeoutMs));
        })
      };
      this.waiters.push(waiter);
      this.maxWaiting = Math.max(this.maxWaiting, this.waiters.length);
    });
  }

  private release() {
    const next = this.waiters.shift();
    if (next) {
      // Hand the slot straight to the next waiter; `busy` is unchanged.
      next.timer.cancelled = true;
      next.resolve();
    } else {
      this.busy--;
    }
  }

  async run<T>(label: string, result: () => T): Promise<T> {
    this.log.push(label);
    const queryNo = ++this.queryCount;
    await this.acquire();
    await new Promise<void>((resolve) => this.schedule(this.queryMs, resolve));
    this.release();
    if (queryNo === this.failQueryNo) throw new PoolTimeoutError(this.poolTimeoutMs);
    return result();
  }

  /** Runs `start()` to completion, advancing virtual time only when nothing else can progress. */
  async drive<T>(start: () => Promise<T>): Promise<T> {
    let state: { done: false } | { done: true; ok: true; value: T } | { done: true; ok: false; error: unknown } = {
      done: false
    };
    start().then(
      (value) => (state = { done: true, ok: true, value }),
      (error) => (state = { done: true, ok: false, error })
    );
    for (;;) {
      await new Promise((r) => setImmediate(r)); // drain all pending microtasks
      if (state.done) break;
      const live = this.timers.filter((t) => !t.cancelled);
      if (live.length === 0) throw new Error("model deadlock: no timers left and promise unsettled");
      live.sort((a, b) => a.at - b.at || a.seq - b.seq);
      const next = live[0]!;
      this.timers = live.slice(1);
      this.now = next.at;
      next.fn();
    }
    const s = state as { done: true; ok: true; value: T } | { done: true; ok: false; error: unknown };
    if (!s.ok) throw s.error;
    return s.value;
  }
}

// ---------------------------------------------------------------------------
// Fake Prisma client (only the calls analytics.ts makes) + fixtures
// ---------------------------------------------------------------------------

const NOW = Date.parse("2026-10-03T12:00:00.000Z");
const TODAY = new Date("2026-10-03T00:00:00.000Z");
const YESTERDAY = new Date("2026-10-02T00:00:00.000Z");

let pool = new VirtualPool(1, 10, 25);

const label = (name: string, args: unknown) => `${name} ${JSON.stringify(args)}`;
const sqlKey = (sql: string) => sql.replace(/\s+/g, " ").trim();

function rawResult(sql: string): unknown[] {
  if (sql.includes('"utmSource"') && sql.includes('FROM "impressions"')) {
    return [{ utmSource: "newsletter", utmMedium: "email", utmCampaign: "oct", utmContent: null, count: 20n }];
  }
  if (sql.includes('"utmSource"') && sql.includes('FROM "clicks"')) {
    return [
      { utmSource: "newsletter", utmMedium: "email", utmCampaign: "oct", utmContent: null, count: 3n },
      { utmSource: "fb", utmMedium: "social", utmCampaign: null, utmContent: null, count: 1n }
    ];
  }
  if (sql.includes("FROM banks b")) return [{ name: "Erste", impressions: 40n, clicks: 4n }];
  if (sql.includes('GROUP BY "path"')) return [{ path: "/", count: 7n }, { path: "/promocje", count: 4n }];
  if (sql.includes("AS source")) return [{ source: "search", count: 6n }, { source: "direct", count: 2n }];
  if (sql.includes("DATE_TRUNC") && sql.includes('FROM "page_views"')) {
    return [{ day: YESTERDAY, count: 3n }, { day: TODAY, count: 5n }];
  }
  if (sql.includes("DATE_TRUNC") && sql.includes('FROM "clicks"')) return [{ day: TODAY, count: 2n }];
  if (sql.includes('FROM "page_views"')) return [{ count: 9n }];
  throw new Error(`fake db: unexpected SQL ${sqlKey(sql)}`);
}

const steps = [
  { id: "s1", rewardCents: null },
  { id: "s2", rewardCents: null },
  { id: "r1", rewardCents: 5000 }
];

const fakeDb = {
  $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = strings.join("$");
    return pool.run(label(`$queryRaw ${sqlKey(sql)}`, values), () => rawResult(sql));
  },
  $queryRawUnsafe: (sql: string, ...values: unknown[]) =>
    pool.run(label(`$queryRawUnsafe ${sqlKey(sql)}`, values), () => rawResult(sql)),
  promotion: {
    findMany: (args: unknown) =>
      pool.run(label("promotion.findMany", args), () => [
        { id: "p1", name: "Konto Jakie Chcę", bank: { name: "Erste" }, _count: { impressions: 30, clicks: 3 } },
        { id: "p2", name: "Konto Osobiste", bank: { name: "mBank" }, _count: { impressions: 0, clicks: 0 } }
      ])
  },
  userPromotionTracking: {
    count: (args: { where: { completedAt: unknown } }) =>
      pool.run(label("userPromotionTracking.count", args), () => (args.where.completedAt === null ? 3 : 2)),
    findMany: (args: unknown) =>
      pool.run(label("userPromotionTracking.findMany", args), () => [
        { userId: "u1", promotion: { checklistSteps: steps } },
        { userId: "u2", promotion: { checklistSteps: steps } }
      ])
  },
  checklistProgress: {
    findMany: (args: unknown) =>
      pool.run(label("checklistProgress.findMany", args), () => [
        { userId: "u1", stepId: "s1" },
        { userId: "u1", stepId: "s2" },
        { userId: "u2", stepId: "s1" }
      ])
  },
  userBankHistory: {
    findMany: (args: unknown) =>
      pool.run(label("userBankHistory.findMany", args), () => [
        { eligibilityEmailToken: "t1", eligibilityLinkClickedAt: TODAY },
        { eligibilityEmailToken: "t2", eligibilityLinkClickedAt: null },
        { eligibilityEmailToken: null, eligibilityLinkClickedAt: null }
      ])
  },
  click: {
    findMany: (args: unknown) => pool.run(label("click.findMany", args), () => [{ campaign: "t1" }]),
    count: (args: unknown) => pool.run(label("click.count", args), () => 12)
  },
  pageView: {
    findMany: (args: unknown) =>
      pool.run(label("pageView.findMany", args), () => [{ userId: "u1" }, { userId: "u2" }])
  }
};

// src/lib/db.ts does `globalThis.prisma ?? new PrismaClient(...)`; installing
// the fake first means the real client is never created.
(globalThis as unknown as { prisma: unknown }).prisma = fakeDb;
mock.method(Date, "now", () => NOW);

type Analytics = typeof import("../src/lib/services/analytics");
let analyticsPromise: Promise<Analytics> | undefined;
const loadAnalytics = () => (analyticsPromise ??= import("../src/lib/services/analytics"));

/** The strategy page.tsx used before this fix: one Promise.all over all 11 getters. */
async function legacyParallelFetch(a: Analytics, days: number) {
  const [
    pageViewsTrend,
    clicksTrend,
    pageBreakdown,
    sourceBreakdown,
    bankBreakdown,
    topByImpressions,
    topByClicks,
    totals,
    checklistStats,
    eligibilityFunnel,
    campaignBreakdown
  ] = await Promise.all([
    a.getPageViewsTrend(days),
    a.getClicksTrend(days),
    a.getPageBreakdown(days),
    a.getSourceBreakdown(days),
    a.getBankBreakdown(days),
    a.getTopPromotionsByMetric("impressions", 10),
    a.getTopPromotionsByMetric("clicks", 10),
    a.getTrafficTotals(days),
    a.getChecklistStats(),
    a.getEligibilityFunnelStats(),
    a.getCampaignBreakdown(days)
  ]);
  return {
    pageViewsTrend,
    clicksTrend,
    pageBreakdown,
    sourceBreakdown,
    bankBreakdown,
    topByImpressions,
    topByClicks,
    totals,
    checklistStats,
    eligibilityFunnel,
    campaignBreakdown
  };
}

// 18 queries per page load (11 getters + nested ones); each holds a slot
// 10ms, a waiter gives up after 25ms. With one slot the 4th queued query
// would get it at t=30ms, so any fan-out beyond 3 hits P2024 deterministically.
const QUERY_MS = 10;
const POOL_TIMEOUT_MS = 25;
const EXPECTED_QUERIES = 18;

// ---------------------------------------------------------------------------

test("model sanity: two concurrent queries on a 1-slot pool with a short timeout fail with P2024", async () => {
  pool = new VirtualPool(1, QUERY_MS, 5);
  await assert.rejects(
    pool.drive(() => Promise.all([fakeDb.click.count({}), fakeDb.click.count({})])),
    (e: unknown) => (e as { code?: string }).code === "P2024"
  );
});

test("previous strategy (Promise.all fan-out) fails with P2024 on a 1-slot pool", async () => {
  const a = await loadAnalytics();
  pool = new VirtualPool(1, QUERY_MS, POOL_TIMEOUT_MS);
  await assert.rejects(
    pool.drive(() => legacyParallelFetch(a, 30)),
    (e: unknown) => (e as { code?: string }).code === "P2024"
  );
  assert.ok(pool.maxWaiting >= 10, `expected a deep queue, got ${pool.maxWaiting}`);
});

test("getStatsPageData (used by page.tsx) completes on the same 1-slot pool with full data", async () => {
  const a = await loadAnalytics();
  pool = new VirtualPool(1, QUERY_MS, POOL_TIMEOUT_MS);
  const data = await pool.drive(() => a.getStatsPageData(30));

  assert.equal(pool.maxInFlight, 1);
  assert.equal(pool.maxWaiting, 0, "a single page load must never queue behind itself");
  assert.equal(pool.log.length, EXPECTED_QUERIES);
  assert.equal(pool.now, EXPECTED_QUERIES * QUERY_MS);

  assert.equal(data.pageViewsTrend.length, 30);
  assert.deepEqual(data.pageViewsTrend.slice(-2), [
    { date: "2026-10-02", count: 3 },
    { date: "2026-10-03", count: 5 }
  ]);
  assert.equal(data.pageViewsTrend.slice(0, -2).every((d) => d.count === 0), true);
  assert.deepEqual(data.clicksTrend.at(-1), { date: "2026-10-03", count: 2 });
  assert.deepEqual(data.pageBreakdown, [
    { path: "/", count: 7 },
    { path: "/promocje", count: 4 }
  ]);
  assert.deepEqual(data.sourceBreakdown, [
    { source: "search", count: 6 },
    { source: "direct", count: 2 }
  ]);
  assert.deepEqual(data.bankBreakdown, [{ name: "Erste", impressions: 40, clicks: 4 }]);
  assert.deepEqual(data.topByImpressions[0], {
    id: "p1",
    name: "Erste — Konto Jakie Chcę",
    impressions: 30,
    clicks: 3,
    ctr: 10
  });
  assert.equal(data.topByClicks.length, 2);
  assert.deepEqual(data.totals, { pageViews: 9, clicks: 12, uniqueLoggedInVisitors: 2 });
  assert.deepEqual(data.checklistStats, { activeCount: 3, completedCount: 2, avgProgressPercent: 75 });
  assert.deepEqual(data.eligibilityFunnel, { emailsSent: 3, linksClicked: 1, ctaClicked: 1 });
  assert.deepEqual(data.campaignBreakdown, [
    { utmSource: "newsletter", utmMedium: "email", utmCampaign: "oct", utmContent: null, impressions: 20, clicks: 3, ctr: 15 },
    { utmSource: "fb", utmMedium: "social", utmCampaign: null, utmContent: null, impressions: 0, clicks: 1, ctr: 0 }
  ]);
});

test("sequential and previous parallel strategy return identical data from identical queries", async () => {
  const a = await loadAnalytics();
  pool = new VirtualPool(64, QUERY_MS, POOL_TIMEOUT_MS); // big enough that the old strategy succeeds
  const legacy = await pool.drive(() => legacyParallelFetch(a, 30));
  const legacyLog = [...pool.log].sort();

  pool = new VirtualPool(1, QUERY_MS, POOL_TIMEOUT_MS);
  const serial = await pool.drive(() => a.getStatsPageData(30));

  assert.deepEqual(serial, legacy);
  assert.deepEqual(Object.keys(serial), Object.keys(legacy), "same props, same order for StatsCharts");
  assert.deepEqual([...pool.log].sort(), legacyLog, "same queries with the same filters/arguments");
});

test("formerly parallel getters no longer fan out internally", async () => {
  const a = await loadAnalytics();
  // Timeout shorter than one query: any internal concurrency would throw P2024.
  const cases: [string, () => Promise<unknown>, number][] = [
    ["getTrafficTotals", () => a.getTrafficTotals(30), 3],
    ["getChecklistStats", () => a.getChecklistStats(), 4],
    ["getCampaignBreakdown", () => a.getCampaignBreakdown(30), 2]
  ];
  for (const [name, run, queries] of cases) {
    pool = new VirtualPool(1, QUERY_MS, 5);
    await pool.drive(run);
    assert.equal(pool.maxWaiting, 0, `${name} queued behind itself`);
    assert.equal(pool.log.length, queries, `${name} query count`);
  }
});

test("a failing query still fails the page — no zero/empty masking", async () => {
  const a = await loadAnalytics();
  for (let n = 1; n <= EXPECTED_QUERIES; n++) {
    pool = new VirtualPool(1, QUERY_MS, POOL_TIMEOUT_MS, n);
    await assert.rejects(
      pool.drive(() => a.getStatsPageData(30)),
      (e: unknown) => (e as { code?: string }).code === "P2024",
      `query #${n} failure was swallowed`
    );
  }
});
