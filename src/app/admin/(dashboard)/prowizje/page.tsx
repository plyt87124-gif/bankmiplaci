import Link from "next/link";
import { BadgePercent, Pin, PinOff, Trophy, Undo2 } from "lucide-react";
import { db } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";
import { getSwitchAccounts } from "@/lib/adminAccounts";
import { computeEligibility, isCurrentClient } from "@/lib/services/eligibility";
import { deadlineForGroup, groupIndexFromOrder, periodRuleOf } from "@/lib/checklistSchedule";
import {
  chooseAffiliateLink,
  contestBonusCents,
  NETWORK_LABEL,
  parseTiers,
  PAYOUT_CLIENT_COUNTS,
  STAGE_LABEL,
  type ApplicationStage,
  type ContestTier,
  type Network
} from "@/lib/affiliateNetworks";
import {
  accountTypeFromCategory,
  commissionDeadline,
  commissionEligibility,
  describeNewClientRule,
  parseNewClientRule,
  suggestPromotions,
  type CommissionDeadline,
  type MatchPromotion,
  type OwnerHistory
} from "@/lib/affiliateRules";
import { linkCampaignToPromotion, pinAffiliateNetwork, revertAffiliateLinkSwitch } from "./actions";

export const dynamic = "force-dynamic";

const NETWORKS: Network[] = ["EBROKER", "COMPERIA"];
const zl = (c: number | null | undefined) => (c == null ? "—" : `${(c / 100).toLocaleString("pl-PL", { maximumFractionDigits: 2 })} zł`);
const TONE = { ok: "text-teal-700", no: "text-coral-600", unknown: "text-ink-500" } as const;

type Tone = keyof typeof TONE;
type Own = { tone: Tone; text: string };

function describeTiers(tiers: ContestTier[]): string {
  if (!tiers.length) return "zasady do sprawdzenia w panelu";
  return tiers
    .map((t) => (t.everyN ? (t.everyN === 1 ? `${zl(t.bonusCents)} za każde konto` : `${zl(t.bonusCents)} za każde ${t.everyN} konta`) : `${zl(t.bonusCents)} po ${t.atLeast} kontach`))
    .join(", ");
}

const SORTS = {
  razem: "prowizja + premia + konkurs",
  prowizja: "prowizja (z konkursem)",
  premia: "premia banku",
  termin: "najkrótszy termin prowizji",
  mozliwosc: "mogę wziąć udział",
  bank: "bank A-Z"
} as const;
type SortKey = keyof typeof SORTS;

/**
 * Admin-only overview of what the two affiliate networks pay: per promotion
 * the rates side by side, the contest bonuses on top, whose link is live, and
 * two separate answers to "can I take part": the BROKER commission (the
 * broker's own new-client window) and the bank's PREMIUM (the promotion's
 * karencja). Campaigns that have no promotion yet are listed with the closest
 * promotion on the site and the other broker's comparable campaign.
 * Filled by the daily agent (scripts/affiliate-sync.ts).
 */
export default async function AffiliateCommissionsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const sort: SortKey = (sp.sort && sp.sort in SORTS ? sp.sort : "razem") as SortKey;
  const only = sp.tylko === "prowizja" || sp.tylko === "premia" || sp.tylko === "oba" ? sp.tylko : "";
  const onlyContest = sp.konkurs === "1";
  const where = sp.gdzie === "strona" || sp.gdzie === "poza" ? sp.gdzie : "";

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const ownEmail = getSwitchAccounts().find((a) => a.key === "own")?.email;
  const since30 = new Date(now.getTime() - 30 * 86_400_000);

  const [offers, contests, applications, stageCounts, changes, clicks, owner, promotions, catalog, rewardSteps] = await Promise.all([
    db.affiliateOffer.findMany({
      orderBy: [{ bankName: "asc" }, { name: "asc" }],
      include: {
        promotion: {
          select: {
            id: true,
            slug: true,
            name: true,
            status: true,
            bankId: true,
            accountType: true,
            maxBonusCents: true,
            endDate: true,
            cooldownMonths: true,
            cooldownCutoffDate: true,
            affiliateUrl: true,
            affiliateNetwork: true,
            affiliateNetworkPinned: true,
            bank: { select: { name: true } }
          }
        }
      }
    }),
    db.affiliateContest.findMany({ where: { missingSince: null }, orderBy: [{ endDate: "asc" }] }),
    db.affiliateApplication.findMany({ where: { stage: { not: "CLICK" } }, orderBy: { openedAt: "desc" }, take: 50 }),
    db.affiliateApplication.groupBy({ by: ["network", "stage"], _count: true, _sum: { amountCents: true } }),
    db.affiliateChange.findMany({ orderBy: { createdAt: "desc" }, take: 60 }),
    db.click.groupBy({ by: ["affiliateNetwork"], where: { createdAt: { gte: since30 } }, _count: true }),
    ownEmail
      ? db.user.findUnique({
          where: { email: ownEmail },
          select: { bankHistory: { select: { bankId: true, accountType: true, wasClientFrom: true, wasClientUntil: true } } }
        })
      : null,
    db.promotion.findMany({
      where: { status: { in: ["ACTIVE", "DRAFT"] } },
      select: { id: true, name: true, status: true, accountType: true, maxBonusCents: true, bankId: true, endDate: true, cooldownMonths: true, cooldownCutoffDate: true, bank: { select: { name: true } } }
    }),
    db.ebrokerCampaign.findMany({ where: { watched: true, ignored: false, missingSince: null }, orderBy: [{ institution: "asc" }, { name: "asc" }] }),
    db.checklistStep.findMany({
      where: { rewardCents: { not: null }, promotion: { status: { in: ["ACTIVE", "DRAFT"] } } },
      select: { promotionId: true, order: true, periodStartMonths: true, periodMonths: true }
    })
  ]);

  type Offer = (typeof offers)[number];
  type Promo = NonNullable<Offer["promotion"]>;
  const matchPromos: MatchPromotion[] = promotions.map((p) => ({
    id: p.id,
    name: p.name,
    bankName: p.bank.name,
    accountType: p.accountType,
    status: p.status,
    maxBonusCents: p.maxBonusCents
  }));
  const promoById = new Map(promotions.map((p) => [p.id, p]));

  const panelIds = new Set(offers.filter((o) => o.network === "EBROKER").map((o) => o.externalId));
  const catalogByPromo = new Map<string, (typeof catalog)[number][]>();
  const catalogUnmatched: typeof catalog = [];
  for (const c of catalog) {
    if (c.promotionId) catalogByPromo.set(c.promotionId, [...(catalogByPromo.get(c.promotionId) ?? []), c]);
    else if (!c.skipReason && !panelIds.has(c.oid)) catalogUnmatched.push(c);
  }

  const groups = new Map<string, { promotion: Promo; offers: Offer[] }>();
  const unmatchedOffers: Offer[] = [];
  for (const o of offers) {
    if (!o.promotion) {
      if (!o.missingSince) unmatchedOffers.push(o);
      continue;
    }
    const g = groups.get(o.promotion.id) ?? { promotion: o.promotion, offers: [] };
    g.offers.push(o);
    groups.set(o.promotion.id, g);
  }

  // Contests per (network, offer externalId).
  const contestsByOffer = (network: string, externalId: string) =>
    contests.filter((c) => c.network === network && c.offerExternalIds.includes(externalId));

  function history(bankId: string, accountType: string): OwnerHistory | null {
    if (!owner) return null;
    const row = owner.bankHistory.find((h) => h.bankId === bankId && h.accountType === accountType);
    if (!row) return { hasRow: false, currentClient: false };
    return { hasRow: true, wasClientFrom: row.wasClientFrom, wasClientUntil: row.wasClientUntil, currentClient: isCurrentClient(row) };
  }

  /** The bank's own premium: the promotion's karencja, never the broker's window. */
  function premiumOwn(p: { bankId: string; accountType: string; cooldownMonths: number | null; cooldownCutoffDate: Date | null }): Own {
    if (!owner) return { tone: "unknown", text: ownEmail ? "brak konta „Moje konto”" : "ustaw ADMIN_OWN_USER_EMAIL" };
    const row = owner.bankHistory.find((h) => h.bankId === p.bankId && h.accountType === p.accountType);
    if (!row || (!row.wasClientFrom && !row.wasClientUntil)) return { tone: "unknown", text: "brak historii w tym banku (jeśli nigdy nie byłeś klientem: raczej tak)" };
    const r = computeEligibility(p.cooldownMonths, p.cooldownCutoffDate, row.wasClientUntil, now, isCurrentClient(row));
    if (r.status === "eligible") return { tone: "ok", text: "tak, karencja promocji minęła" };
    if (r.currentClient) return { tone: "no", text: "nie: jesteś obecnie klientem" };
    if (r.status === "not-eligible")
      return { tone: "no", text: r.cutoffFailed || !r.eligibleFromDate ? "nie: konto zamknięte po dacie granicznej promocji" : `nie, od ${formatDate(r.eligibleFromDate)}` };
    return { tone: "unknown", text: "niepewne: promocja nie podaje karencji" };
  }

  function commissionOwn(o: Offer | undefined, bankId: string | null, accountType: string): { own: Own; rule: ReturnType<typeof parseNewClientRule> } {
    const rule = parseNewClientRule(`${o?.conditions ?? ""} ${o?.notes ?? ""}`);
    if (!o) return { own: { tone: "unknown", text: "brak kampanii" }, rule };
    const h = bankId ? history(bankId, accountType) : null;
    const r = commissionEligibility(rule, h, o.ownApplicationsAllowed);
    return { own: { tone: r.status === "yes" ? "ok" : r.status === "no" ? "no" : "unknown", text: r.text }, rule };
  }

  // ---- campaigns without a promotion: panel offers + catalog-only eBroker campaigns ----
  type Unmatched = {
    key: string;
    kind: "offer" | "catalog";
    id: string;
    network: Network;
    bankName: string;
    name: string;
    category: string;
    cps: number | null;
    cpa: number | null;
    conditions: string | null;
    notes: string | null;
    detailUrl: string | null;
    offer?: Offer;
  };
  const unmatched: Unmatched[] = [
    ...unmatchedOffers.map<Unmatched>((o) => ({
      key: `o-${o.id}`,
      kind: "offer",
      id: o.id,
      network: o.network as Network,
      bankName: o.bankName,
      name: o.name,
      category: o.category,
      cps: o.cpsCents,
      cpa: o.cpaCents,
      conditions: o.conditions,
      notes: o.notes,
      detailUrl: o.detailUrl,
      offer: o
    })),
    ...catalogUnmatched.map<Unmatched>((c) => ({
      key: `c-${c.oid}`,
      kind: "catalog",
      id: c.oid,
      network: "EBROKER",
      bankName: c.institution,
      name: c.name,
      category: c.subcategory || c.category,
      cps: null,
      cpa: null,
      conditions: null,
      notes: null,
      detailUrl: null
    }))
  ];
  const sameKind = (a: Unmatched, b: Unmatched) =>
    a.key !== b.key &&
    suggestPromotions({ bankName: a.bankName, name: a.name, category: a.category }, [{ id: "x", name: "", bankName: b.bankName, accountType: accountTypeFromCategory(b.category), status: "ACTIVE", maxBonusCents: 0 }]).length > 0;

  function LinkSuggestions({ u }: { u: Unmatched }) {
    const matches = suggestPromotions({ bankName: u.bankName, name: u.name, category: u.category }, matchPromos);
    const others = unmatched.filter((x) => x.network !== u.network && sameKind(u, x));
    return (
      <details className="mt-1 text-xs">
        <summary className="cursor-pointer text-ink-500">
          porównaj i powiąż z promocją{matches[0]?.amountMismatch ? " ⚠ inna kwota" : ""}
        </summary>
        <div className="mt-1 space-y-1">
          {others.map((x) => (
            <p key={x.key}>
              <span className="text-ink-500">{NETWORK_LABEL[x.network]}:</span> {x.name} {x.cps != null && `CPS ${zl(x.cps)} `}
              {x.cpa != null && `CPA ${zl(x.cpa)}`}
            </p>
          ))}
          {matches.length === 0 && <p className="text-ink-500">Brak promocji na stronie dla tego banku i rodzaju konta.</p>}
          {matches.slice(0, 3).map((m) => (
            <form key={m.promotion.id} action={linkCampaignToPromotion.bind(null, u.kind, u.id, m.promotion.id)} className="flex flex-wrap items-center gap-2">
              <span>
                {m.promotion.name} (do {zl(m.promotion.maxBonusCents)}, {m.promotion.status})
                {m.amountMismatch && <span className="ml-1 text-coral-600">⚠ inna kwota w nazwie kampanii</span>}
              </span>
              <button className="rounded border border-ink-100 px-2 py-0.5 hover:bg-ink-100">Powiąż</button>
            </form>
          ))}
          {u.detailUrl && (
            <a href={u.detailUrl} target="_blank" rel="noreferrer" className="text-ink-500 underline">
              panel
            </a>
          )}
        </div>
      </details>
    );
  }

  // ---- the bank's premium deadlines: the reward groups of the ściąga, for an account opened today ----
  const rewardGroups = new Map<string, Map<number, typeof rewardSteps>>();
  for (const s of rewardSteps) {
    const byGroup = rewardGroups.get(s.promotionId) ?? new Map<number, typeof rewardSteps>();
    const g = groupIndexFromOrder(s.order);
    byGroup.set(g, [...(byGroup.get(g) ?? []), s]);
    rewardGroups.set(s.promotionId, byGroup);
  }
  const dayBefore = (d: Date) => new Date(d.getTime() - 86_400_000);
  function premiumDeadlines(promotionId: string): { first: Date; last: Date; parts: number } | null {
    const byGroup = rewardGroups.get(promotionId);
    if (!byGroup?.size) return null;
    const groups = [...byGroup.keys()].sort((a, b) => a - b);
    const end = (g: number) => dayBefore(deadlineForGroup(today, g, periodRuleOf(byGroup.get(g)!)));
    return { first: end(groups[0]!), last: end(groups[groups.length - 1]!), parts: groups.length };
  }

  // ---- one row per account: promotions on the site and campaigns that have none ----
  type Row = {
    key: string;
    onSite: boolean;
    bankName: string;
    title: string;
    category: string;
    p: Promo | null;
    offers: Offer[];
    /** The campaign the commission answers are about: the live link, else the best-paying one. */
    lead: Offer | undefined;
    catalogOnly: (typeof catalog)[number][];
    choice: ReturnType<typeof chooseAffiliateLink> | null;
    bestRate: number;
    contestPerClient: number;
    hasContest: boolean;
    total: number;
    commission: { own: Own; rule: ReturnType<typeof parseNewClientRule> };
    commissionBy: CommissionDeadline | null;
    premium: Own | null;
    premiumBy: ReturnType<typeof premiumDeadlines>;
    unmatched?: Unmatched;
  };
  const rate = (o: Offer | undefined) => (o ? (o.cpsCents ?? 0) + (o.cpaCents ?? 0) : 0);
  const contestPer = (o: Offer | undefined) =>
    o ? Math.round(contestsByOffer(o.network, o.externalId).reduce((s, c) => s + contestBonusCents(parseTiers(c.tiers), 10), 0) / 10) : 0;

  const siteRows: Row[] = [...groups.values()].map(({ promotion: p, offers: g }) => {
    const current = g.filter((o) => !o.missingSince);
    const best = [...current].sort((a, b) => rate(b) - rate(a))[0];
    const lead = current.find((o) => o.network === p.affiliateNetwork) ?? best ?? g[0];
    const commission = commissionOwn(lead, p.bankId, p.accountType);
    const contestPerClient = contestPer(lead);
    return {
      key: p.id,
      onSite: true,
      bankName: p.bank.name,
      title: p.name,
      category: p.accountType === "BUSINESS" ? "konto firmowe" : "konto osobiste",
      p,
      offers: g,
      lead,
      catalogOnly: (catalogByPromo.get(p.id) ?? []).filter((c) => !panelIds.has(c.oid)),
      choice: chooseAffiliateLink(p, g, now),
      bestRate: rate(best),
      contestPerClient,
      hasContest: g.some((o) => contestsByOffer(o.network, o.externalId).length > 0),
      total: rate(lead) + p.maxBonusCents + contestPerClient,
      commission,
      commissionBy: commissionDeadline(lead?.conditions, today),
      premium: premiumOwn(p),
      premiumBy: premiumDeadlines(p.id)
    };
  });

  const offSiteRows: Row[] = unmatched.map((u) => {
    const matches = suggestPromotions({ bankName: u.bankName, name: u.name, category: u.category }, matchPromos);
    const top = matches[0] ? promoById.get(matches[0].promotion.id) : undefined;
    const commission = commissionOwn(u.offer, top?.bankId ?? null, accountTypeFromCategory(u.category) === "BUSINESS" ? "BUSINESS" : top?.accountType ?? "PERSONAL");
    const contestPerClient = u.offer ? contestPer(u.offer) : 0;
    const r = (u.cps ?? 0) + (u.cpa ?? 0);
    return {
      key: u.key,
      onSite: false,
      bankName: u.bankName,
      title: u.name,
      category: u.category,
      p: null,
      offers: u.offer ? [u.offer] : [],
      lead: u.offer,
      catalogOnly: [],
      choice: null,
      bestRate: r,
      contestPerClient,
      hasContest: contestPerClient > 0 || (u.kind === "catalog" && contestsByOffer("EBROKER", u.id).length > 0),
      total: r + contestPerClient,
      commission,
      commissionBy: commissionDeadline(u.conditions, today),
      premium: null,
      premiumBy: null,
      unmatched: u
    };
  });

  const rank = (t: Tone | undefined) => (t === "ok" ? 0 : t === "unknown" || !t ? 1 : 2);
  const shown = [...siteRows, ...offSiteRows]
    .filter((r) => (where === "strona" ? r.onSite : where === "poza" ? !r.onSite : true))
    .filter((r) =>
      only === "prowizja"
        ? r.commission.own.tone === "ok"
        : only === "premia"
          ? r.premium?.tone === "ok"
          : only === "oba"
            ? r.commission.own.tone === "ok" && r.premium?.tone === "ok"
            : true
    )
    .filter((r) => (onlyContest ? r.hasContest : true))
    .sort((a, b) => {
      if (sort === "bank") return a.bankName.localeCompare(b.bankName, "pl") || a.title.localeCompare(b.title, "pl");
      if (sort === "prowizja") return b.bestRate + b.contestPerClient - (a.bestRate + a.contestPerClient) || b.total - a.total;
      if (sort === "premia") return (b.p?.maxBonusCents ?? -1) - (a.p?.maxBonusCents ?? -1) || b.bestRate - a.bestRate;
      if (sort === "mozliwosc") return rank(a.commission.own.tone) - rank(b.commission.own.tone) || b.total - a.total;
      if (sort === "termin") return (a.commissionBy?.date.getTime() ?? Infinity) - (b.commissionBy?.date.getTime() ?? Infinity) || b.total - a.total;
      return b.total - a.total;
    });

  const href = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams();
    const cur: Record<string, string | undefined> = { sort: sp.sort, tylko: sp.tylko, konkurs: sp.konkurs, gdzie: sp.gdzie };
    for (const [k, v] of Object.entries({ ...cur, ...patch })) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/admin/prowizje?${s}` : "/admin/prowizje";
  };
  const chip = (active: boolean) => `rounded border px-2 py-1 ${active ? "border-ink-solid bg-ink-solid text-white" : "border-ink-100 hover:bg-ink-100"}`;

  const clickCount = (n: Network | null) => clicks.find((c) => c.affiliateNetwork === n)?._count ?? 0;

  return (
    <div className="space-y-10">
      <div className="flex items-start gap-3">
        <BadgePercent className="mt-1 h-6 w-6 text-gold-600" />
        <div>
          <h1 className="text-2xl font-semibold">Prowizje brokerów</h1>
          <p className="mt-1 max-w-3xl text-sm text-ink-500">
            Wszystkie konta z obu sieci, te z promocją na stronie i te bez niej. Każde konto ma dwie osobne części, bo to dwa różne pieniądze:{" "}
            <strong>prowizja</strong> (płaci broker, ma własny termin i własne okno „nowego klienta”) i <strong>premia</strong> (płaci bank, ma termin i
            karencję z regulaminu promocji). Terminy są policzone dla konta otwartego dziś, {formatDate(today)}. Dane codziennie odczytuje agent z paneli.
          </p>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        {NETWORKS.map((n) => {
          const paid = stageCounts.filter((s) => s.network === n && s.stage === "PAID");
          const pending = stageCounts.filter((s) => s.network === n && ["SENT", "PENDING", "ACCEPTED"].includes(s.stage));
          return (
            <div key={n} className="rounded-xl2 border border-ink-100 p-4 text-sm">
              <p className="font-semibold text-ink-900">{NETWORK_LABEL[n]}</p>
              <p className="mt-1 text-ink-500">Kliknięcia z naszej strony (30 dni): {clickCount(n)}</p>
              <p className="text-ink-500">W toku: {pending.reduce((s, x) => s + x._count, 0)} wn. ({zl(pending.reduce((s, x) => s + (x._sum.amountCents ?? 0), 0))})</p>
              <p className="text-ink-500">Wypłacono: {paid.reduce((s, x) => s + x._count, 0)} wn. ({zl(paid.reduce((s, x) => s + (x._sum.amountCents ?? 0), 0))})</p>
            </div>
          );
        })}
        <div className="rounded-xl2 border border-ink-100 p-4 text-sm text-ink-500">Kliknięcia bez przypisanego brokera (sprzed zmiany): {clickCount(null)}</div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">
          Konta i stawki ({siteRows.length} na stronie, {offSiteRows.length} bez promocji na stronie)
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-ink-500">Sortuj:</span>
          {(Object.keys(SORTS) as SortKey[]).map((k) => (
            <Link key={k} href={href({ sort: k })} className={chip(sort === k)}>
              {SORTS[k]}
            </Link>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-ink-500">Konta:</span>
          {[
            ["", "wszystkie"],
            ["strona", "z promocją na stronie"],
            ["poza", "bez promocji (sama prowizja)"]
          ].map(([k, label]) => (
            <Link key={k} href={href({ gdzie: k || null })} className={chip(where === k)}>
              {label}
            </Link>
          ))}
          <span className="ml-3 text-ink-500">Tylko, gdzie mogę:</span>
          {[
            ["", "wszystko"],
            ["prowizja", "wziąć prowizję"],
            ["premia", "wziąć premię"],
            ["oba", "prowizję i premię"]
          ].map(([k, label]) => (
            <Link key={k} href={href({ tylko: k || null })} className={chip(only === k)}>
              {label}
            </Link>
          ))}
          <Link href={href({ konkurs: onlyContest ? null : "1" })} className={chip(onlyContest)}>
            tylko z konkursem
          </Link>
        </div>
        <p className="mt-2 text-xs text-ink-500">
          „Razem” = prowizja z linku, który jest teraz na stronie + premia banku + konkurs na jednego klienta (średnio przy 10 kontach). Sortowanie po prowizji bierze
          lepszą stawkę z obu sieci razem z konkursem. „Do kiedy” to ostatni dzień na spełnienie warunków, gdy wniosek i umowa są dziś.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl2 border border-ink-100">
          <table className="w-full min-w-[1400px] text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-100/40 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                <th className="p-3" rowSpan={2}>
                  Konto
                </th>
                <th className="border-l border-ink-100 p-3 text-center" colSpan={3}>
                  Prowizja brokera
                </th>
                <th className="border-l border-ink-100 p-3 text-center" colSpan={3}>
                  Premia banku
                </th>
                <th className="border-l border-ink-100 p-3" rowSpan={2}>
                  Razem
                </th>
                <th className="p-3" rowSpan={2}>
                  Link teraz
                </th>
              </tr>
              <tr className="border-b border-ink-100 bg-ink-100/40 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                <th className="border-l border-ink-100 p-3">Stawki</th>
                <th className="p-3">Do kiedy</th>
                <th className="p-3">Karencja</th>
                <th className="border-l border-ink-100 p-3">Kwota</th>
                <th className="p-3">Do kiedy</th>
                <th className="p-3">Karencja</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.key} className={`border-b border-ink-100 align-top last:border-0 ${r.onSite ? "" : "bg-ink-100/20"}`}>
                  <td className="max-w-[260px] p-3">
                    {r.p ? (
                      <Link href={`/admin/promocje/${r.p.id}`} className="font-medium text-ink-900 hover:underline">
                        {r.bankName}: {r.title}
                      </Link>
                    ) : (
                      <p className="font-medium text-ink-900">
                        {r.bankName}: {r.title}
                      </p>
                    )}
                    <p className="text-xs text-ink-500">
                      {r.category}
                      {r.p ? ` · ${r.p.status}` : ""}
                      {!r.onSite && r.unmatched && ` · tylko ${NETWORK_LABEL[r.unmatched.network]}, brak promocji na stronie`}
                    </p>
                    {r.unmatched && <LinkSuggestions u={r.unmatched} />}
                  </td>

                  <td className="max-w-[260px] border-l border-ink-100 p-3">
                    {NETWORKS.map((n) => {
                      const o = r.offers.find((x) => x.network === n && !x.missingSince);
                      if (!o) {
                        if (n === "EBROKER" && r.catalogOnly.length)
                          return (
                            <p key={n} className="text-xs text-ink-500">
                              {NETWORK_LABEL[n]}: tylko link z katalogu, stawki nie odczytano
                            </p>
                          );
                        if (!r.onSite && r.unmatched && r.unmatched.network === n && r.unmatched.kind === "catalog")
                          return (
                            <p key={n} className="text-xs text-ink-500">
                              {NETWORK_LABEL[n]}: stawka z panelu nieodczytana
                            </p>
                          );
                        return r.onSite ? (
                          <p key={n} className="text-xs text-ink-300">
                            {NETWORK_LABEL[n]}: brak
                          </p>
                        ) : null;
                      }
                      const isBest = rate(o) === r.bestRate && r.offers.length > 1;
                      return (
                        <div key={n} className="mb-1">
                          <p className={isBest ? "font-semibold text-ink-900" : "text-ink-700"}>
                            {NETWORK_LABEL[n]}: {o.cpsCents != null && `CPS ${zl(o.cpsCents)}`} {o.cpaCents != null && `CPA ${zl(o.cpaCents)}`}
                          </p>
                          {contestsByOffer(o.network, o.externalId).map((c) => (
                            <p key={c.id} className="flex items-start gap-1 text-xs text-gold-600">
                              <Trophy className="mt-0.5 h-3 w-3 shrink-0" />
                              <span>
                                {describeTiers(parseTiers(c.tiers))}
                                {c.endDate ? `, do ${formatDate(c.endDate)}` : ""}
                              </span>
                            </p>
                          ))}
                        </div>
                      );
                    })}
                    {r.lead?.conditions && (
                      <details className="mt-1 text-xs text-ink-500">
                        <summary className="cursor-pointer">kiedy należy się prowizja ({NETWORK_LABEL[r.lead.network as Network]})</summary>
                        <p className="mt-1 whitespace-pre-line">{r.lead.conditions}</p>
                        {r.lead.notes && <p className="mt-1 whitespace-pre-line text-ink-300">{r.lead.notes}</p>}
                      </details>
                    )}
                    {r.lead?.ownApplicationsAllowed === false && <p className="text-xs text-coral-600">zakaz wniosków własnych</p>}
                  </td>
                  <td className="p-3 text-xs">
                    {r.commissionBy ? (
                      <>
                        <p className="text-sm font-semibold text-ink-900">{formatDate(r.commissionBy.date)}</p>
                        <p className="text-ink-500">{r.commissionBy.basis}</p>
                      </>
                    ) : r.lead ? (
                      <p className="text-ink-500">bez terminu: za samo otwarcie / umowę</p>
                    ) : (
                      <p className="text-ink-300">—</p>
                    )}
                  </td>
                  <td className="p-3 text-xs">
                    <p className={TONE[r.commission.own.tone]}>{r.commission.own.text}</p>
                    <p className="mt-0.5 text-ink-500">{describeNewClientRule(r.commission.rule)}</p>
                  </td>

                  <td className="border-l border-ink-100 p-3">
                    {r.p ? (
                      <>
                        <p className="font-semibold text-ink-900">{zl(r.p.maxBonusCents)}</p>
                        <p className="text-xs text-ink-500">konto otwórz do {formatDate(r.p.endDate)}</p>
                      </>
                    ) : (
                      <p className="text-xs text-ink-500">brak premii na stronie</p>
                    )}
                  </td>
                  <td className="p-3 text-xs">
                    {r.premiumBy ? (
                      <>
                        <p className="text-sm font-semibold text-ink-900">{formatDate(r.premiumBy.last)}</p>
                        <p className="text-ink-500">
                          {r.premiumBy.parts > 1 ? `${r.premiumBy.parts} części premii, pierwsza do ${formatDate(r.premiumBy.first)}` : "jedna nagroda"}
                        </p>
                      </>
                    ) : r.p ? (
                      <p className="text-ink-500">brak ściągi z terminami</p>
                    ) : (
                      <p className="text-ink-300">—</p>
                    )}
                  </td>
                  <td className="p-3 text-xs">
                    {r.p && r.premium ? (
                      <>
                        <p className={TONE[r.premium.tone]}>{r.premium.text}</p>
                        <p className="mt-0.5 text-ink-500">
                          {r.p.cooldownMonths != null ? `${r.p.cooldownMonths} mies. od zamknięcia konta` : r.p.cooldownCutoffDate ? "" : "regulamin nie podaje karencji"}
                          {r.p.cooldownCutoffDate ? `brak konta od ${formatDate(r.p.cooldownCutoffDate)}` : ""}
                        </p>
                      </>
                    ) : (
                      <p className="text-ink-300">—</p>
                    )}
                  </td>

                  <td className="border-l border-ink-100 p-3">
                    <p className="font-semibold text-ink-900">{zl(r.total)}</p>
                    <p className="text-xs text-ink-500">
                      {zl(r.total - (r.p?.maxBonusCents ?? 0) - r.contestPerClient)}
                      {r.p ? ` + ${zl(r.p.maxBonusCents)}` : ""}
                      {r.contestPerClient ? ` + ${zl(r.contestPerClient)}` : ""}
                    </p>
                  </td>
                  <td className="p-3">
                    {r.p && r.choice ? (
                      <>
                        <p className="font-medium text-ink-900">
                          {r.p.affiliateNetwork ? NETWORK_LABEL[r.p.affiliateNetwork as Network] : "?"}
                          {r.p.affiliateNetworkPinned && <span className="ml-1 text-xs text-gold-600">(przypięty)</span>}
                        </p>
                        <p className="text-xs text-ink-500">
                          {r.choice.kind === "switch" ? `jutro przełączy na ${NETWORK_LABEL[r.choice.to.network]}` : r.choice.kind === "decide" ? `❓ ${r.choice.reason}` : r.choice.reason}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {NETWORKS.filter((n) => r.offers.some((x) => x.network === n && x.trackingUrl && !x.missingSince) || (n === "EBROKER" && r.catalogOnly.length > 0)).map((n) => (
                            <form key={n} action={pinAffiliateNetwork.bind(null, r.p!.id, n)}>
                              <button className="flex items-center gap-1 rounded border border-ink-100 px-2 py-0.5 text-xs hover:bg-ink-100">
                                <Pin className="h-3 w-3" /> {NETWORK_LABEL[n]}
                              </button>
                            </form>
                          ))}
                          {r.p.affiliateNetworkPinned && (
                            <form action={pinAffiliateNetwork.bind(null, r.p.id, null)}>
                              <button className="flex items-center gap-1 rounded border border-ink-100 px-2 py-0.5 text-xs hover:bg-ink-100">
                                <PinOff className="h-3 w-3" /> odepnij
                              </button>
                            </form>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-ink-300">—</p>
                    )}
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-ink-500">
                    Brak pozycji dla tych filtrów.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Trophy className="h-5 w-5 text-gold-600" /> Konkursy i bonusy
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-ink-500">
          Premia za liczbę rozliczonych kont, płatna przez brokera ponad zwykłą prowizję. Poniżej: ile łącznie zarobisz przy N klientach (prowizja + konkurs), kto ma
          lepsze warunki w tej samej promocji i czy możesz wziąć udział. Brak okresu oznacza, że panel go nie podaje.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl2 border border-ink-100">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-100/40 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                <th className="p-3">Konkurs</th>
                <th className="p-3">Okres</th>
                <th className="p-3">Zasady</th>
                {PAYOUT_CLIENT_COUNTS.map((n) => (
                  <th key={n} className="p-3">
                    {n} kl. razem
                  </th>
                ))}
                <th className="p-3">Kampanie</th>
                <th className="p-3">Czy Ty możesz</th>
              </tr>
            </thead>
            <tbody>
              {contests.map((c) => {
                const tiers = parseTiers(c.tiers);
                const camp = offers.filter((o) => o.network === c.network && c.offerExternalIds.includes(o.externalId));
                const rate = Math.max(0, ...camp.map((o) => o.cpsCents ?? o.cpaCents ?? 0));
                const first = camp[0];
                const own = first ? commissionOwn(first, first.promotion?.bankId ?? null, first.promotion?.accountType ?? "PERSONAL").own : ({ tone: "unknown", text: "kampania bez promocji na stronie" } as Own);
                // Best across networks for the same promotion, at 5 clients.
                const rivals = first?.promotion ? contests.filter((x) => x.id !== c.id && offers.some((o) => o.promotionId === first.promotionId && o.network === x.network && x.offerExternalIds.includes(o.externalId))) : [];
                const mine5 = rate * 5 + contestBonusCents(tiers, 5);
                const better = rivals.some((r) => {
                  const ro = offers.filter((o) => o.network === r.network && r.offerExternalIds.includes(o.externalId) && o.promotionId === first?.promotionId);
                  return Math.max(0, ...ro.map((o) => o.cpsCents ?? o.cpaCents ?? 0)) * 5 + contestBonusCents(parseTiers(r.tiers), 5) > mine5;
                });
                return (
                  <tr key={c.id} className="border-b border-ink-100 align-top last:border-0">
                    <td className="p-3">
                      <span className="text-ink-500">{NETWORK_LABEL[c.network as Network]}:</span>{" "}
                      {c.sourceUrl ? (
                        <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="hover:underline">
                          {c.title}
                        </a>
                      ) : (
                        c.title
                      )}
                      {rivals.length > 0 && <p className={`text-xs ${better ? "text-coral-600" : "text-teal-700"}`}>{better ? "u drugiego brokera przy 5 kontach wychodzi więcej" : "najlepsze warunki przy 5 kontach"}</p>}
                    </td>
                    <td className="p-3 text-xs text-ink-500">
                      {c.startDate || c.endDate ? `${c.startDate ? formatDate(c.startDate) : "?"} – ${c.endDate ? formatDate(c.endDate) : "?"}` : "okres nie podany"}
                    </td>
                    <td className="p-3 text-xs">{describeTiers(tiers)}</td>
                    {PAYOUT_CLIENT_COUNTS.map((n) => (
                      <td key={n} className="p-3">
                        {tiers.length ? zl(rate * n + contestBonusCents(tiers, n)) : "?"}
                        {tiers.length > 0 && rate > 0 && <span className="block text-xs text-ink-300">w tym konkurs {zl(contestBonusCents(tiers, n))}</span>}
                      </td>
                    ))}
                    <td className="p-3 text-xs text-ink-500">{camp.length ? camp.map((o) => o.name).join("; ") : c.offerExternalIds.join(", ") || "—"}</td>
                    <td className={`p-3 text-xs ${TONE[own.tone]}`}>{own.text}</td>
                  </tr>
                );
              })}
              {contests.length === 0 && (
                <tr>
                  <td colSpan={4 + PAYOUT_CLIENT_COUNTS.length} className="p-6 text-center text-ink-500">
                    Brak konkursów w danych. Agent dopisze je po odczycie paneli.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Wnioski (ostatnie 50, bez samych kliknięć)</h2>
        <div className="mt-3 overflow-x-auto rounded-xl2 border border-ink-100">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-100/40 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                <th className="p-3">Data</th>
                <th className="p-3">Broker</th>
                <th className="p-3">Produkt</th>
                <th className="p-3">Status</th>
                <th className="p-3">Kwota</th>
                <th className="p-3">Wypłata</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((a) => (
                <tr key={a.id} className="border-b border-ink-100 last:border-0">
                  <td className="p-3 text-ink-500">{formatDateTime(a.openedAt)}</td>
                  <td className="p-3">{NETWORK_LABEL[a.network as Network]}</td>
                  <td className="p-3">
                    {a.bankName}: {a.productName}
                  </td>
                  <td className="p-3">{STAGE_LABEL[a.stage as ApplicationStage] ?? a.stage}</td>
                  <td className="p-3">{zl(a.amountCents)}</td>
                  <td className="p-3 text-ink-500">{a.paidAt ? formatDate(a.paidAt) : "—"}</td>
                </tr>
              ))}
              {applications.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-ink-500">
                    Brak wniosków.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Historia zmian</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {changes.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-ink-300">{formatDateTime(c.createdAt)}</span>
              <span>{c.title}</span>
              {c.kind === "LINK_SWITCHED" && (
                <form action={revertAffiliateLinkSwitch.bind(null, c.id)}>
                  <button className="flex items-center gap-1 rounded border border-ink-100 px-2 py-0.5 text-xs hover:bg-ink-100">
                    <Undo2 className="h-3 w-3" /> cofnij i przypnij poprzedni
                  </button>
                </form>
              )}
            </li>
          ))}
          {changes.length === 0 && <li className="text-ink-500">Brak zmian.</li>}
        </ul>
      </section>
    </div>
  );
}
