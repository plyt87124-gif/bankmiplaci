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
  groupOffSiteItems,
  isAccountCampaign,
  normalizeBank,
  NETWORK_RULES,
  promoRestrictions,
  suggestPromotions,
  type CommissionDeadline,
  type PromoRestriction,
  type MatchPromotion,
  type OwnerHistory
} from "@/lib/affiliateRules";
import { linkCampaignsToPromotion, pinAffiliateNetwork, revertAffiliateLinkSwitch } from "./actions";

export const dynamic = "force-dynamic";

const NETWORKS: Network[] = ["EBROKER", "COMPERIA"];
const zl = (c: number | null | undefined) => (c == null ? "—" : `${(c / 100).toLocaleString("pl-PL", { maximumFractionDigits: 2 })} zł`);
const TONE = { ok: "text-teal-700", no: "text-coral-600", unknown: "text-ink-500" } as const;

type Tone = keyof typeof TONE;
type Own = { tone: Tone; text: string; from?: Date };

function describeTiers(tiers: ContestTier[], title?: string): string {
  if (!tiers.length) return title ?? "zasady do sprawdzenia w panelu";
  return tiers
    .map((t) =>
      t.everyN
        ? t.everyN === 1
          ? `${zl(t.bonusCents)} za każde konto`
          : `${zl(t.bonusCents)} za każde ${t.everyN} ${t.everyN < 5 ? "konta" : "kont"}`
        : `${zl(t.bonusCents)} po ${t.atLeast} kontach`
    )
    .join(", ");
}

const SORTS = {
  razem: "prowizja + premia",
  prowizja: "prowizja (z konkursem)",
  premia: "premia banku",
  termin: "najkrótszy termin prowizji",
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
  const sort: SortKey = (sp.sort && sp.sort in SORTS ? sp.sort : "prowizja") as SortKey;
  // Sorting is always by the chosen amount; accounts where the commission is
  // ruled out are dimmed, or hidden with this switch.
  const only = sp.tylko === "prowizja" || sp.tylko === "premia" || sp.tylko === "oba" || sp.tylko === "wkrotce" ? sp.tylko : "";
  const onlyContest = sp.konkurs === "1";
  const where = sp.gdzie === "strona" || sp.gdzie === "poza" ? sp.gdzie : "";
  const hideNo = sp.moge === "ukryj";
  // Bank sections only for the default view; any other sort or filter gives one ranked list, unless the view is chosen.
  const customized = Boolean(sp.sort && sp.sort !== "prowizja") || only !== "" || onlyContest || hideNo || where !== "";
  const byBank = sp.widok === "banki" ? true : sp.widok === "lista" ? false : !customized;

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const ownEmail = getSwitchAccounts().find((a) => a.key === "own")?.email;
  const since30 = new Date(now.getTime() - 30 * 86_400_000);

  const [offers, contests, applications, stageCounts, changes, clicks, owner, promotions, catalog, rewardSteps, banks] = await Promise.all([
    db.affiliateOffer.findMany({
      orderBy: [{ bankName: "asc" }, { name: "asc" }],
      include: {
        promotion: {
          select: {
            id: true,
            slug: true,
            name: true,
            status: true,
            adminOnly: true,
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
    }),
    db.bank.findMany({ select: { id: true, name: true, slug: true, logoUrl: true } })
  ]);
  // Network panels name banks their own way; the owner's history is keyed by our bank.
  const bankIdByKey = new Map(banks.flatMap((b) => [[normalizeBank(b.name), b.id] as const, [normalizeBank(b.slug), b.id] as const]));
  const bankIdOf = (name: string) => bankIdByKey.get(normalizeBank(name)) ?? null;
  const bankNameByKey = new Map(banks.flatMap((b) => [[normalizeBank(b.name), b.name] as const, [normalizeBank(b.slug), b.name] as const]));
  const logoByKey = new Map(banks.flatMap((b) => (b.logoUrl ? [[normalizeBank(b.name), b.logoUrl] as const, [normalizeBank(b.slug), b.logoUrl] as const] : [])));

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
    else if (!c.skipReason && !panelIds.has(c.oid) && isAccountCampaign({ name: c.name, category: c.subcategory || c.category })) catalogUnmatched.push(c);
  }

  const groups = new Map<string, { promotion: Promo; offers: Offer[]; sameAccount: Offer[] }>();
  const unmatchedOffers: Offer[] = [];
  for (const o of offers) {
    if (!o.promotion) {
      if (!o.missingSince && isAccountCampaign(o)) unmatchedOffers.push(o);
      continue;
    }
    if (o.promotion.accountType === "SAVINGS") continue;
    const g = groups.get(o.promotion.id) ?? { promotion: o.promotion, offers: [], sameAccount: [] };
    g.offers.push(o);
    groups.set(o.promotion.id, g);
  }
  // A network often lists one account under several campaign numbers with the
  // same name; an unlinked twin of a linked campaign is shown in that row, not
  // as a second account. The link choice still only uses the linked ones.
  const nameKey = (o: Offer) => `${o.network}|${normalizeBank(o.bankName)}|${o.name.toLowerCase().replace(/\s+/g, " ").trim()}`;
  const groupByName = new Map([...groups.values()].flatMap((g) => g.offers.map((o) => [nameKey(o), g] as const)));
  for (const o of [...unmatchedOffers]) {
    const g = groupByName.get(nameKey(o));
    if (!g) continue;
    g.sameAccount.push(o);
    unmatchedOffers.splice(unmatchedOffers.indexOf(o), 1);
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
      return r.cutoffFailed || !r.eligibleFromDate
        ? { tone: "no", text: "nie: konto zamknięte po dacie granicznej promocji" }
        : { tone: "no", text: `nie, od ${formatDate(r.eligibleFromDate)}`, from: r.eligibleFromDate };
    return { tone: "unknown", text: "niepewne: promocja nie podaje karencji" };
  }

  function commissionOwn(o: Offer | undefined, bankId: string | null, accountType: string): { own: Own; rule: ReturnType<typeof parseNewClientRule> } {
    const rule = parseNewClientRule(`${o?.conditions ?? ""} ${o?.notes ?? ""}`);
    if (!o) return { own: { tone: "unknown", text: "brak kampanii" }, rule };
    const h = bankId ? history(bankId, accountType) : null;
    const r = commissionEligibility(rule, h, o.ownApplicationsAllowed);
    return { own: { tone: r.status === "yes" ? "ok" : r.status === "no" ? "no" : "unknown", text: r.text, from: r.status === "no" ? r.from : undefined }, rule };
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
  function LinkSuggestions({ items }: { items: Unmatched[] }) {
    const u = items[0]!;
    const matches = suggestPromotions({ bankName: u.bankName, name: u.name, category: u.category }, matchPromos);
    return (
      <details className="mt-1 text-xs">
        <summary className="cursor-pointer text-ink-500">powiąż z promocją{matches[0]?.amountMismatch ? " ⚠ inna kwota" : ""}</summary>
        <div className="mt-1 space-y-1">
          {matches.length === 0 && <p className="text-ink-500">Brak promocji na stronie dla tego banku i rodzaju konta.</p>}
          {matches.slice(0, 3).map((m) => (
            <form
              key={m.promotion.id}
              action={linkCampaignsToPromotion.bind(
                null,
                items.map((x) => ({ kind: x.kind, id: x.id })),
                m.promotion.id
              )}
              className="flex flex-wrap items-center gap-2"
            >
              <span>
                {m.promotion.name} (do {zl(m.promotion.maxBonusCents)}, {m.promotion.status})
                {m.amountMismatch && <span className="ml-1 text-coral-600">⚠ inna kwota w nazwie kampanii</span>}
              </span>
              <button className="rounded border border-ink-100 px-2 py-0.5 hover:bg-ink-100">Powiąż</button>
            </form>
          ))}
          {items
            .filter((x) => x.detailUrl)
            .map((x) => (
              <a key={x.key} href={x.detailUrl!} target="_blank" rel="noreferrer" className="mr-2 text-ink-500 underline">
                panel {NETWORK_LABEL[x.network]}
              </a>
            ))}
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
    bankKey: string;
    title: string;
    category: string;
    p: Promo | null;
    offers: Offer[];
    /** The campaign the commission answers are about: the live link, else the best-paying one. */
    lead: Offer | undefined;
    catalogOnly: (typeof catalog)[number][];
    choice: ReturnType<typeof chooseAffiliateLink> | null;
    /** Best commission of the row's campaigns, contest per client included. */
    bestRate: number;
    contestPerClient: number;
    hasContest: boolean;
    total: number;
    commission: { own: Own; rule: ReturnType<typeof parseNewClientRule> };
    commissionBy: CommissionDeadline | null;
    premium: Own | null;
    premiumBy: ReturnType<typeof premiumDeadlines>;
    restrictions: PromoRestriction[];
    /** Unlinked campaigns of the same account, listed under the promotion row. */
    twins?: Offer[];
    items?: Unmatched[];
  };
  const rate = (o: Offer | undefined) => (o ? (o.cpsCents ?? 0) + (o.cpaCents ?? 0) : 0);
  const contestPer = (o: Offer | undefined) =>
    o ? Math.round(contestsByOffer(o.network, o.externalId).reduce((s, c) => s + contestBonusCents(parseTiers(c.tiers), 10), 0) / 10) : 0;
  const withContest = (o: Offer) => rate(o) + contestPer(o);
  const restrictionsOf = (list: Offer[]) => {
    const seen = new Map<string, PromoRestriction>();
    for (const o of list) for (const r of promoRestrictions(`${o.notes ?? ""} ${o.conditions ?? ""}`)) seen.set(r.key, r);
    return [...seen.values()];
  };

  const siteRows: Row[] = [...groups.values()].map(({ promotion: p, offers: g, sameAccount }) => {
    const current = g.filter((o) => !o.missingSince);
    const best = [...current].sort((a, b) => withContest(b) - withContest(a))[0];
    const lead = current.find((o) => o.network === p.affiliateNetwork) ?? best ?? g[0];
    const contestPerClient = contestPer(lead);
    return {
      key: p.id,
      onSite: true,
      bankName: p.bank.name,
      bankKey: normalizeBank(p.bank.name),
      title: p.name,
      category: p.accountType === "BUSINESS" ? "konto firmowe" : "konto osobiste",
      p,
      offers: [...g, ...sameAccount],
      twins: sameAccount,
      lead,
      catalogOnly: (catalogByPromo.get(p.id) ?? []).filter((c) => !panelIds.has(c.oid)),
      choice: chooseAffiliateLink(p, g, now),
      bestRate: best ? withContest(best) : 0,
      contestPerClient,
      hasContest: g.some((o) => contestsByOffer(o.network, o.externalId).length > 0),
      total: rate(lead) + p.maxBonusCents,
      commission: commissionOwn(lead, p.bankId, p.accountType),
      commissionBy: commissionDeadline(lead?.conditions, today),
      premium: premiumOwn(p),
      premiumBy: premiumDeadlines(p.id),
      restrictions: restrictionsOf(current)
    };
  });

  // The same account from both networks (or a same-named duplicate) is one row.
  const offSiteRows: Row[] = groupOffSiteItems(unmatched).map((items) => {
    const u = items[0]!;
    const rowOffers = items.flatMap((x) => (x.offer ? [x.offer] : []));
    const lead = [...rowOffers].sort((a, b) => withContest(b) - withContest(a))[0];
    const contestPerClient = contestPer(lead);
    const best = lead ? withContest(lead) : 0;
    return {
      key: items.map((x) => x.key).join("+"),
      onSite: false,
      bankName: u.bankName,
      bankKey: normalizeBank(u.bankName),
      title: lead?.name ?? u.name,
      category: u.category,
      p: null,
      offers: rowOffers,
      lead,
      catalogOnly: [],
      choice: null,
      bestRate: best,
      contestPerClient,
      hasContest: contestPerClient > 0 || items.some((x) => x.kind === "catalog" && contestsByOffer("EBROKER", x.id).length > 0),
      total: lead ? rate(lead) : 0,
      commission: commissionOwn(lead, bankIdOf(u.bankName), accountTypeFromCategory(u.category)),
      commissionBy: commissionDeadline(lead?.conditions, today),
      premium: null,
      premiumBy: null,
      restrictions: restrictionsOf(rowOffers),
      items
    };
  });

  const soonLimit = new Date(today.getTime() + 183 * 86_400_000);
  /** The earliest date (within ~6 months) from which a commission or premium you cannot take today becomes yours. */
  const soonDate = (r: Row): Date | null => {
    const dates = [r.commission.own, r.premium]
      .filter((o): o is Own => o?.tone === "no" && o.from != null && o.from > today && o.from <= soonLimit)
      .map((o) => o.from!);
    return dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
  };
  const rank = (t: Tone | undefined) => (t === "ok" ? 0 : t === "unknown" || !t ? 1 : 2);
  const metric = (r: Row): number => {
    if (sort === "prowizja") return r.bestRate * 1e4 + r.total / 1e4;
    if (sort === "premia") return (r.p?.maxBonusCents ?? -1) * 1e4 + r.bestRate / 1e4;
    if (sort === "termin") return -(r.commissionBy?.date.getTime() ?? 9e15);
    return r.total;
  };
  const byRow = (a: Row, b: Row) =>
    only === "wkrotce"
      ? soonDate(a)!.getTime() - soonDate(b)!.getTime()
      : sort === "bank"
        ? a.title.localeCompare(b.title, "pl")
        : metric(b) - metric(a) || rank(a.commission.own.tone) - rank(b.commission.own.tone);
  const shown = [...siteRows, ...offSiteRows]
    .filter((r) => (where === "strona" ? r.onSite : where === "poza" ? !r.onSite : true))
    .filter((r) =>
      only === "prowizja"
        ? r.commission.own.tone === "ok"
        : only === "premia"
          ? r.premium?.tone === "ok"
          : only === "oba"
            ? r.commission.own.tone === "ok" && r.premium?.tone === "ok"
            : only === "wkrotce"
              ? soonDate(r) != null
              : true
    )
    .filter((r) => (onlyContest ? r.hasContest : true))
    .filter((r) => (hideNo ? r.commission.own.tone !== "no" : true))
    .sort(byRow);
  // Bank sections, best account first inside; a bank ranks by its best account.
  const sections = new Map<string, Row[]>();
  for (const r of shown) sections.set(r.bankKey, [...(sections.get(r.bankKey) ?? []), r]);
  const bankSections = !byBank ? (shown.length ? [shown] : []) : [...sections.values()].sort((a, b) => (sort === "bank" ? a[0]!.bankName.localeCompare(b[0]!.bankName, "pl") : byRow(a[0]!, b[0]!)));

  const href = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams();
    const cur: Record<string, string | undefined> = { sort: sp.sort, tylko: sp.tylko, konkurs: sp.konkurs, gdzie: sp.gdzie, moge: sp.moge, widok: sp.widok };
    for (const [k, v] of Object.entries({ ...cur, ...patch })) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/admin/prowizje?${s}` : "/admin/prowizje";
  };
  const chip = (active: boolean) => `rounded border px-2 py-1 ${active ? "border-ink-solid bg-ink-solid text-white" : "border-ink-100 hover:bg-ink-100"}`;

  // ---- contests: the same bank and kind of account in both networks form one group ----
  const KIND = { PERSONAL: "konto osobiste", BUSINESS: "konto firmowe", SAVINGS: "konto oszczędnościowe" } as const;
  const contestGroupMap = new Map<
    string,
    { key: string; bankKey: string; bankName: string; kind: string; own: Own; items: { c: (typeof contests)[number]; tiers: ContestTier[]; rate: number; at5: number | null }[] }
  >();
  for (const c of contests) {
    const camp = offers.filter((o) => o.network === c.network && c.offerExternalIds.includes(o.externalId));
    const first = camp[0];
    if (!first) continue;
    const type = first.promotion?.accountType ?? accountTypeFromCategory(first.category);
    const bankKey = normalizeBank(first.bankName);
    const key = `${bankKey}|${type}`;
    const tiers = parseTiers(c.tiers);
    const rate = Math.max(0, ...camp.map((o) => (o.cpsCents ?? 0) + (o.cpaCents ?? 0)));
    const g = contestGroupMap.get(key) ?? {
      key,
      bankKey,
      bankName: first.promotion?.bank.name ?? bankNameByKey.get(bankKey) ?? first.bankName,
      kind: KIND[type as keyof typeof KIND] ?? first.category,
      own: commissionOwn(first, first.promotion?.bankId ?? bankIdOf(first.bankName), type).own,
      items: []
    };
    g.items.push({ c, tiers, rate, at5: tiers.length ? rate * 5 + contestBonusCents(tiers, 5) : null });
    contestGroupMap.set(key, g);
  }
  const contestGroups = [...contestGroupMap.values()]
    .map((g) => ({ ...g, items: g.items.sort((a, b) => (b.at5 ?? -1) - (a.at5 ?? -1)) }))
    .sort((a, b) => (b.items[0]!.at5 ?? -1) - (a.items[0]!.at5 ?? -1));

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
          Konta i stawki ({siteRows.length} z promocją na stronie, {offSiteRows.length} bez promocji)
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-ink-500">Sortuj:</span>
          {(Object.keys(SORTS) as SortKey[]).map((k) => (
            <Link key={k} href={href({ sort: k === "prowizja" ? null : k })} className={chip(sort === k)}>
              {SORTS[k]}
            </Link>
          ))}
          <Link href={href({ moge: hideNo ? null : "ukryj" })} className={chip(hideNo)}>
            {hideNo ? "✓ " : ""}ukryj, gdzie nie mogę wziąć prowizji
          </Link>
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
          <span className="ml-3 text-ink-500">Pokaż tylko, gdzie mogę:</span>
          {[
            ["", "wszystko"],
            ["prowizja", "wziąć prowizję"],
            ["premia", "wziąć premię"],
            ["oba", "prowizję i premię"],
            ["wkrotce", "mogę wkrótce (do 6 mies.)"]
          ].map(([k, label]) => (
            <Link key={k} href={href({ tylko: k || null })} className={chip(only === k)}>
              {label}
            </Link>
          ))}
          <Link href={href({ konkurs: onlyContest ? null : "1" })} className={chip(onlyContest)}>
            tylko z konkursem
          </Link>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-ink-500">Widok:</span>
          <Link href={href({ widok: "banki" })} className={chip(byBank)}>
            po bankach
          </Link>
          <Link href={href({ widok: "lista" })} className={chip(!byBank)}>
            jedna lista
          </Link>
          <span className="text-ink-500">(domyślnie po bankach; po zmianie sortowania lub filtra jedna lista)</span>
        </div>
        <p className="mt-2 max-w-4xl text-xs text-ink-500">
          Tylko konta osobiste i firmowe (bez lokat i kont oszczędnościowych). Banki są sekcjami ułożonymi według najlepszej kwoty w banku, a w banku najlepsze
          konto jest na górze. „Prowizja” to lepsza stawka z obu sieci razem z konkursem
          (średnio na klienta przy 10 kontach). „Razem” liczy link, który jest teraz na stronie. „Do kiedy” to ostatni dzień na
          spełnienie warunków, gdy wniosek i umowa są dziś. Konta, w których nie weźmiesz ani prowizji, ani premii, są mocno przyszarzone; te bez samej prowizji lekko. Przełącznik je ukrywa. „Razem” = prowizja za jednego klienta + premia (bez konkursu).
        </p>
        <details className="mt-2 max-w-4xl text-xs text-ink-500">
          <summary className="cursor-pointer">Zasady sieci, które dotyczą każdej kampanii (wniosek na siebie, promowanie)</summary>
          {NETWORKS.map((n) => (
            <div key={n} className="mt-2">
              <p className="font-medium text-ink-700">{NETWORK_LABEL[n]}</p>
              <p>Wniosek na siebie: {NETWORK_RULES[n].own}</p>
              <ul className="ml-4 list-disc">
                {NETWORK_RULES[n].promo.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          ))}
        </details>
        <div className="mt-3 overflow-x-auto rounded-xl2 border border-ink-100">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-100/40 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                <th className="w-[26%] p-3">Konto</th>
                <th className="w-[34%] border-l border-ink-100 p-3">Prowizja brokera</th>
                <th className="w-[28%] border-l border-ink-100 p-3">Premia banku</th>
                <th className="border-l border-ink-100 p-3">Razem</th>
              </tr>
            </thead>
            {bankSections.map((rows) => (
              <tbody key={rows[0]!.bankKey}>
                {byBank && (
                <tr className="border-b border-ink-100 bg-ink-100/60">
                  <th colSpan={4} className="p-3 text-left">
                    <span className="inline-flex items-center gap-2 align-middle">
                      {logoByKey.get(rows[0]!.bankKey) && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoByKey.get(rows[0]!.bankKey)} alt="" className="h-7 w-7 rounded-full border border-ink-100 bg-white object-contain p-0.5" />
                      )}
                      <span className="text-base font-semibold text-ink-900">{rows[0]!.bankName}</span>
                    </span>
                    <span className="ml-2 text-xs font-normal text-ink-500">
                      {rows.length} {rows.length === 1 ? "konto" : rows.length < 5 ? "konta" : "kont"} · najlepsza prowizja {zl(Math.max(...rows.map((r) => r.bestRate)))}
                    </span>
                  </th>
                </tr>
                )}
                {rows.map((r) => (
                  <tr
                    key={r.key}
                    className={`border-b border-ink-100 align-top ${r.onSite ? "" : "bg-ink-100/20"} ${r.commission.own.tone === "no" && (!r.p || r.premium?.tone === "no") ? "opacity-35" : r.commission.own.tone === "no" ? "opacity-70" : ""}`}
                  >
                    <td className="p-3">
                      {r.p ? (
                        <Link href={`/admin/promocje/${r.p.id}`} className="font-medium text-ink-900 hover:underline">
                          {r.title}
                        </Link>
                      ) : (
                        <p className="font-medium text-ink-900">{r.title}</p>
                      )}
                      {!byBank && <p className="text-xs font-semibold text-ink-700">{r.bankName}</p>}
                      <p className="text-xs text-ink-500">
                        {r.category}
                        {r.p ? ` · ${r.p.status}${r.p.adminOnly ? " · tylko dla admina" : ""}` : " · brak promocji na stronie"}
                      </p>
                      {r.restrictions.length > 0 && (
                        <details className="mt-1 text-xs">
                          <summary className="cursor-pointer text-coral-600">zakazy w promowaniu ({r.restrictions.length})</summary>
                          <ul className="ml-4 mt-1 list-disc text-ink-500">
                            {r.restrictions.map((x) => (
                              <li key={x.key}>{x.label}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                      {r.lead?.ownApplicationsAllowed === false && <p className="text-xs text-coral-600">zakaz wniosków własnych</p>}
                      {r.twins && r.twins.length > 0 && (
                        <p className="mt-1 text-xs text-ink-500">
                          to samo konto także w kampaniach: {r.twins.map((o) => `${NETWORK_LABEL[o.network as Network]} ${o.externalId}`).join(", ")}
                        </p>
                      )}
                      {r.items && <LinkSuggestions items={r.items} />}
                    </td>

                    <td className="border-l border-ink-100 p-3">
                      {NETWORKS.map((n) => {
                        const list = r.offers.filter((x) => x.network === n && !x.missingSince);
                        if (!list.length) {
                          if (n === "EBROKER" && (r.catalogOnly.length || r.items?.some((x) => x.kind === "catalog")))
                            return (
                              <p key={n} className="text-xs text-ink-500">
                                {NETWORK_LABEL[n]}: tylko link z katalogu, stawki nie odczytano
                              </p>
                            );
                          return r.onSite ? (
                            <p key={n} className="text-xs text-ink-300">
                              {NETWORK_LABEL[n]}: brak
                            </p>
                          ) : null;
                        }
                        const o = [...list].sort((a, b) => withContest(b) - withContest(a))[0]!;
                        const others = r.offers.filter((x) => x.network !== n && !x.missingSince);
                        const isBest = others.length > 0 && withContest(o) > Math.max(...others.map(withContest));
                        const live = r.p?.affiliateNetwork === n;
                        return (
                          <div key={n} className="mb-1">
                            <p className={isBest ? "font-semibold text-ink-900" : "text-ink-700"}>
                              {NETWORK_LABEL[n]}: {o.cpsCents != null && `CPS ${zl(o.cpsCents)}`} {o.cpaCents != null && `CPA ${zl(o.cpaCents)}`}
                              {isBest && <span className="ml-1 text-xs font-normal text-teal-700">płaci więcej</span>}
                              {live && <span className="ml-1 rounded bg-teal-700/10 px-1 text-xs font-normal text-teal-700">● link na stronie</span>}
                            </p>
                            {contestsByOffer(o.network, o.externalId).map((c) => (
                              <p key={c.id} className="flex items-start gap-1 text-xs text-gold-600">
                                <Trophy className="mt-0.5 h-3 w-3 shrink-0" />
                                <span>
                                  {describeTiers(parseTiers(c.tiers), c.title)}
                                  {c.endDate ? `, do ${formatDate(c.endDate)}` : ""}
                                  {contestPer(o) > 0 && ` (≈ ${zl(contestPer(o))} na klienta)`}
                                </span>
                              </p>
                            ))}
                          </div>
                        );
                      })}
                      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
                        <dt className="text-ink-500">Do kiedy:</dt>
                        <dd>
                          {r.commissionBy ? (
                            <>
                              <span className="font-semibold text-ink-900">{formatDate(r.commissionBy.date)}</span>{" "}
                              <span className="text-ink-500">({r.commissionBy.basis})</span>
                            </>
                          ) : r.lead ? (
                            <span className="text-ink-500">bez terminu, za samo otwarcie / umowę</span>
                          ) : (
                            "—"
                          )}
                        </dd>
                        <dt className="text-ink-500">Karencja:</dt>
                        <dd>
                          <span className={TONE[r.commission.own.tone]}>{r.commission.own.text}</span>
                          <span className="text-ink-500"> · {describeNewClientRule(r.commission.rule)}</span>
                          {only === "wkrotce" && soonDate(r) && <span className="block font-semibold text-gold-600">możesz od {formatDate(soonDate(r)!)}</span>}
                        </dd>
                      </dl>
                      {r.lead?.conditions && (
                        <details className="mt-1 text-xs text-ink-500">
                          <summary className="cursor-pointer">warunki prowizji ({NETWORK_LABEL[r.lead.network as Network]})</summary>
                          <p className="mt-1 whitespace-pre-line">{r.lead.conditions}</p>
                          {r.lead.notes && <p className="mt-1 whitespace-pre-line text-ink-300">{r.lead.notes}</p>}
                        </details>
                      )}
                      {r.p && r.choice && (
                        <div className="mt-2 text-xs">
                          {(r.p.affiliateNetworkPinned || r.choice.kind !== "keep") && (
                            <p className="text-ink-500">
                              {r.p.affiliateNetworkPinned && <span className="mr-1 text-gold-600">link przypięty</span>}
                              {r.choice.kind === "switch" ? `jutro przełączy na ${NETWORK_LABEL[r.choice.to.network]}` : r.choice.kind === "decide" ? `❓ ${r.choice.reason}` : ""}
                            </p>
                          )}
                          <div className="mt-1 flex flex-wrap gap-1">
                            {NETWORKS.filter((n) => r.offers.some((x) => x.network === n && x.trackingUrl && !x.missingSince) || (n === "EBROKER" && r.catalogOnly.length > 0)).map((n) => (
                              <form key={n} action={pinAffiliateNetwork.bind(null, r.p!.id, n)}>
                                <button className="flex items-center gap-1 rounded border border-ink-100 px-2 py-0.5 hover:bg-ink-100">
                                  <Pin className="h-3 w-3" /> {NETWORK_LABEL[n]}
                                </button>
                              </form>
                            ))}
                            {r.p.affiliateNetworkPinned && (
                              <form action={pinAffiliateNetwork.bind(null, r.p.id, null)}>
                                <button className="flex items-center gap-1 rounded border border-ink-100 px-2 py-0.5 hover:bg-ink-100">
                                  <PinOff className="h-3 w-3" /> odepnij
                                </button>
                              </form>
                            )}
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="border-l border-ink-100 p-3">
                      {r.p ? (
                        <>
                          <p className="font-semibold text-ink-900">{zl(r.p.maxBonusCents)}</p>
                          <p className="text-xs text-ink-500">konto otwórz do {formatDate(r.p.endDate)}</p>
                          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
                            <dt className="text-ink-500">Do kiedy:</dt>
                            <dd>
                              {r.premiumBy ? (
                                <>
                                  <span className="font-semibold text-ink-900">{formatDate(r.premiumBy.last)}</span>{" "}
                                  <span className="text-ink-500">
                                    ({r.premiumBy.parts > 1 ? `${r.premiumBy.parts} części, pierwsza do ${formatDate(r.premiumBy.first)}` : "jedna nagroda"})
                                  </span>
                                </>
                              ) : (
                                <span className="text-ink-500">brak ściągi z terminami</span>
                              )}
                            </dd>
                            <dt className="text-ink-500">Karencja:</dt>
                            <dd>
                              {r.premium && <span className={TONE[r.premium.tone]}>{r.premium.text}</span>}
                              <span className="text-ink-500">
                                {" · "}
                                {r.p.cooldownMonths != null
                                  ? `${r.p.cooldownMonths} mies. od zamknięcia konta`
                                  : r.p.cooldownCutoffDate
                                    ? `brak konta od ${formatDate(r.p.cooldownCutoffDate)}`
                                    : "regulamin nie podaje karencji"}
                              </span>
                            </dd>
                          </dl>
                        </>
                      ) : (
                        <p className="text-xs text-ink-500">brak premii na stronie</p>
                      )}
                    </td>

                    <td className="border-l border-ink-100 p-3">
                      <p className="font-semibold text-ink-900">{zl(r.total)}</p>
                      <p className="text-xs text-ink-500">
                        {zl(r.total - (r.p?.maxBonusCents ?? 0))}
                        {r.p ? ` + ${zl(r.p.maxBonusCents)}` : ""}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
            {shown.length === 0 && (
              <tbody>
                <tr>
                  <td colSpan={4} className="p-6 text-center text-ink-500">
                    Brak pozycji dla tych filtrów.
                  </td>
                </tr>
              </tbody>
            )}
          </table>
        </div>
      </section>
      <section>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Trophy className="h-5 w-5 text-gold-600" /> Konkursy i bonusy
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-ink-500">
          Premia za liczbę rozliczonych kont, płatna przez brokera ponad zwykłą prowizję. Konkursy obu sieci na ten sam bank i ten sam rodzaj konta są w jednej grupie,
          żeby było widać, który jest lepszy. Kwoty „N kl. razem” = prowizja + konkurs przy N klientach. Ranking wydawców (nagrody za miejsca) nie daje się przeliczyć
          na klienta. Brak okresu oznacza, że panel go nie podaje.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl2 border border-ink-100">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-100/40 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                <th className="w-[34%] p-3">Konkurs</th>
                <th className="p-3">Okres</th>
                <th className="p-3">Prowizja</th>
                {PAYOUT_CLIENT_COUNTS.map((n) => (
                  <th key={n} className="p-3">
                    {n} kl. razem
                  </th>
                ))}
              </tr>
            </thead>
            {contestGroups.map((g) => {
              const best5 = Math.max(...g.items.map((x) => x.at5 ?? -1));
              const compare = g.items.filter((x) => x.at5 != null).length > 1;
              return (
                <tbody key={g.key}>
                  <tr className="border-b border-ink-100 bg-ink-100/60">
                    <th colSpan={3 + PAYOUT_CLIENT_COUNTS.length} className="p-3 text-left">
                      <span className="inline-flex items-center gap-2 align-middle">
                        {logoByKey.get(g.bankKey) && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={logoByKey.get(g.bankKey)} alt="" className="h-7 w-7 rounded-full border border-ink-100 bg-white object-contain p-0.5" />
                        )}
                        <span className="text-base font-semibold text-ink-900">{g.bankName}</span>
                        <span className="text-xs font-normal text-ink-500">· {g.kind}</span>
                      </span>
                      <span className={`ml-3 text-xs font-normal ${TONE[g.own.tone]}`}>prowizja dla Ciebie: {g.own.text}</span>
                    </th>
                  </tr>
                  {g.items.map(({ c, tiers, rate, at5 }) => {
                    const winner = compare && at5 != null && at5 === best5;
                    return (
                      <tr key={c.id} className="border-b border-ink-100 align-top">
                        <td className="p-3">
                          <p className={winner ? "font-semibold text-ink-900" : "text-ink-700"}>
                            <span className="text-ink-500">{NETWORK_LABEL[c.network as Network]}:</span>{" "}
                            {c.sourceUrl ? (
                              <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="hover:underline">
                                {c.title}
                              </a>
                            ) : (
                              c.title
                            )}
                            {winner && <span className="ml-2 rounded bg-teal-700/10 px-1 text-xs font-normal text-teal-700">lepszy przy 5 kontach</span>}
                          </p>
                          <p className="mt-1 text-xs text-ink-500">{tiers.length ? describeTiers(tiers) : "ranking wydawców, nie premia za klienta"}</p>
                          {c.description && (
                            <details className="mt-1 text-xs text-ink-500">
                              <summary className="cursor-pointer">zasady z panelu</summary>
                              <p className="mt-1 whitespace-pre-line">{c.description}</p>
                            </details>
                          )}
                        </td>
                        <td className="p-3 text-xs text-ink-500">
                          {c.startDate || c.endDate ? `${c.startDate ? formatDate(c.startDate) : "?"} – ${c.endDate ? formatDate(c.endDate) : "?"}` : "okres nie podany"}
                        </td>
                        <td className="p-3 text-xs">{rate ? zl(rate) : "—"}</td>
                        {PAYOUT_CLIENT_COUNTS.map((n) => (
                          <td key={n} className="p-3">
                            {tiers.length ? zl(rate * n + contestBonusCents(tiers, n)) : "—"}
                            {tiers.length > 0 && rate > 0 && <span className="block text-xs text-ink-300">w tym konkurs {zl(contestBonusCents(tiers, n))}</span>}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}
            {contestGroups.length === 0 && (
              <tbody>
                <tr>
                  <td colSpan={3 + PAYOUT_CLIENT_COUNTS.length} className="p-6 text-center text-ink-500">
                    Brak konkursów w danych. Agent dopisze je po odczycie paneli.
                  </td>
                </tr>
              </tbody>
            )}
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
