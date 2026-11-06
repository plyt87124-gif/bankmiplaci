/**
 * What one new client is worth to us, in grosze: the commission of a campaign
 * plus the sales contest that sits on top of it. One definition for every
 * consumer: the "Razem" column of /admin/prowizje, the "Polecane" ordering and
 * the "ocena serwisu" (services/ratings.ts), so the three can never disagree.
 *
 *   commission  CPS + CPA of the campaign (the panel's own "stawka");
 *   contest     the contest bonus averaged per client at CONTEST_REFERENCE_CLIENTS
 *               clients. A contest that pays "za każde jedno konto"
 *               (tiers: [{ everyN: 1 }]) is simply a higher commission and counts in full.
 *               Every other bonus (per N accounts, or one-off after N accounts) counts at
 *               MULTI_ACCOUNT_CONTEST_WEIGHT of its per-client value (owner, 6.11.2026), on top of
 *               being spread over the accounts it takes: "za każde 3 konta 150 zł" is 45 zł per
 *               client at 10 clients, counted as 22,50 zł. A bonus that needs more than
 *               CONTEST_REFERENCE_CLIENTS accounts adds nothing (for now), nor does a ranking.
 *
 * A contest counts only while it runs: from its first day to the end of its last day on
 * Poland's calendar (isContestRunning). So a contest "do końca listopada" stops counting on
 * 1 December by itself, whenever the rating is next computed; nobody has to notice that it ended.
 *
 * Pure (no database): the callers pass the rows they have read.
 */
import { contestBonusCents, parseTiers, type ContestTier } from "@/lib/affiliateNetworks";
import { isDeadlinePassed, signupCutoff } from "@/lib/promotionAvailability";

/** The number of clients the per-client contest value is averaged over. */
export const CONTEST_REFERENCE_CLIENTS = 10;

/** How much of its per-client value a contest bonus that needs several accounts counts for (one account: 1). */
export const MULTI_ACCOUNT_CONTEST_WEIGHT = 0.5;

/** 1 for a bonus paid for every single account, MULTI_ACCOUNT_CONTEST_WEIGHT for every other kind. */
export function contestTierWeight(tier: ContestTier): number {
  return tier.everyN === 1 ? 1 : MULTI_ACCOUNT_CONTEST_WEIGHT;
}

export interface CommissionOffer {
  network: string;
  externalId: string;
  cpsCents: number | null;
  cpaCents: number | null;
  missingSince?: Date | null;
}

export interface CommissionContest {
  network: string;
  offerExternalIds: readonly string[];
  tiers: unknown;
  missingSince?: Date | null;
  /** First and last day of the contest (stored as midnight UTC of that date); null = not given. */
  startDate?: Date | null;
  endDate?: Date | null;
}

/** Commission of one campaign for one client, grosze. */
export function offerRateCents(o: Pick<CommissionOffer, "cpsCents" | "cpaCents">): number {
  return (o.cpsCents ?? 0) + (o.cpaCents ?? 0);
}

/**
 * Contest bonus per client for the given contests (those that count the campaign), grosze, weighted:
 * a bonus for every single account in full, any other bonus at MULTI_ACCOUNT_CONTEST_WEIGHT. This is the value
 * of the contest to us (rating, "Polecane", "Razem"); the real payouts shown elsewhere stay unweighted.
 */
export function contestPerClientCents(contests: readonly Pick<CommissionContest, "tiers">[]): number {
  let total = 0;
  for (const c of contests) {
    for (const tier of parseTiers(c.tiers)) total += contestBonusCents([tier], CONTEST_REFERENCE_CLIENTS) * contestTierWeight(tier);
  }
  return Math.round(total / CONTEST_REFERENCE_CLIENTS);
}

/**
 * Is the contest inside its period? The whole last day counts (same rule as an offer's sign-up deadline,
 * Polish calendar); a missing date leaves that side open.
 */
export function isContestRunning(c: Pick<CommissionContest, "startDate" | "endDate">, now: Date = new Date()): boolean {
  if (c.endDate && isDeadlinePassed(c.endDate, now)) return false;
  if (c.startDate && new Date(c.startDate).getTime() > signupCutoff(now).getTime()) return false;
  return true;
}

/** The contests that count a campaign and are running now. */
export function contestsForOffer<C extends CommissionContest>(
  offer: Pick<CommissionOffer, "network" | "externalId">,
  contests: readonly C[],
  now: Date = new Date()
): C[] {
  return contests.filter(
    (c) => !c.missingSince && c.network === offer.network && c.offerExternalIds.includes(offer.externalId) && isContestRunning(c, now)
  );
}

/** Commission + contest of one campaign per client, grosze. */
export function offerPayoutPerClientCents(offer: CommissionOffer, contests: readonly CommissionContest[], now: Date = new Date()): number {
  return offerRateCents(offer) + contestPerClientCents(contestsForOffer(offer, contests, now));
}

/**
 * The best (highest) payout per client among the campaigns of one promotion
 * that are still in the panel; null when there is no such campaign (unknown, not zero).
 */
export function effectiveCommissionCents(
  offers: readonly CommissionOffer[],
  contests: readonly CommissionContest[],
  now: Date = new Date()
): number | null {
  const current = offers.filter((o) => !o.missingSince);
  if (current.length === 0) return null;
  return Math.max(...current.map((o) => offerPayoutPerClientCents(o, contests, now)));
}
