import test from "node:test";
import assert from "node:assert/strict";
import {
  applicationStage,
  chooseAffiliateLink,
  contestBonusCents,
  networkFromUrl,
  parseTiers,
  payoutCents,
  type OfferForChoice
} from "../src/lib/affiliateNetworks";
import { SnapshotSchema } from "../src/lib/services/affiliateSync";
import example from "../docs/affiliate-snapshot.example.json";

const NOW = new Date("2026-11-03T09:00:00Z");
const EB_URL = "https://bankmiplaci.ebrokerpartner.pl/short/abc";
const CP_URL = "https://www.comperialead.pl/r/xyz";

const offer = (network: "EBROKER" | "COMPERIA", cps: number | null, cpa: number | null, extra: Partial<OfferForChoice> = {}): OfferForChoice => ({
  network,
  externalId: `${network}-1`,
  cpsCents: cps,
  cpaCents: cpa,
  trackingUrl: network === "EBROKER" ? EB_URL : CP_URL,
  endDate: null,
  missingSince: null,
  lastSeenAt: new Date("2026-11-03T08:30:00Z"),
  ...extra
});

const promo = (network: "EBROKER" | "COMPERIA" | null, pinned = false) => ({
  affiliateUrl: network === "COMPERIA" ? CP_URL : EB_URL,
  affiliateNetwork: network,
  affiliateNetworkPinned: pinned
});

test("networkFromUrl recognises both networks by host", () => {
  assert.equal(networkFromUrl(EB_URL), "EBROKER");
  assert.equal(networkFromUrl("https://ebrokerpartner.pl/x"), "EBROKER");
  assert.equal(networkFromUrl(CP_URL), "COMPERIA");
  assert.equal(networkFromUrl("https://www.mbank.pl"), null);
  assert.equal(networkFromUrl("nie-url"), null);
});

test("switches to the network paying more CPS for a new client", () => {
  const c = chooseAffiliateLink(promo("EBROKER"), [offer("EBROKER", 7000, null), offer("COMPERIA", 8000, null)], NOW);
  assert.equal(c.kind, "switch");
  if (c.kind === "switch") {
    assert.equal(c.to.network, "COMPERIA");
    assert.equal(c.model, "CPS");
    assert.equal(c.fromCents, 7000);
    assert.equal(c.toCents, 8000);
  }
});

test("keeps the link when the current network already pays more, or the same", () => {
  assert.equal(chooseAffiliateLink(promo("EBROKER"), [offer("EBROKER", 30500, null), offer("COMPERIA", 30000, null)], NOW).kind, "keep");
  assert.equal(chooseAffiliateLink(promo("EBROKER"), [offer("EBROKER", 12000, null), offer("COMPERIA", 12000, null)], NOW).kind, "keep");
});

test("compares CPA with CPA when only CPA is paid by both", () => {
  const c = chooseAffiliateLink(promo("COMPERIA"), [offer("EBROKER", null, 25000), offer("COMPERIA", null, 20000)], NOW);
  assert.equal(c.kind, "switch");
  if (c.kind === "switch") assert.equal(c.model, "CPA");
});

test("never compares CPS with CPA: asks the owner instead", () => {
  const c = chooseAffiliateLink(promo("EBROKER"), [offer("EBROKER", 22000, null), offer("COMPERIA", null, 20000)], NOW);
  assert.equal(c.kind, "decide");
});

test("a pinned promotion is never switched", () => {
  const c = chooseAffiliateLink(promo("EBROKER", true), [offer("EBROKER", 1000, null), offer("COMPERIA", 90000, null)], NOW);
  assert.equal(c.kind, "keep");
});

test("a missing, stale, ended or link-less offer is not a candidate", () => {
  const better = (extra: Partial<OfferForChoice>) => [offer("EBROKER", 7000, null), offer("COMPERIA", 9000, null, extra)];
  assert.equal(chooseAffiliateLink(promo("EBROKER"), better({ missingSince: NOW }), NOW).kind, "keep");
  assert.equal(chooseAffiliateLink(promo("EBROKER"), better({ lastSeenAt: new Date("2026-10-29T08:00:00Z") }), NOW).kind, "keep");
  assert.equal(chooseAffiliateLink(promo("EBROKER"), better({ endDate: new Date("2026-11-02T00:00:00Z") }), NOW).kind, "keep");
  assert.equal(chooseAffiliateLink(promo("EBROKER"), better({ trackingUrl: null }), NOW).kind, "keep");
  // The last day itself still counts.
  assert.equal(chooseAffiliateLink(promo("EBROKER"), better({ endDate: new Date("2026-11-03T00:00:00Z") }), NOW).kind, "switch");
});

test("current network's campaign gone, other one present: owner decides", () => {
  const c = chooseAffiliateLink(promo("EBROKER"), [offer("EBROKER", 7000, null, { missingSince: NOW }), offer("COMPERIA", 8000, null)], NOW);
  assert.equal(c.kind, "decide");
});

test("application statuses of both panels map to stages; unknown text is never paid", () => {
  assert.equal(applicationStage("KLIK"), "CLICK");
  assert.equal(applicationStage("Wysłane"), "SENT");
  assert.equal(applicationStage("Zaakceptowane"), "ACCEPTED");
  assert.equal(applicationStage("Odrzucone"), "REJECTED");
  assert.equal(applicationStage("przekazane do banku"), "SENT");
  assert.equal(applicationStage("trwa weryfikacja"), "PENDING");
  assert.equal(applicationStage("oczekuje na rozliczenie"), "ACCEPTED");
  assert.equal(applicationStage("potencjalnie rozliczony"), "ACCEPTED");
  assert.equal(applicationStage("oczekuje na wypłacenie"), "ACCEPTED");
  assert.equal(applicationStage("wypłacony"), "PAID");
  assert.equal(applicationStage("duplikat danych"), "DUPLICATE");
  assert.equal(applicationStage("coś nowego"), "PENDING");
});

test("contest bonus: every N clients and a one-off threshold", () => {
  const every3 = parseTiers([{ everyN: 3, bonusCents: 100000 }]);
  assert.deepEqual([1, 2, 3, 5, 6].map((n) => contestBonusCents(every3, n)), [0, 0, 100000, 100000, 200000]);
  const atLeast5 = parseTiers([{ atLeast: 5, bonusCents: 60000 }]);
  assert.deepEqual([4, 5, 10].map((n) => contestBonusCents(atLeast5, n)), [0, 60000, 60000]);
  // 300 zł for each account on top of a 220 zł CPA rate.
  assert.equal(payoutCents(22000, parseTiers([{ everyN: 1, bonusCents: 30000 }]), 2), 2 * 22000 + 2 * 30000);
});

test("parseTiers drops malformed rules instead of guessing", () => {
  assert.deepEqual(parseTiers([{ everyN: 0, bonusCents: 100 }, { atLeast: 2 }, "x", { everyN: 2, bonusCents: -5 }]), []);
  assert.deepEqual(parseTiers(null), []);
});

test("the documented example snapshot is valid", () => {
  const parsed = SnapshotSchema.safeParse({ ...example, offers: example.offers.map((o) => ({ ...o, trackingUrl: CP_URL })) });
  assert.equal(parsed.success, true, parsed.success ? "" : JSON.stringify(parsed.error.issues));
});
