import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AffiliateDisclosure } from "../src/components/AffiliateDisclosure";
import { AffiliateCtaLink } from "../src/components/AffiliateCtaLink";
import { DeadlineBadge } from "../src/components/trust/DeadlineBadge";
import { VerifiedLine } from "../src/components/trust/VerifiedLine";
import { AffiliateLinkBadge, TrustNote } from "../src/components/trust/TrustNote";
import { AFFILIATE_LINK_REL } from "../src/components/trust/affiliateRel";
import { withAttribution } from "../src/components/trust/attributionHref";
import { ATTRIBUTION_MAX_AGE_MS } from "../src/components/AttributionCapture";

// tsx compiles .tsx with the classic JSX transform; give it the global React
// (same trick as tests/jsonld.test.ts).
(globalThis as { React?: typeof React }).React = React;

const NOW = new Date("2026-10-09T10:00:00Z");

const h = React.createElement;
const html = (el: React.ReactElement) => renderToStaticMarkup(el);
/** What a reader sees: tags removed, whitespace collapsed. */
const text = (markup: string) => markup.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const attr = (markup: string, name: string, from = 0) => {
  const m = markup.slice(from).match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? m[1] : null;
};

// ---------------------------------------------------------------------------
// AffiliateDisclosure
// ---------------------------------------------------------------------------








// ---------------------------------------------------------------------------
// TrustNote / AffiliateLinkBadge
// ---------------------------------------------------------------------------

test("trust notes use the shared wording", () => {
  assert.equal(text(html(h(TrustNote, { kind: "notBank" }))), "Nie jesteśmy bankiem ani doradcą. Warunki ustala bank.");
  assert.equal(text(html(h(TrustNote, { kind: "comments" }))), "Opinie użytkowników – nie weryfikujemy ich. Nie stanowią porady.");
  assert.equal(text(html(h(TrustNote, { kind: "rating" }))), "Ocena serwisu, nie porada finansowa.");
  assert.equal(text(html(h(TrustNote, { kind: "referral" }))), "Ta promocja wymaga otwarcia konta przez link lub kod");
  const scope = html(h(TrustNote, { kind: "scope" }));
  assert.match(text(scope), /^Nie obejmujemy całego rynku/);
  assert.match(scope, /href="\/metodologia"/);
  assert.equal(text(html(h(AffiliateLinkBadge, {}))), "Link partnerski");
});

// ---------------------------------------------------------------------------
// AffiliateCtaLink
// ---------------------------------------------------------------------------

test("AFFILIATE_LINK_REL is exactly the required rel", () => {
  assert.equal(AFFILIATE_LINK_REL, "sponsored nofollow noopener noreferrer");
});

test("CTA link: href, rel and target in the server-rendered HTML", () => {
  const out = html(
    h(AffiliateCtaLink, { href: "/out/alior-konto?src=detail-cta", size: "lg" }, "Przejdź do promocji")
  );
  assert.equal(attr(out, "href"), "/out/alior-konto?src=detail-cta".replace(/&/g, "&amp;"));
  assert.equal(attr(out, "rel"), "sponsored nofollow noopener noreferrer");
  assert.equal(attr(out, "target"), "_blank");
  assert.ok(text(out).startsWith("Przejdź do promocji"));
  // Rendered as the design system's cta button: accent fill, trailing arrow icon.
  assert.match(out, /bg-action/);
  assert.match(out, /text-on-action/);
  assert.match(out, /lucide-arrow-right/);
  assert.match(out, /min-h-14/);
});

test("CTA link: rel cannot be weakened by a caller, target can be changed", () => {
  const out = html(
    h(AffiliateCtaLink, { href: "/out/x", rel: "noreferrer", prefetch: true, target: "_self" }, "Otwieram konto")
  );
  assert.equal(attr(out, "rel"), "sponsored nofollow noopener noreferrer");
  assert.equal(attr(out, "target"), "_self");
});

test("CTA link: the 'variant' prop of a caller cannot turn it into a non-cta button", () => {
  const out = html(h(AffiliateCtaLink, { href: "/out/x", variant: "ghost" } as never, "Idź"));
  assert.match(out, /bg-action/);
  assert.match(out, /lucide-arrow-right/);
});

test("CTA link: keeps className and fullWidth of the caller", () => {
  const out = html(h(AffiliateCtaLink, { href: "/out/x", fullWidth: true, className: "mt-5" }, "Idź"));
  assert.match(out, /\bw-full\b/);
  assert.match(out, /\bmt-5\b/);
});

test("CTA link source keeps prefetch off and rel locked (not observable in static markup)", () => {
  const src = readFileSync(join(process.cwd(), "src", "components", "AffiliateCtaLink.tsx"), "utf8");
  // A plain anchor: never next/link (a client-router fetch of /out would hit the redirect twice).
  assert.doesNotMatch(src, /from "next\/link"/);
  assert.doesNotMatch(src, /<ButtonLink/);
  assert.match(src, /<a\b/);
  assert.match(src, /rel=\{AFFILIATE_LINK_REL\}/);
  assert.match(src, /variant: "cta"/);
});

// ---------------------------------------------------------------------------
// withAttribution (the pure half of the CTA link)
// ---------------------------------------------------------------------------

test("withAttribution adds utm_* and traffic_source and keeps src/cmp", () => {
  const href = withAttribution(
    "/out/alior-konto?src=detail-cta&cmp=mail1",
    {
      utm_source: "tiktok",
      utm_medium: "social",
      utm_campaign: "alior01",
      utm_content: "v1",
      utm_term: "konto",
      trafficSource: "social",
      capturedAt: NOW.getTime() - 60_000
    },
    NOW.getTime(),
    ATTRIBUTION_MAX_AGE_MS
  );
  const url = new URL(href, "http://localhost");
  assert.equal(url.pathname, "/out/alior-konto");
  assert.equal(url.searchParams.get("src"), "detail-cta");
  assert.equal(url.searchParams.get("cmp"), "mail1");
  assert.equal(url.searchParams.get("utm_source"), "tiktok");
  assert.equal(url.searchParams.get("utm_medium"), "social");
  assert.equal(url.searchParams.get("utm_campaign"), "alior01");
  assert.equal(url.searchParams.get("utm_content"), "v1");
  assert.equal(url.searchParams.get("utm_term"), "konto");
  assert.equal(url.searchParams.get("traffic_source"), "social");
});

test("withAttribution leaves the href alone without usable attribution", () => {
  const base = "/out/alior-konto?src=detail-cta";
  assert.equal(withAttribution(base, null, NOW.getTime(), ATTRIBUTION_MAX_AGE_MS), base);
  assert.equal(withAttribution(base, undefined, NOW.getTime(), ATTRIBUTION_MAX_AGE_MS), base);
  // expired (older than the 24 h cap)
  assert.equal(
    withAttribution(
      base,
      { utm_source: "x", trafficSource: "direct", capturedAt: NOW.getTime() - ATTRIBUTION_MAX_AGE_MS - 1 },
      NOW.getTime(),
      ATTRIBUTION_MAX_AGE_MS
    ),
    base
  );
  // no timestamp
  assert.equal(
    withAttribution(base, { utm_source: "x", trafficSource: "direct", capturedAt: 0 }, NOW.getTime(), ATTRIBUTION_MAX_AGE_MS),
    base
  );
});

test("withAttribution without utm only adds traffic_source", () => {
  const href = withAttribution(
    "/out/x",
    { trafficSource: "search", capturedAt: NOW.getTime() },
    NOW.getTime(),
    ATTRIBUTION_MAX_AGE_MS
  );
  assert.equal(href, "/out/x?traffic_source=search");
});

// ---------------------------------------------------------------------------
// VerifiedLine / DeadlineBadge
// ---------------------------------------------------------------------------

test("VerifiedLine: fresh, aging, stale and missing dates", () => {
  const fresh = html(h(VerifiedLine, { lastVerifiedAt: "2026-10-07T08:30:00Z", now: NOW }));
  assert.equal(text(fresh), "Zweryfikowano 7 paź 2026");
  assert.match(fresh, /<time dateTime="2026-10-07">7 paź 2026<\/time>/);
  assert.match(fresh, /data-freshness="fresh"/);
  assert.match(fresh, /lucide-shield-check/);
  assert.match(fresh, /text-action/);

  const aging = html(h(VerifiedLine, { lastVerifiedAt: "2026-10-06T08:30:00Z", now: NOW }));
  assert.equal(text(aging), "Zweryfikowano 6 paź 2026");
  assert.match(aging, /data-freshness="aging"/);
  assert.ok(!/text-action/.test(aging));

  const stale = html(h(VerifiedLine, { lastVerifiedAt: "2026-06-01T08:30:00Z", now: NOW }));
  assert.equal(text(stale), "Zweryfikowano 1 cze 2026 – dane mogą być nieaktualne");
  assert.match(stale, /data-freshness="stale"/);

  const none = html(h(VerifiedLine, { lastVerifiedAt: null, now: NOW }));
  assert.equal(text(none), "Brak daty weryfikacji");
  assert.match(none, /data-freshness="unknown"/);
  assert.ok(!/lucide-shield-check/.test(none), "no check mark without a verification date");
  assert.ok(!/<time/.test(none));
});

test("VerifiedLine as a badge", () => {
  const fresh = html(h(VerifiedLine, { lastVerifiedAt: "2026-10-07T08:30:00Z", now: NOW, badge: true }));
  assert.equal(text(fresh), "Zweryfikowano 7 paź 2026");
  assert.match(fresh, /bg-teal-100/);
  const aging = html(h(VerifiedLine, { lastVerifiedAt: "2026-10-06T08:30:00Z", now: NOW, badge: true }));
  assert.match(aging, /bg-ink-100/);
});

test("VerifiedLine text is ink-500 at 14 px, never ink-300 or tiny", () => {
  const out = html(h(VerifiedLine, { lastVerifiedAt: "2026-06-01T08:30:00Z", now: NOW }));
  assert.match(out, /text-small/);
  assert.match(out, /text-ink-500/);
  assert.ok(!/text-ink-300|text-xs|text-\[1[01]px\]/.test(out));
});

test("DeadlineBadge: neutral, warn, danger, ended", () => {
  const open = html(h(DeadlineBadge, { endDate: "2026-10-31", now: NOW }));
  assert.equal(text(open), "Ważna do 31.10.2026");
  assert.match(open, /bg-ink-100/);
  assert.match(open, /data-deadline="open"/);

  const soon = html(h(DeadlineBadge, { endDate: "2026-10-14", now: NOW }));
  assert.equal(text(soon), "Koniec za 5 dni");
  assert.match(soon, /bg-warn-100/);
  assert.match(soon, /lucide-clock/);

  const urgent = html(h(DeadlineBadge, { endDate: "2026-10-11", now: NOW }));
  assert.equal(text(urgent), "Koniec za 2 dni");
  assert.match(urgent, /bg-coral-100/);
  assert.match(urgent, /lucide-clock/);

  const today = html(h(DeadlineBadge, { endDate: new Date("2026-10-09T00:00:00Z"), now: NOW }));
  assert.equal(text(today), "Koniec dziś");

  const ended = html(h(DeadlineBadge, { endDate: "2026-10-08", now: NOW }));
  assert.equal(text(ended), "Zakończona");
  assert.match(ended, /bg-coral-100/);
  assert.match(ended, /data-deadline="ended"/);
});

test("DeadlineBadge: detailed wording, and nothing at all without a date", () => {
  assert.equal(
    text(html(h(DeadlineBadge, { endDate: "2026-10-31", now: NOW, detailed: true }))),
    "Ważna do 31.10.2026, zostały 22 dni"
  );
  assert.equal(html(h(DeadlineBadge, { endDate: null, now: NOW })), "");
  assert.equal(html(h(DeadlineBadge, { endDate: "garbage", now: NOW })), "");
});

test("all on-page affiliate notices are switched off (owner decision); rel=sponsored on the links stays", () => {
  assert.equal(html(h(AffiliateDisclosure, { variant: "strip" })), "");
  assert.equal(html(h(AffiliateDisclosure, { variant: "compact" })), "");
  assert.equal(html(h(AffiliateDisclosure, { variant: "footer" })), "");
});
