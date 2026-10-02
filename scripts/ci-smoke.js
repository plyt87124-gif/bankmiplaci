/**
 * CI smoke test against a production build (`next start`) and an EMPTY test
 * database that already has the migrations applied. Refuses to run unless
 * DATABASE_URL points at localhost. Creates throw-away fixtures, asserts the
 * HTTP behaviour that matters for this branch, deletes the fixtures.
 *
 * Two phases, because /sitemap.xml is prerendered at BUILD time (ISR, hourly
 * revalidate) - the fixtures must exist before `next build` to appear in it:
 *
 *   node scripts/ci-smoke.js seed      # creates the fixtures
 *   npm run build
 *   node scripts/ci-smoke.js verify    # starts `next start`, asserts, deletes the fixtures
 */
const { spawn } = require("child_process");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");

if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "")) {
  console.error("Refusing to run: DATABASE_URL is not a local/test database.");
  process.exit(1);
}

const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const PORT = 3999;
const BASE = `http://localhost:${PORT}`;
const SESSION_EMAIL = "ci-smoke-session@example.test";
const SESSION_PASSWORD = "CI-only-session-test-2026";
const day = (iso) => new Date(`${iso}T00:00:00Z`);
const warsawToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const warsawYesterday = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() - 86400000));
const warsawNextMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + 40 * 86400000));

async function get(path, opts = {}) {
  const res = await fetch(BASE + path, { redirect: "manual", ...opts });
  return { status: res.status, location: res.headers.get("location"), type: res.headers.get("content-type"), cookie: res.headers.get("set-cookie"), text: res.status < 300 || res.status >= 400 ? await res.text() : "" };
}
const robots = (html) => (html.match(/<meta name="robots" content="([^"]*)"/) ?? [])[1];

async function seed() {
  const bank = await db.bank.create({ data: { name: "CI Bank", slug: "ci-bank" } });
  await db.user.create({ data: {
    email: SESSION_EMAIL, username: "ci_smoke_session", name: "Smoke CI",
    passwordHash: await bcrypt.hash(SESSION_PASSWORD, 4)
  } });
  const base = {
    bankId: bank.id, accountType: "PERSONAL", maxBonusCents: 150000, difficulty: "EASY", rating: 9,
    startDate: day("2026-01-01"), lastVerifiedAt: day("2026-10-02"), affiliateUrl: "https://example.com/partner"
  };
  const mk = (slug, o) => db.promotion.create({ data: { ...base, name: slug, slug, ...o } });
  await mk("ci-open", { status: "ACTIVE", endDate: day(warsawNextMonth), contentUpdatedAt: new Date() });
  await mk("ci-lastday", { status: "ACTIVE", endDate: day(warsawToday) });
  await mk("ci-pastdeadline", { status: "ACTIVE", endDate: day(warsawYesterday) });
  await mk("ci-notpromoted", { status: "EXPIRED", endDate: day(warsawNextMonth) });
  await mk("ci-affoff", { status: "ACTIVE", endDate: day(warsawNextMonth), affiliateLinkEnabled: false });
  // fees cleared by an administrator are stored as NULL and must read "Nieustalone", never "0 zł"
  await mk("ci-nullfees", {
    status: "ACTIVE", endDate: day(warsawNextMonth),
    fees: { create: { accountFeeCents: null, cardFeeCents: null, atmFeeCents: null } }
  });
  await mk("ci-closedpart", {
    status: "ACTIVE", endDate: day(warsawNextMonth),
    bonusParts: { create: [{ label: "Konto", amountCents: 150000, order: 0 }, { label: "Kantor ZAMKNIETY", amountCents: 30000, order: 1, availableUntil: day("2026-09-30") }] }
  });
}

async function cleanup() {
  await db.user.deleteMany({ where: { email: SESSION_EMAIL } });
  await db.promotion.deleteMany({ where: { slug: { startsWith: "ci-" } } });
  await db.bank.deleteMany({ where: { slug: "ci-bank" } });
}

async function verify() {
  const server = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "-p", String(PORT)], { stdio: "inherit", env: process.env });
  try {
    for (let i = 0; i < 60; i++) {
      try { if ((await get("/jak-to-dziala")).status === 200) break; } catch {}
      await new Promise((r) => setTimeout(r, 1000));
      assert.ok(i < 59, "server did not start");
    }

    // pages & assets that must exist
    assert.equal((await get("/")).status, 200);
    assert.equal((await get("/jak-to-dziala")).status, 200, "/jak-to-dziala (was a 404)");
    assert.equal((await get("/porownaj?typ=PERSONAL&liczba=4")).status, 200, "async searchParams on comparison page");
    assert.equal((await get("/api/promotions/ci-open/comments")).status, 200, "async params on comments route");

    // Next 15 makes cookies() asynchronous. Verify the real login -> account -> logout flow.
    assert.equal((await get("/konto")).status, 307, "anonymous account request redirects to login");
    const login = await get("/api/account/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: SESSION_EMAIL, password: SESSION_PASSWORD })
    });
    assert.equal(login.status, 200, "login succeeds");
    assert.ok(login.cookie?.startsWith("premia_session="), "login writes a session cookie");
    const sessionCookie = login.cookie.split(";")[0];
    assert.equal((await get("/konto?onboarding=1", { headers: { Cookie: sessionCookie } })).status, 200, "async cookies read the logged-in account");
    const logout = await get("/api/account/logout", { method: "POST", headers: { Cookie: sessionCookie } });
    assert.equal(logout.status, 200, "logout succeeds");
    assert.ok(logout.cookie?.startsWith("premia_session=;"), "logout clears the cookie before sending the response");
    assert.equal((await get("/konto")).status, 307, "account redirects after browser discards the cleared cookie");
    const og = await get("/opengraph-image");
    assert.equal(og.status, 200, "/opengraph-image builds and serves on Linux");
    assert.match(og.type ?? "", /image\/png/);

    // sign-up window: last day open, day after closed, not-promoted closed
    assert.equal((await get("/out/ci-open")).status, 302);
    assert.equal((await get("/out/ci-open")).location, "https://example.com/partner");
    assert.equal((await get("/out/ci-lastday")).status, 302, "last day is still open (Polish calendar)");
    for (const slug of ["ci-pastdeadline", "ci-notpromoted"]) {
      const r = await get(`/out/${slug}`);
      assert.equal(r.status, 307, slug);
      assert.match(r.location ?? "", /\/promocje\?niedostepna=1$/, slug);
    }

    // affiliate link OFF: offer shown, no partner link anywhere, /out refuses
    const off = await get("/out/ci-affoff");
    assert.equal(off.status, 307);
    assert.match(off.location ?? "", /\/promocje\/ci-affoff$/);
    const offPage = await get("/promocje/ci-affoff");
    assert.equal(offPage.status, 200);
    assert.ok(!offPage.text.includes("Przejdź do promocji"), "no CTA when the partner link is off");
    assert.ok(!offPage.text.includes('href="/out/'), "no /out/ link when the partner link is off");
    assert.match(offPage.text, /nie udostępniamy obecnie naszego linku/);
    assert.equal(robots(offPage.text), "index, follow");

    // indexing is separate from availability
    assert.equal(robots((await get("/promocje/ci-pastdeadline")).text), "index, follow");
    assert.equal(robots((await get("/promocje/ci-notpromoted")).text), "noindex, follow");

    // cleared (NULL) fees show as "Nieustalone" on the page, never as a free "0 zł"
    const nf = (await get("/promocje/ci-nullfees")).text;
    assert.ok((nf.match(/Nieustalone/g) ?? []).length >= 3, "fee stat + both fee rows say Nieustalone");
    assert.ok(!nf.includes("0 zł*"), "no fake free marker");

    // closed bonus part is listed apart and not summed
    const cp = (await get("/promocje/ci-closedpart")).text;
    assert.match(cp, /Zakończone dla nowych uczestników/);
    assert.match(cp, /Kantor ZAMKNIETY/);

    // sitemap: open ones in, closed/not-promoted out; <lastmod> only where a real date is known
    const sm = (await get("/sitemap.xml")).text;
    for (const s of ["ci-open", "ci-lastday", "ci-affoff", "ci-closedpart"]) assert.ok(sm.includes(`/promocje/${s}<`), `${s} in sitemap`);
    for (const s of ["ci-pastdeadline", "ci-notpromoted"]) assert.ok(!sm.includes(`/promocje/${s}<`), `${s} not in sitemap`);
    assert.ok(sm.includes("/jak-to-dziala<"));
    const entry = (slug) => (sm.match(new RegExp(`<url>\\s*<loc>[^<]*/promocje/${slug}</loc>([\\s\\S]*?)</url>`)) ?? [])[1] ?? "";
    assert.ok(entry("ci-open").includes("<lastmod>"), "known contentUpdatedAt -> lastmod");
    assert.ok(!entry("ci-lastday").includes("<lastmod>"), "unknown date -> no lastmod");

    console.log("ci-smoke: all checks passed");
  } finally {
    server.kill();
    await cleanup();
    await db.$disconnect();
  }
}

async function main() {
  const mode = process.argv[2];
  if (mode === "seed") {
    await cleanup();
    await seed();
    await db.$disconnect();
    console.log("ci-smoke: fixtures created");
  } else if (mode === "verify") {
    await verify();
  } else {
    throw new Error("usage: node scripts/ci-smoke.js seed|verify");
  }
}

main().catch(async (e) => {
  console.error("ci-smoke FAILED:", e);
  await cleanup().catch(() => {});
  process.exit(1);
});
