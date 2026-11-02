import test from "node:test";
import assert from "node:assert/strict";
import {
  compareCampaignSnapshots,
  isCalendarDate,
  isSignupClosed,
  type CampaignSnapshot,
  type Finding
} from "../src/lib/campaignMonitor";

const NOW = new Date("2026-10-03T10:00:00Z");

function snap(overrides: Partial<CampaignSnapshot> = {}): CampaignSnapshot {
  return {
    campaignId: "bank-a-konto",
    editionId: "2026-09",
    affiliateStatus: "ACTIVE",
    signupEnd: "2026-10-31",
    userDeadlines: [
      { id: "card-payments", date: "2026-12-31" },
      { id: "salary", date: "2026-11-30" }
    ],
    maxBonusCents: 40000,
    fees: {
      account: { feeCents: 0, waiver: null },
      card: { feeCents: 900, waiver: "5 transakcji miesięcznie" }
    },
    conditions: ["wpływ 1000 zł", "logowanie w aplikacji"],
    sources: [
      {
        id: "regulamin",
        kind: "REGULATIONS",
        url: "https://bank.example/regulamin.pdf",
        contentHash: "h1",
        readAt: "2026-10-01T08:00:00Z"
      },
      {
        id: "partner",
        kind: "PARTNER",
        url: "https://partner.example/oferta",
        contentHash: "p1",
        readAt: "2026-10-01T08:00:00Z"
      }
    ],
    ...overrides
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

const kinds = (fs: Finding[]) => fs.map((f) => f.kind);
const only = (fs: Finding[], kind: string) => {
  const found = fs.filter((f) => f.kind === kind);
  assert.equal(found.length, 1, `expected exactly one ${kind}, got ${kinds(fs).join(",")}`);
  return found[0]!;
};

const validEvidence = {
  sourceId: "regulamin",
  campaignId: "bank-a-konto",
  editionId: "2026-09",
  oldSignupEnd: "2026-10-31",
  newSignupEnd: "2026-11-30",
  verified: true as const
};

function extendedNext(overrides: Partial<CampaignSnapshot> = {}): CampaignSnapshot {
  const base = snap();
  return snap({
    signupEnd: "2026-11-30",
    sources: [{ ...base.sources[0]!, contentHash: "h2", readAt: "2026-10-03T08:00:00Z" }, base.sources[1]!],
    ...overrides
  });
}

test("identical snapshots produce no findings", () => {
  assert.deepEqual(compareCampaignSnapshots(snap(), snap(), NOW), []);
});

test("order of conditions, sources and deadlines and readAt alone are not changes", () => {
  const a = snap();
  const b = snap({
    conditions: [...a.conditions].reverse(),
    sources: [...a.sources].reverse().map((s) => ({ ...s, readAt: "2026-10-03T09:00:00Z" })),
    userDeadlines: [...a.userDeadlines].reverse()
  });
  assert.deepEqual(compareCampaignSnapshots(a, b, NOW), []);
});

test("READ_ERROR is the only finding and nothing is inferred", () => {
  const next = snap({ readError: "HTTP 503", affiliateStatus: "UNKNOWN", signupEnd: "2026-09-01" });
  const fs = compareCampaignSnapshots(snap(), next, NOW);
  assert.deepEqual(kinds(fs), ["READ_ERROR"]);
  assert.equal(fs[0]!.priority, 1);
  assert.deepEqual(fs[0]!.evidence, { readError: "HTTP 503" });
});

test("NEW_OFFER when there is no previous snapshot", () => {
  const fs = compareCampaignSnapshots(null, snap(), NOW);
  assert.deepEqual(kinds(fs), ["NEW_OFFER"]);
});

test("NEW_EDITION for another edition of the same campaign, never EXTENDED", () => {
  const next = snap({
    editionId: "2026-11",
    signupEnd: "2026-12-31",
    extensionEvidence: { ...validEvidence, editionId: "2026-11", newSignupEnd: "2026-12-31" }
  });
  const fs = compareCampaignSnapshots(snap(), next, NOW);
  assert.deepEqual(kinds(fs), ["NEW_EDITION"]);
  assert.ok(fs[0]!.fields.includes("editionId"));
  assert.ok(fs[0]!.fields.includes("signupEnd"));
  assert.equal(fs[0]!.evidence.previousEditionId, "2026-09");
});

test("TERMS_CHANGED lists changed fields with before/after", () => {
  const next = snap({ maxBonusCents: 50000, conditions: ["wpływ 2000 zł", "logowanie w aplikacji"] });
  const f = only(compareCampaignSnapshots(snap(), next, NOW), "TERMS_CHANGED");
  assert.deepEqual(f.fields, ["maxBonusCents", "conditions"]);
  assert.equal(f.priority, 1);
  assert.equal(f.currency, "PLN");
});

test("EXTENDED only with matching verified evidence from a REGULATIONS source", () => {
  const fs = compareCampaignSnapshots(snap(), extendedNext({ extensionEvidence: validEvidence }), NOW);
  const f = only(fs, "EXTENDED");
  assert.deepEqual(f.fields, ["signupEnd"]);
  assert.equal(f.evidence.before, "2026-10-31");
  assert.equal(f.evidence.after, "2026-11-30");
  assert.ok(!kinds(fs).includes("TERMS_CHANGED"));
});

test("later signupEnd without evidence is TERMS_CHANGED flagged for review", () => {
  const fs = compareCampaignSnapshots(snap(), extendedNext(), NOW);
  assert.ok(!kinds(fs).includes("EXTENDED"));
  const f = only(fs, "TERMS_CHANGED");
  assert.ok(f.fields.includes("signupEnd"));
  assert.equal(f.evidence.unverifiedExtension, true);
  assert.equal(f.needsReview, true);
  // The changed regulations hash is reported as a source change, not as proof.
  only(fs, "SOURCE_CHANGED");
});

test("mismatched or insufficient evidence never yields EXTENDED", () => {
  const partner = snap().sources[1]!;
  const bad: Array<[string, Partial<CampaignSnapshot>]> = [
    ["wrong source kind", { extensionEvidence: { ...validEvidence, sourceId: "partner" } }],
    ["source missing in next", { extensionEvidence: { ...validEvidence, sourceId: "regulamin-v2" } }],
    ["other edition", { extensionEvidence: { ...validEvidence, editionId: "2026-11" } }],
    ["other campaign", { extensionEvidence: { ...validEvidence, campaignId: "bank-b" } }],
    ["wrong old date", { extensionEvidence: { ...validEvidence, oldSignupEnd: "2026-10-30" } }],
    ["wrong new date", { extensionEvidence: { ...validEvidence, newSignupEnd: "2026-12-31" } }],
    ["not verified", { extensionEvidence: { ...validEvidence, verified: false as unknown as true } }],
    ["regulations removed", { sources: [partner], extensionEvidence: validEvidence }]
  ];
  for (const [label, overrides] of bad) {
    const fs = compareCampaignSnapshots(snap(), extendedNext(overrides), NOW);
    assert.ok(!kinds(fs).includes("EXTENDED"), label);
    assert.equal(only(fs, "TERMS_CHANGED").evidence.unverifiedExtension, true, label);
  }
});

test("only a changed url/hash/readAt is not an extension", () => {
  const base = snap();
  const next = snap({
    sources: [{ ...base.sources[0]!, url: "https://bank.example/regulamin-2.pdf", contentHash: "h9", readAt: "2026-10-03T09:00:00Z" }, base.sources[1]!]
  });
  const fs = compareCampaignSnapshots(base, next, NOW);
  assert.deepEqual(kinds(fs), ["SOURCE_CHANGED"]);
  assert.equal(fs[0]!.priority, 3);
});

test("AFFILIATE_CHANGED reports before/after", () => {
  const fs = compareCampaignSnapshots(snap(), snap({ affiliateStatus: "PAUSED" }), NOW);
  const f = only(fs, "AFFILIATE_CHANGED");
  assert.deepEqual(f.evidence, { before: "ACTIVE", after: "PAUSED" });
  assert.equal(f.priority, 1);
  assert.equal(fs.length, 1);
});

test("SIGNUP_CLOSED uses the Polish day boundary (CEST), not 00:00 UTC", () => {
  const s = snap({ signupEnd: "2026-10-03" });
  assert.equal(isSignupClosed("2026-10-03", new Date("2026-10-03T00:00:00Z")), false);
  assert.equal(isSignupClosed("2026-10-03", new Date("2026-10-03T21:59:59Z")), false);
  assert.equal(isSignupClosed("2026-10-03", new Date("2026-10-03T22:00:00Z")), true);
  assert.deepEqual(compareCampaignSnapshots(s, s, new Date("2026-10-03T21:59:00Z")), []);
  const fs = compareCampaignSnapshots(s, s, new Date("2026-10-03T22:00:00Z"));
  assert.deepEqual(kinds(fs), ["SIGNUP_CLOSED"]);
  assert.equal(fs[0]!.evidence.warsawDate, "2026-10-04");
});

test("SIGNUP_CLOSED does not touch user deadlines or affiliate status", () => {
  const s = snap({ signupEnd: "2026-10-01" });
  const fs = compareCampaignSnapshots(s, s, NOW);
  assert.deepEqual(kinds(fs), ["SIGNUP_CLOSED"]);
  assert.deepEqual(fs[0]!.fields, ["signupEnd"]);
  assert.ok(!kinds(fs).includes("AFFILIATE_CHANGED"));
});

test("0 and null are different amounts", () => {
  const prev = snap({ maxBonusCents: 0 });
  const f = only(compareCampaignSnapshots(prev, snap({ maxBonusCents: null }), NOW), "TERMS_CHANGED");
  assert.deepEqual(f.evidence.changes, [{ field: "maxBonusCents", before: 0, after: null }]);

  const fee = snap();
  const feeNull = snap({ fees: { ...fee.fees, account: { feeCents: null, waiver: null } } });
  assert.deepEqual(only(compareCampaignSnapshots(fee, feeNull, NOW), "TERMS_CHANGED").fields, ["fees.account.feeCents"]);
});

test("inputs are not mutated", () => {
  const prev = deepFreeze(snap({ conditions: ["b", "a"] }));
  const next = deepFreeze(extendedNext({ conditions: ["a", "c"], extensionEvidence: validEvidence }));
  const prevCopy = JSON.parse(JSON.stringify(prev));
  const nextCopy = JSON.parse(JSON.stringify(next));
  const fs = compareCampaignSnapshots(prev, next, NOW);
  assert.ok(fs.length > 0);
  assert.deepEqual(prev, prevCopy);
  assert.deepEqual(next, nextCopy);
});

test("every finding is PROPOSED with fields, evidence and priority 1-3", () => {
  const fs = compareCampaignSnapshots(
    snap(),
    extendedNext({ affiliateStatus: "ENDED", maxBonusCents: 1, signupEnd: "2026-09-30" }),
    NOW
  );
  assert.ok(fs.length >= 3);
  for (const f of fs) {
    assert.equal(f.state, "PROPOSED");
    assert.ok(Array.isArray(f.fields));
    assert.equal(typeof f.evidence, "object");
    assert.ok([1, 2, 3].includes(f.priority));
  }
});

test("different campaignId is an argument error", () => {
  assert.throws(() => compareCampaignSnapshots(snap(), snap({ campaignId: "bank-b" }), NOW), /campaignId mismatch/);
});

test("non-integer grosze and malformed dates are rejected", () => {
  assert.throws(() => compareCampaignSnapshots(snap(), snap({ maxBonusCents: 12.5 }), NOW), TypeError);
  assert.throws(() => compareCampaignSnapshots(snap(), snap({ signupEnd: "03.10.2026" }), NOW), TypeError);
});

test("prev with readError is refused as a baseline", () => {
  const badPrev = snap({ readError: "timeout", signupEnd: "2026-09-01" });
  assert.throws(() => compareCampaignSnapshots(badPrev, snap(), NOW), /prev has readError/);
});

test("prev and next both with readError yield only READ_ERROR", () => {
  const fs = compareCampaignSnapshots(snap({ readError: "timeout" }), snap({ readError: "HTTP 500" }), NOW);
  assert.deepEqual(kinds(fs), ["READ_ERROR"]);
  assert.deepEqual(fs[0]!.evidence, { readError: "HTTP 500" });
});

test("dates must be real calendar days, including leap years", () => {
  assert.equal(isCalendarDate("2028-02-29"), true);
  assert.equal(isCalendarDate("2000-02-29"), true);
  assert.equal(isCalendarDate("2026-02-29"), false);
  assert.equal(isCalendarDate("2100-02-29"), false);
  assert.equal(isCalendarDate("2026-04-31"), false);
  assert.equal(isCalendarDate("2026-13-01"), false);
  assert.equal(isCalendarDate("2026-00-10"), false);
  for (const bad of ["2026-02-29", "2026-02-30", "2026-04-31", "2026-1-01"]) {
    assert.throws(() => compareCampaignSnapshots(snap(), snap({ signupEnd: bad }), NOW), TypeError, bad);
    assert.throws(
      () => compareCampaignSnapshots(snap(), snap({ userDeadlines: [{ id: "x", date: bad }] }), NOW),
      TypeError,
      bad
    );
  }
  assert.throws(
    () =>
      compareCampaignSnapshots(
        snap(),
        extendedNext({ extensionEvidence: { ...validEvidence, newSignupEnd: "2026-11-31" } }),
        NOW
      ),
    TypeError
  );
  assert.deepEqual(kinds(compareCampaignSnapshots(snap(), snap({ signupEnd: "2028-02-29" }), NOW)), ["TERMS_CHANGED"]);
});

test("amounts must be non-negative safe integers in grosze or null", () => {
  const fee = snap().fees;
  const bad: Array<Partial<CampaignSnapshot>> = [
    { maxBonusCents: -1 },
    { maxBonusCents: Number.MAX_SAFE_INTEGER + 1 },
    { maxBonusCents: Number.NaN },
    { maxBonusCents: Number.POSITIVE_INFINITY },
    { maxBonusCents: "100" as unknown as number },
    { fees: { ...fee, account: { feeCents: -500, waiver: null } } },
    { fees: { ...fee, card: { feeCents: 9.99, waiver: null } } }
  ];
  for (const overrides of bad) {
    const label = JSON.stringify(overrides);
    assert.throws(() => compareCampaignSnapshots(snap(), snap(overrides), NOW), TypeError, label);
    assert.throws(() => compareCampaignSnapshots(snap(overrides), snap(), NOW), TypeError, label);
  }
  assert.deepEqual(compareCampaignSnapshots(snap({ maxBonusCents: 0 }), snap({ maxBonusCents: 0 }), NOW), []);
});

test("duplicate source or deadline ids are rejected as ambiguous", () => {
  const base = snap();
  const dupSource = snap({ sources: [base.sources[0]!, { ...base.sources[0]!, contentHash: "other" }] });
  const dupDeadline = snap({
    userDeadlines: [
      { id: "salary", date: "2026-11-30" },
      { id: "salary", date: "2026-12-31" }
    ]
  });
  assert.throws(() => compareCampaignSnapshots(base, dupSource, NOW), /duplicate id "regulamin"/);
  assert.throws(() => compareCampaignSnapshots(dupSource, base, NOW), /duplicate id "regulamin"/);
  assert.throws(() => compareCampaignSnapshots(base, dupDeadline, NOW), /duplicate id "salary"/);
  assert.throws(() => compareCampaignSnapshots(null, dupDeadline, NOW), /duplicate id "salary"/);
});

test("duplicate regulations id cannot smuggle extension proof", () => {
  const base = snap();
  const next = extendedNext({
    sources: [{ ...base.sources[1]!, id: "regulamin" }, { ...base.sources[0]!, contentHash: "h2" }],
    extensionEvidence: validEvidence
  });
  assert.throws(() => compareCampaignSnapshots(base, next, NOW), /duplicate id/);
});

test("evidence pointing at a source that is REGULATIONS only in prev is not proof", () => {
  const base = snap();
  const next = extendedNext({
    sources: [{ ...base.sources[0]!, kind: "PARTNER", contentHash: "h2" }, base.sources[1]!],
    extensionEvidence: validEvidence
  });
  const fs = compareCampaignSnapshots(base, next, NOW);
  assert.ok(!kinds(fs).includes("EXTENDED"));
  assert.equal(only(fs, "TERMS_CHANGED").evidence.unverifiedExtension, true);
});

test("evidence without a date change is not EXTENDED", () => {
  const next = snap({ extensionEvidence: { ...validEvidence, newSignupEnd: "2026-10-31" } });
  assert.deepEqual(compareCampaignSnapshots(snap(), next, NOW), []);
});

test("SOURCE_CHANGED accompanies EXTENDED and TERMS_CHANGED as an extra signal", () => {
  const ext = compareCampaignSnapshots(snap(), extendedNext({ extensionEvidence: validEvidence }), NOW);
  assert.deepEqual(kinds(ext), ["EXTENDED", "SOURCE_CHANGED"]);
  assert.deepEqual(only(ext, "SOURCE_CHANGED").fields, ["sources.regulamin"]);

  const base = snap();
  const terms = snap({ maxBonusCents: 30000, sources: [base.sources[0]!, { ...base.sources[1]!, contentHash: "p2" }] });
  assert.deepEqual(kinds(compareCampaignSnapshots(base, terms, NOW)), ["TERMS_CHANGED", "SOURCE_CHANGED"]);
});

test("readAt-only change on every source yields no findings", () => {
  const base = snap();
  const next = snap({ sources: base.sources.map((s) => ({ ...s, readAt: "2026-10-03T23:59:59Z" })) });
  assert.deepEqual(compareCampaignSnapshots(base, next, NOW), []);
});

test("SIGNUP_CLOSED repeats as a state with a stable dedupKey without timestamps", () => {
  const s = snap({ signupEnd: "2026-10-01" });
  const day1 = only(compareCampaignSnapshots(s, s, new Date("2026-10-02T10:00:00Z")), "SIGNUP_CLOSED");
  const day5 = only(compareCampaignSnapshots(s, s, new Date("2026-10-06T10:00:00Z")), "SIGNUP_CLOSED");
  assert.equal(day1.evidence.dedupKey, "SIGNUP_CLOSED:bank-a-konto:2026-09:2026-10-01");
  assert.equal(day1.evidence.dedupKey, day5.evidence.dedupKey);
  assert.notEqual(day1.evidence.warsawDate, day5.evidence.warsawDate);
  const other = only(
    compareCampaignSnapshots(null, snap({ editionId: "2026-08", signupEnd: "2026-10-01" }), NOW),
    "SIGNUP_CLOSED"
  );
  assert.notEqual(other.evidence.dedupKey, day1.evidence.dedupKey);
});
