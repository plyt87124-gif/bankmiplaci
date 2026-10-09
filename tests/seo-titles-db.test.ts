import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { DESCRIPTION_MAX, PROMOTION_TITLE_MAX, makeDescription, promotionHeading, promotionTitle } from "../src/lib/seo/metadata";

/**
 * Same uniqueness guarantee as seo-titles.test.ts, but on the REAL offers of
 * the local database (read-only). Skipped - never failed - when no local
 * database is reachable (CI without Postgres, a fresh checkout), so it cannot
 * make `npm test` flaky; the hard-coded catalogue in seo-titles.test.ts is
 * the always-on version.
 */

function localDatabaseUrl(): string | null {
  let url = process.env.DATABASE_URL;
  if (!url && fs.existsSync(".env")) {
    for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
      const m = line.match(/^DATABASE_URL="?([^"]+)"?$/);
      if (m) url = m[1];
    }
  }
  // Never read from anything but a local database.
  return url && /@(localhost|127\.0\.0\.1)[:/]/.test(url) ? url : null;
}

async function loadOffers() {
  const url = localDatabaseUrl();
  if (!url) return null;
  const client = new PrismaClient({ datasources: { db: { url } } });
  try {
    const rows = await Promise.race([
      client.promotion.findMany({
        where: { status: { in: ["ACTIVE", "EXPIRED"] } },
        select: {
          slug: true,
          name: true,
          accountType: true,
          maxBonusCents: true,
          summary: true,
          endDate: true,
          lastVerifiedAt: true,
          bank: { select: { name: true } }
        }
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000))
    ]);
    return rows;
  } catch {
    return null;
  } finally {
    await client.$disconnect().catch(() => undefined);
  }
}

test("real offers in the local database: unique titles and headings, title <= 60, description <= 160", async (t) => {
  const offers = await loadOffers();
  if (!offers || offers.length === 0) {
    t.skip("no local database with offers is reachable");
    return;
  }

  const rows = offers.map((o) => ({
    slug: o.slug,
    title: promotionTitle({ name: o.name, bankName: o.bank.name, accountType: o.accountType, maxBonusCents: o.maxBonusCents }),
    heading: promotionHeading({ name: o.name, bankName: o.bank.name }),
    description: makeDescription(o.summary, {
      bankName: o.bank.name,
      name: o.name,
      endDate: o.endDate,
      lastVerifiedAt: o.lastVerifiedAt,
      now: new Date("2026-10-09T10:00:00Z")
    })
  }));

  for (const r of rows) {
    assert.ok(r.title.trim() !== "", `empty title: ${r.slug}`);
    assert.ok(r.title.length <= PROMOTION_TITLE_MAX, `${r.title.length} chars: ${r.title}`);
    assert.ok(r.description.length <= DESCRIPTION_MAX, `${r.description.length} chars: ${r.slug}`);
  }

  const duplicates = (key: "title" | "heading") => {
    const seen = new Map<string, string[]>();
    for (const r of rows) seen.set(r[key], [...(seen.get(r[key]) ?? []), r.slug]);
    return [...seen.entries()].filter(([, slugs]) => slugs.length > 1);
  };
  assert.deepEqual(duplicates("title"), [], "offers share a <title>");
  assert.deepEqual(duplicates("heading"), [], "offers share an H1");
});
