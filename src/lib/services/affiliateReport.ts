/**
 * The affiliate part of the owner's daily e-mail, as plain text (the agent
 * pastes it into the Resend message): what changed since the last run, the
 * owner's decisions to make, applications and payouts, contests as payout
 * for 1/2/3/5/10 clients, and offers found at only one network.
 */
import type { PrismaClient } from "@prisma/client";
import {
  contestBonusCents,
  NETWORK_LABEL,
  parseTiers,
  PAYOUT_CLIENT_COUNTS,
  STAGE_LABEL,
  type ApplicationStage,
  type Network
} from "@/lib/affiliateNetworks";

const zl = (c: number | null | undefined) => (c == null ? "—" : `${(c / 100).toLocaleString("pl-PL", { maximumFractionDigits: 2 })} zł`);
const ymd = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "—");

const SECTIONS: { title: string; kinds: string[] }[] = [
  { title: "ZMIANY LINKÓW NA STRONIE (zrobione automatycznie)", kinds: ["LINK_SWITCHED", "LINK_REVERTED"] },
  { title: "❓ DO TWOJEJ DECYZJI", kinds: ["DECISION_NEEDED"] },
  { title: "WPŁYWY PROWIZJI", kinds: ["PAYOUT"] },
  { title: "WNIOSKI (nowe i zmiany statusu)", kinds: ["APPLICATION_NEW", "APPLICATION_STAGE"] },
  { title: "STAWKI I KAMPANIE", kinds: ["OFFER_NEW", "RATE_CHANGED", "TERMS_CHANGED", "OFFER_GONE", "OFFER_RETURNED"] },
  { title: "KONKURSY", kinds: ["CONTEST_NEW", "CONTEST_CHANGED", "CONTEST_GONE"] }
];

export async function buildAffiliateReport(db: PrismaClient, since: Date, now: Date = new Date()): Promise<string> {
  const lines: string[] = [];
  const changes = await db.affiliateChange.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "asc" } });

  for (const s of SECTIONS) {
    const rows = changes.filter((c) => s.kinds.includes(c.kind));
    lines.push(`\n${s.title}`);
    if (!rows.length) lines.push("  bez zmian");
    for (const r of rows) lines.push(`  • ${r.title}`);
  }

  // Applications per network and stage, plus this month's payouts.
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const apps = await db.affiliateApplication.groupBy({ by: ["network", "stage"], _count: true });
  const paidThisMonth = await db.affiliateApplication.groupBy({
    by: ["network"],
    where: { stage: "PAID", paidAt: { gte: monthStart } },
    _sum: { amountCents: true },
    _count: true
  });
  const clicksSince = await db.affiliateApplication.groupBy({
    by: ["network"],
    where: { stage: "CLICK", openedAt: { gte: since } },
    _count: true
  });
  lines.push("\nSTAN WNIOSKÓW (wszystkie zapisane)");
  for (const net of ["EBROKER", "COMPERIA"] as Network[]) {
    const parts = apps
      .filter((a) => a.network === net)
      .map((a) => `${STAGE_LABEL[a.stage as ApplicationStage] ?? a.stage}: ${a._count}`);
    const paid = paidThisMonth.find((p) => p.network === net);
    const clicks = clicksSince.find((c) => c.network === net)?._count ?? 0;
    lines.push(
      `  ${NETWORK_LABEL[net]}: ${parts.length ? parts.join(", ") : "brak"}; kliknięcia od ostatniego raportu: ${clicks}; wypłacono w tym miesiącu: ${zl(paid?._sum.amountCents ?? 0)} (${paid?._count ?? 0} wn.)`
    );
  }

  // Active contests as payout for N clients (commission of the best counted offer + bonus).
  const contests = await db.affiliateContest.findMany({ where: { missingSince: null }, orderBy: [{ network: "asc" }, { endDate: "asc" }] });
  lines.push(`\nKONKURSY TERAZ (premia konkursowa za ${PAYOUT_CLIENT_COUNTS.join("/")} klientów; w nawiasie zwykła prowizja za nich)`);
  if (!contests.length) lines.push("  brak");
  for (const c of contests) {
    if (c.endDate && c.endDate.getTime() + 86_400_000 <= now.getTime()) continue; // ended (last day inclusive)
    const tiers = parseTiers(c.tiers);
    const offers = c.offerExternalIds.length
      ? await db.affiliateOffer.findMany({ where: { network: c.network, externalId: { in: c.offerExternalIds } }, select: { cpsCents: true, cpaCents: true } })
      : [];
    const rate = Math.max(0, ...offers.map((o) => o.cpsCents ?? o.cpaCents ?? 0)) || null;
    const payouts = PAYOUT_CLIENT_COUNTS.map((n) => `${n}: ${zl(contestBonusCents(tiers, n))}${rate ? ` (+${zl(rate * n)})` : ""}`).join(" | ");
    lines.push(`  • [${NETWORK_LABEL[c.network as Network]}] ${c.title} (${ymd(c.startDate)} – ${ymd(c.endDate)})`);
    lines.push(tiers.length ? `      ${payouts}` : "      progi nieodczytane – zobacz źródło");
    if (c.sourceUrl) lines.push(`      ${c.sourceUrl}`);
  }

  // Offers that only one network has, and which of them have no promotion on the site.
  const offers = await db.affiliateOffer.findMany({ where: { missingSince: null }, include: { promotion: { select: { slug: true } } } });
  const byPromotion = new Map<string, Set<string>>();
  for (const o of offers) if (o.promotionId) byPromotion.set(o.promotionId, (byPromotion.get(o.promotionId) ?? new Set()).add(o.network));
  const onlyOne = offers.filter((o) => o.promotionId && byPromotion.get(o.promotionId)!.size === 1);
  const unmatched = offers.filter((o) => !o.promotionId && /konto/i.test(o.category));
  lines.push("\nTYLKO U JEDNEGO BROKERA (promocje na stronie)");
  if (!onlyOne.length) lines.push("  brak");
  for (const o of onlyOne) lines.push(`  • ${NETWORK_LABEL[o.network as Network]}: ${o.bankName} – ${o.name} (CPS ${zl(o.cpsCents)} / CPA ${zl(o.cpaCents)}) → /promocje/${o.promotion?.slug}`);
  lines.push("\nKAMPANIE KONT BEZ PROMOCJI NA STRONIE");
  if (!unmatched.length) lines.push("  brak");
  for (const o of unmatched) lines.push(`  • ${NETWORK_LABEL[o.network as Network]}: ${o.bankName} – ${o.name} (CPS ${zl(o.cpsCents)} / CPA ${zl(o.cpaCents)})`);

  const own = offers.filter((o) => o.ownApplicationsAllowed === false);
  if (own.length) {
    lines.push("\nZAKAZ WNIOSKÓW WŁASNYCH (nie zakładaj przez swój link)");
    for (const o of own) lines.push(`  • ${NETWORK_LABEL[o.network as Network]}: ${o.bankName} – ${o.name}${o.ownApplicationsNote ? ` – ${o.ownApplicationsNote}` : ""}`);
  }

  return lines.join("\n").trim();
}

