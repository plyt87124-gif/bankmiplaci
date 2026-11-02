/**
 * Pure rules for the two affiliate networks (eBrokerPartner, ComperiaLead):
 * which one's link a promotion should use, how a panel's application status
 * maps to a stage, and what a sales contest adds for N clients.
 *
 * No database access here, so every rule is unit-tested in isolation
 * (tests/affiliate-networks.test.ts). The daily sync
 * (src/lib/services/affiliateSync.ts) and /admin/prowizje both use it.
 */

export type Network = "EBROKER" | "COMPERIA";

export const NETWORK_LABEL: Record<Network, string> = {
  EBROKER: "eBroker",
  COMPERIA: "Comperia"
};

/** The network a partner link belongs to, from its host; null if neither. */
export function networkFromUrl(url: string | null | undefined): Network | null {
  if (!url) return null;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (host === "ebrokerpartner.pl" || host.endsWith(".ebrokerpartner.pl")) return "EBROKER";
  if (host.includes("comperia")) return "COMPERIA";
  return null;
}

// ---------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------

export type ApplicationStage = "CLICK" | "SENT" | "PENDING" | "ACCEPTED" | "PAID" | "REJECTED" | "DUPLICATE";

export const STAGE_LABEL: Record<ApplicationStage, string> = {
  CLICK: "kliknięcie",
  SENT: "wysłany",
  PENDING: "w weryfikacji",
  ACCEPTED: "zaakceptowany",
  PAID: "wypłacony",
  REJECTED: "odrzucony",
  DUPLICATE: "duplikat"
};

/**
 * The panel's own status text -> one stage. eBroker uses KLIK / Wysłane /
 * Zaakceptowane / Odrzucone; Comperia "przekazane do banku", "trwa
 * weryfikacja", "oczekuje na rozliczenie", "potencjalnie rozliczony",
 * "oczekuje na wypłacenie", "wypłacony", "odrzucony", "duplikat danych".
 * Unknown text -> PENDING, so nothing is ever counted as paid by guessing.
 */
export function applicationStage(status: string): ApplicationStage {
  const s = status.trim().toLowerCase();
  if (s.startsWith("klik") || s === "click") return "CLICK";
  if (s.includes("duplikat")) return "DUPLICATE";
  if (s.includes("odrzuc")) return "REJECTED";
  if (s === "wypłacony" || s === "wyplacony" || s === "wypłacone") return "PAID";
  if (s.includes("zaakcept") || s.includes("rozlicz") || s.includes("oczekuje na wypłac")) return "ACCEPTED";
  if (s.includes("przekazane") || s.startsWith("wysłan") || s.startsWith("wyslan")) return "SENT";
  return "PENDING";
}

// ---------------------------------------------------------------------
// Contests
// ---------------------------------------------------------------------

/**
 * One bonus rule of a contest:
 *   everyN    `bonusCents` for every full group of N clients ("1000 zł za każde 3 konta");
 *             everyN = 1 is a flat extra per client;
 *   atLeast   `bonusCents` once, after reaching N clients in the contest period.
 */
export interface ContestTier {
  everyN?: number;
  atLeast?: number;
  bonusCents: number;
}

export function parseTiers(value: unknown): ContestTier[] {
  if (!Array.isArray(value)) return [];
  const tiers: ContestTier[] = [];
  for (const t of value) {
    if (!t || typeof t !== "object") continue;
    const { everyN, atLeast, bonusCents } = t as Record<string, unknown>;
    if (typeof bonusCents !== "number" || !Number.isInteger(bonusCents) || bonusCents <= 0) continue;
    if (typeof everyN === "number" && Number.isInteger(everyN) && everyN > 0) tiers.push({ everyN, bonusCents });
    else if (typeof atLeast === "number" && Number.isInteger(atLeast) && atLeast > 0) tiers.push({ atLeast, bonusCents });
  }
  return tiers;
}

/** The contest bonus alone for `clients` qualifying clients. */
export function contestBonusCents(tiers: ContestTier[], clients: number): number {
  let total = 0;
  for (const t of tiers) {
    if (t.everyN) total += Math.floor(clients / t.everyN) * t.bonusCents;
    else if (t.atLeast && clients >= t.atLeast) total += t.bonusCents;
  }
  return total;
}

/** Commission plus contest bonus for `clients` clients of one campaign. */
export function payoutCents(rateCents: number | null, tiers: ContestTier[], clients: number): number {
  return (rateCents ?? 0) * clients + contestBonusCents(tiers, clients);
}

/** The client counts the report and the admin page show payouts for. */
export const PAYOUT_CLIENT_COUNTS = [1, 2, 3, 5, 10] as const;

// ---------------------------------------------------------------------
// Which network's link a promotion uses
// ---------------------------------------------------------------------

export interface OfferForChoice {
  network: Network;
  externalId: string;
  cpsCents: number | null;
  cpaCents: number | null;
  trackingUrl: string | null;
  endDate: Date | null;
  missingSince: Date | null;
  lastSeenAt: Date;
}

export interface PromotionForChoice {
  affiliateUrl: string;
  affiliateNetwork: Network | null;
  affiliateNetworkPinned: boolean;
}

export type LinkChoice =
  | { kind: "keep"; reason: string; network: Network | null }
  | {
      kind: "switch";
      from: Network | null;
      to: OfferForChoice;
      model: "CPS" | "CPA";
      fromCents: number | null;
      toCents: number;
    }
  | { kind: "decide"; reason: string };

/** Offers older than this (the panel was not read, e.g. the session expired) are not compared. */
export const STALE_AFTER_DAYS = 3;

const DAY_MS = 86_400_000;

/** An offer that can carry the promotion's link today. */
export function isUsableOffer(o: OfferForChoice, now: Date): boolean {
  if (!o.trackingUrl || o.missingSince) return false;
  if (now.getTime() - o.lastSeenAt.getTime() > STALE_AFTER_DAYS * DAY_MS) return false;
  // endDate is the last day the campaign runs (inclusive).
  if (o.endDate && o.endDate.getTime() + DAY_MS <= now.getTime()) return false;
  return true;
}

/** Best (highest) offer of one network, by the given commission model. */
function bestOf(offers: OfferForChoice[], model: "CPS" | "CPA"): OfferForChoice | null {
  const key = model === "CPS" ? "cpsCents" : "cpaCents";
  let best: OfferForChoice | null = null;
  for (const o of offers) {
    const v = o[key];
    if (v == null) continue;
    if (!best || v > (best[key] ?? -1)) best = o;
  }
  return best;
}

/**
 * Decides whether a promotion's "Przejdź do promocji" link should move to the
 * other network. "Better" = a higher commission for one new client, compared
 * only like with like: CPS with CPS, else CPA with CPA. Anything the rule
 * cannot settle (different models, a network's campaign gone) is a
 * "decide" for the owner, never a guess.
 */
export function chooseAffiliateLink(promotion: PromotionForChoice, offers: OfferForChoice[], now: Date = new Date()): LinkChoice {
  const current = promotion.affiliateNetwork ?? networkFromUrl(promotion.affiliateUrl);
  if (promotion.affiliateNetworkPinned) return { kind: "keep", reason: "broker przypięty ręcznie", network: current };

  const usable = offers.filter((o) => isUsableOffer(o, now));
  const byNetwork = new Map<Network, OfferForChoice[]>();
  for (const o of usable) byNetwork.set(o.network, [...(byNetwork.get(o.network) ?? []), o]);

  if (byNetwork.size === 0) return { kind: "keep", reason: "brak aktualnych kampanii u brokerów", network: current };

  if (byNetwork.size === 1) {
    const only = [...byNetwork.keys()][0]!;
    if (current === only || current === null) return { kind: "keep", reason: `kampania tylko w ${NETWORK_LABEL[only]}`, network: current };
    return {
      kind: "decide",
      reason: `kampanii ${NETWORK_LABEL[current]} nie ma w dzisiejszym odczycie, jest tylko w ${NETWORK_LABEL[only]}`
    };
  }

  const eb = byNetwork.get("EBROKER")!;
  const cp = byNetwork.get("COMPERIA")!;
  for (const model of ["CPS", "CPA"] as const) {
    const a = bestOf(eb, model);
    const b = bestOf(cp, model);
    if (!a || !b) continue;
    const key = model === "CPS" ? "cpsCents" : "cpaCents";
    const av = a[key]!;
    const bv = b[key]!;
    if (av === bv) return { kind: "keep", reason: `ta sama stawka ${model} u obu brokerów`, network: current };
    const winner = av > bv ? a : b;
    if (winner.network === current) return { kind: "keep", reason: `${NETWORK_LABEL[current]} płaci więcej (${model})`, network: current };
    const loser = winner === a ? b : a;
    return {
      kind: "switch",
      from: current,
      to: winner,
      model,
      fromCents: current === loser.network ? loser[key] : null,
      toCents: winner[key]!
    };
  }
  return { kind: "decide", reason: "brokerzy płacą w różnych modelach (CPS u jednego, CPA u drugiego)" };
}

/** The commission a chosen offer pays, for promotion.affiliateCommissionCents. */
export function offerCommissionCents(o: Pick<OfferForChoice, "cpsCents" | "cpaCents">, model?: "CPS" | "CPA"): number | null {
  if (model === "CPA") return o.cpaCents;
  if (model === "CPS") return o.cpsCents;
  return o.cpsCents ?? o.cpaCents;
}
