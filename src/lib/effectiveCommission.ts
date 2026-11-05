/**
 * What one new client is worth to us, in grosze: the commission of a campaign
 * plus the sales contest that sits on top of it. One definition for every
 * consumer: the "Razem" column of /admin/prowizje, the "Polecane" ordering and
 * the "ocena serwisu" (services/ratings.ts), so the three can never disagree.
 *
 *   commission  CPS + CPA of the campaign (the panel's own "stawka");
 *   contest     the contest bonus averaged per client at CONTEST_REFERENCE_CLIENTS
 *               clients. A contest that pays "za każde jedno konto"
 *               (tiers: [{ everyN: 1 }]) is simply a higher commission, a contest
 *               "za każde 3 konta" counts for a third of its bonus per client.
 *
 * Pure (no database): the callers pass the rows they have read.
 */
import { contestBonusCents, parseTiers } from "@/lib/affiliateNetworks";

/** The number of clients the per-client contest value is averaged over. */
export const CONTEST_REFERENCE_CLIENTS = 10;

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
}

/** Commission of one campaign for one client, grosze. */
export function offerRateCents(o: Pick<CommissionOffer, "cpsCents" | "cpaCents">): number {
  return (o.cpsCents ?? 0) + (o.cpaCents ?? 0);
}

/** Contest bonus per client for the given contests (those that count the campaign), grosze. */
export function contestPerClientCents(contests: readonly Pick<CommissionContest, "tiers">[]): number {
  const total = contests.reduce((sum, c) => sum + contestBonusCents(parseTiers(c.tiers), CONTEST_REFERENCE_CLIENTS), 0);
  return Math.round(total / CONTEST_REFERENCE_CLIENTS);
}

/** The contests that count a campaign. */
export function contestsForOffer<C extends CommissionContest>(
  offer: Pick<CommissionOffer, "network" | "externalId">,
  contests: readonly C[]
): C[] {
  return contests.filter((c) => !c.missingSince && c.network === offer.network && c.offerExternalIds.includes(offer.externalId));
}

/** Commission + contest of one campaign per client, grosze. */
export function offerPayoutPerClientCents(offer: CommissionOffer, contests: readonly CommissionContest[]): number {
  return offerRateCents(offer) + contestPerClientCents(contestsForOffer(offer, contests));
}

/**
 * The best (highest) payout per client among the campaigns of one promotion
 * that are still in the panel; null when there is no such campaign (unknown, not zero).
 */
export function effectiveCommissionCents(offers: readonly CommissionOffer[], contests: readonly CommissionContest[]): number | null {
  const current = offers.filter((o) => !o.missingSince);
  if (current.length === 0) return null;
  return Math.max(...current.map((o) => offerPayoutPerClientCents(o, contests)));
}
