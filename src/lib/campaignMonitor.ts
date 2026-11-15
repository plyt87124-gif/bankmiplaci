// Pure comparison of two campaign snapshots. No Prisma, IO, fetch or env:
// the caller loads snapshots and decides what to do with the findings, which
// are always proposals (state PROPOSED) for human review, never applied edits.
// All amounts are non-negative integer grosze (PLN); 0 and null are distinct.
// Scope: only the customer's bonus terms (signup, deadlines, bonus, fees,
// conditions). Publisher commission payout rules are a separate domain and are
// deliberately not modelled here. Not wired into import or production.

export type AffiliateStatus = "ACTIVE" | "PAUSED" | "ENDED" | "UNKNOWN";
export type SourceKind = "PARTNER" | "REGULATIONS" | "TARIFF";

export type UserDeadline = { id: string; date: string };

export type FeeTerms = { feeCents: number | null; waiver: string | null };

export type CampaignSource = {
  id: string;
  kind: SourceKind;
  url: string;
  contentHash: string;
  readAt: string;
};

export type ExtensionEvidence = {
  sourceId: string;
  campaignId: string;
  editionId: string;
  oldSignupEnd: string;
  newSignupEnd: string;
  verified: true;
};

export type CampaignSnapshot = {
  campaignId: string;
  editionId: string;
  affiliateStatus: AffiliateStatus;
  /** Last signup day (inclusive), YYYY-MM-DD in Polish time. */
  signupEnd: string | null;
  userDeadlines: UserDeadline[];
  maxBonusCents: number | null;
  fees: { account: FeeTerms; card: FeeTerms };
  conditions: string[];
  sources: CampaignSource[];
  extensionEvidence?: ExtensionEvidence;
  readError?: string;
};

export type FindingKind =
  | "READ_ERROR"
  | "NEW_OFFER"
  | "NEW_EDITION"
  | "TERMS_CHANGED"
  | "EXTENDED"
  | "AFFILIATE_CHANGED"
  | "SIGNUP_CLOSED"
  | "SOURCE_CHANGED";

export type Finding = {
  kind: FindingKind;
  state: "PROPOSED";
  campaignId: string;
  editionId: string;
  fields: string[];
  evidence: Record<string, unknown>;
  priority: 1 | 2 | 3;
  needsReview: boolean;
  currency: "PLN";
};

type FieldChange = { field: string; before: unknown; after: unknown };

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True only for a real calendar day, e.g. rejects 2026-02-29 and 2026-04-31. */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function assertDate(value: string | null, label: string): void {
  if (value === null) return;
  if (!isCalendarDate(value)) {
    throw new TypeError(`${label} must be a real YYYY-MM-DD day or null, got ${String(value)}`);
  }
}

function assertCents(value: number | null, label: string): void {
  if (value === null) return;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be non-negative safe-integer grosze or null, got ${String(value)}`);
  }
}

function assertUniqueIds(items: Array<{ id: string }>, label: string): void {
  const seen = new Set<string>();
  for (const { id } of items) {
    if (typeof id !== "string" || id === "") throw new TypeError(`${label}: id must be a non-empty string`);
    if (seen.has(id)) throw new TypeError(`${label}: duplicate id "${id}" is ambiguous`);
    seen.add(id);
  }
}

function validate(s: CampaignSnapshot, label: string): void {
  if (!s.campaignId || !s.editionId) throw new TypeError(`${label}: campaignId and editionId are required`);
  if (s.readError) return; // a failed read may carry partial data; it is never compared
  assertDate(s.signupEnd, `${label}.signupEnd`);
  assertUniqueIds(s.userDeadlines, `${label}.userDeadlines`);
  s.userDeadlines.forEach((d) => assertDate(d.date, `${label}.userDeadlines[${d.id}]`));
  assertUniqueIds(s.sources, `${label}.sources`);
  assertCents(s.maxBonusCents, `${label}.maxBonusCents`);
  assertCents(s.fees.account.feeCents, `${label}.fees.account.feeCents`);
  assertCents(s.fees.card.feeCents, `${label}.fees.card.feeCents`);
  if (s.extensionEvidence) {
    assertDate(s.extensionEvidence.oldSignupEnd, `${label}.extensionEvidence.oldSignupEnd`);
    assertDate(s.extensionEvidence.newSignupEnd, `${label}.extensionEvidence.newSignupEnd`);
  }
}

/** Calendar date (YYYY-MM-DD) in Europe/Warsaw at the given instant. */
export function warsawDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Signups close once the last day has fully passed in Polish time. */
export function isSignupClosed(signupEnd: string | null, now: Date): boolean {
  return signupEnd !== null && warsawDate(now) > signupEnd;
}

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// Order-insensitive views; copies so the inputs are never mutated.
const sortedConditions = (s: CampaignSnapshot) => [...s.conditions].sort();
const sortedDeadlines = (s: CampaignSnapshot) => [...s.userDeadlines].sort(byId).map((d) => ({ id: d.id, date: d.date }));

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function termChanges(prev: CampaignSnapshot, next: CampaignSnapshot): FieldChange[] {
  const pairs: Array<[string, unknown, unknown]> = [
    ["signupEnd", prev.signupEnd, next.signupEnd],
    ["userDeadlines", sortedDeadlines(prev), sortedDeadlines(next)],
    ["maxBonusCents", prev.maxBonusCents, next.maxBonusCents],
    ["fees.account.feeCents", prev.fees.account.feeCents, next.fees.account.feeCents],
    ["fees.account.waiver", prev.fees.account.waiver, next.fees.account.waiver],
    ["fees.card.feeCents", prev.fees.card.feeCents, next.fees.card.feeCents],
    ["fees.card.waiver", prev.fees.card.waiver, next.fees.card.waiver],
    ["conditions", sortedConditions(prev), sortedConditions(next)]
  ];
  return pairs.filter(([, a, b]) => !same(a, b)).map(([field, before, after]) => ({ field, before, after }));
}

// readAt is deliberately ignored: re-reading an unchanged page is not a change.
function sourceChanges(prev: CampaignSnapshot, next: CampaignSnapshot): FieldChange[] {
  const view = (s: CampaignSnapshot) =>
    new Map(s.sources.map((src) => [src.id, { kind: src.kind, url: src.url, contentHash: src.contentHash }]));
  const before = view(prev);
  const after = view(next);
  const ids = [...new Set([...before.keys(), ...after.keys()])].sort();
  return ids
    .filter((id) => !same(before.get(id) ?? null, after.get(id) ?? null))
    .map((id) => ({ field: `sources.${id}`, before: before.get(id) ?? null, after: after.get(id) ?? null }));
}

/**
 * An extension counts only with explicit verified evidence that matches this
 * exact campaign, edition and pair of dates and points at a REGULATIONS
 * source present in the new snapshot.
 */
export function isExtensionProven(prev: CampaignSnapshot, next: CampaignSnapshot): boolean {
  const ev = next.extensionEvidence;
  if (!ev || ev.verified !== true) return false;
  if (prev.signupEnd === null || next.signupEnd === null || next.signupEnd <= prev.signupEnd) return false;
  if (prev.editionId !== next.editionId) return false;
  if (ev.campaignId !== next.campaignId || ev.editionId !== next.editionId) return false;
  if (ev.oldSignupEnd !== prev.signupEnd || ev.newSignupEnd !== next.signupEnd) return false;
  return next.sources.some((s) => s.id === ev.sourceId && s.kind === "REGULATIONS");
}

function finding(
  next: CampaignSnapshot,
  kind: FindingKind,
  fields: string[],
  evidence: Record<string, unknown>,
  priority: 1 | 2 | 3,
  needsReview = false
): Finding {
  return {
    kind,
    state: "PROPOSED",
    campaignId: next.campaignId,
    editionId: next.editionId,
    fields,
    evidence,
    priority,
    needsReview,
    currency: "PLN"
  };
}

/**
 * SIGNUP_CLOSED describes a state, not an event: it is emitted on every
 * comparison made after signupEnd has passed, so it repeats across runs. This
 * function cannot tell the first run after the boundary from later ones (it
 * sees only `now`, no previous `now`). The reporter must deduplicate using
 * evidence.dedupKey, which is stable (no timestamp, no warsawDate) and changes
 * only when campaign, edition or signupEnd change.
 */
function signupClosedFinding(next: CampaignSnapshot, now: Date): Finding[] {
  if (!isSignupClosed(next.signupEnd, now)) return [];
  // Closing signups leaves user deadlines and the affiliate status untouched.
  const dedupKey = `SIGNUP_CLOSED:${next.campaignId}:${next.editionId}:${next.signupEnd}`;
  return [
    finding(next, "SIGNUP_CLOSED", ["signupEnd"], { signupEnd: next.signupEnd, warsawDate: warsawDate(now), dedupKey }, 2)
  ];
}

export function compareCampaignSnapshots(
  prev: CampaignSnapshot | null,
  next: CampaignSnapshot,
  now: Date
): Finding[] {
  if (Number.isNaN(now.getTime())) throw new TypeError("now must be a valid Date");
  if (prev && prev.campaignId !== next.campaignId) {
    throw new Error(`campaignId mismatch: ${prev.campaignId} vs ${next.campaignId}; refusing to compare different campaigns`);
  }
  validate(next, "next");

  // A failed read says nothing about the offer; report only the error.
  if (next.readError) {
    return [finding(next, "READ_ERROR", [], { readError: next.readError }, 1, true)];
  }

  // A failed previous read is no baseline. The collector must keep passing the
  // last successfully read snapshot as prev instead of overwriting it.
  if (prev?.readError) {
    throw new TypeError(
      `prev has readError (${prev.readError}); pass the last successfully read snapshot as prev`
    );
  }
  if (prev) validate(prev, "prev");

  if (prev === null) {
    return [
      finding(next, "NEW_OFFER", [], { signupEnd: next.signupEnd, affiliateStatus: next.affiliateStatus }, 2, true),
      ...signupClosedFinding(next, now)
    ];
  }

  const out: Finding[] = [];

  if (prev.affiliateStatus !== next.affiliateStatus) {
    out.push(
      finding(
        next,
        "AFFILIATE_CHANGED",
        ["affiliateStatus"],
        { before: prev.affiliateStatus, after: next.affiliateStatus },
        prev.affiliateStatus === "ACTIVE" ? 1 : 2,
        true
      )
    );
  }

  const changes = termChanges(prev, next);

  if (prev.editionId !== next.editionId) {
    // A new edition is never an extension of the old one.
    out.push(
      finding(
        next,
        "NEW_EDITION",
        ["editionId", ...changes.map((c) => c.field)],
        { previousEditionId: prev.editionId, changes },
        1,
        true
      )
    );
  } else {
    const signup = changes.find((c) => c.field === "signupEnd");
    const rest = changes.filter((c) => c.field !== "signupEnd");
    if (signup && isExtensionProven(prev, next)) {
      out.push(
        finding(next, "EXTENDED", ["signupEnd"], { ...signup, extensionEvidence: { ...next.extensionEvidence } }, 2)
      );
      if (rest.length) out.push(finding(next, "TERMS_CHANGED", rest.map((c) => c.field), { changes: rest }, 1, true));
    } else if (changes.length) {
      const unverifiedLater =
        !!signup && prev.signupEnd !== null && next.signupEnd !== null && next.signupEnd > prev.signupEnd;
      out.push(
        finding(
          next,
          "TERMS_CHANGED",
          changes.map((c) => c.field),
          unverifiedLater ? { changes, unverifiedExtension: true } : { changes },
          1,
          true
        )
      );
    }
  }

  const sources = sourceChanges(prev, next);
  if (sources.length) {
    out.push(finding(next, "SOURCE_CHANGED", sources.map((c) => c.field), { changes: sources }, 3, true));
  }

  out.push(...signupClosedFinding(next, now));
  return out;
}
