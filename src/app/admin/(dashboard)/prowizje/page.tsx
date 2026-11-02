import Link from "next/link";
import { BadgePercent, Pin, PinOff, Undo2 } from "lucide-react";
import { db } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";
import { getSwitchAccounts } from "@/lib/adminAccounts";
import { computeEligibility, isCurrentClient } from "@/lib/services/eligibility";
import {
  chooseAffiliateLink,
  contestBonusCents,
  NETWORK_LABEL,
  parseTiers,
  PAYOUT_CLIENT_COUNTS,
  STAGE_LABEL,
  type ApplicationStage,
  type Network
} from "@/lib/affiliateNetworks";
import { pinAffiliateNetwork, revertAffiliateLinkSwitch } from "./actions";

export const dynamic = "force-dynamic";

const NETWORKS: Network[] = ["EBROKER", "COMPERIA"];
const zl = (c: number | null | undefined) => (c == null ? "—" : `${(c / 100).toLocaleString("pl-PL", { maximumFractionDigits: 2 })} zł`);

type OwnStatus = { tone: "ok" | "no" | "unknown"; text: string };

/**
 * Admin-only overview of what the two affiliate networks pay: per promotion
 * the rates side by side, whose link is live (and whether it is pinned), the
 * commission terms, and whether the owner ("Moje konto") can open the account
 * for a commission. Below: contests as payout for N clients, applications,
 * per-network clicks and the change log (with undo of link switches).
 * Filled by the daily agent (scripts/affiliate-sync.ts).
 */
export default async function AffiliateCommissionsPage() {
  const now = new Date();
  const ownEmail = getSwitchAccounts().find((a) => a.key === "own")?.email;
  const since30 = new Date(now.getTime() - 30 * 86_400_000);

  const [offers, contests, applications, stageCounts, changes, clicks, owner] = await Promise.all([
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
      : null
  ]);

  // Group campaigns by the promotion they belong to.
  type Promo = NonNullable<(typeof offers)[number]["promotion"]>;
  const groups = new Map<string, { promotion: Promo; offers: typeof offers }>();
  const unmatched: typeof offers = [];
  for (const o of offers) {
    if (!o.promotion) {
      if (!o.missingSince) unmatched.push(o);
      continue;
    }
    const g = groups.get(o.promotion.id) ?? { promotion: o.promotion, offers: [] };
    g.offers.push(o);
    groups.set(o.promotion.id, g);
  }

  function ownStatus(p: Promo, groupOffers: typeof offers): OwnStatus {
    const banned = groupOffers.find((o) => o.network === p.affiliateNetwork && o.ownApplicationsAllowed === false);
    if (banned) return { tone: "no", text: `broker zakazuje wniosków własnych${banned.ownApplicationsNote ? `: ${banned.ownApplicationsNote}` : ""}` };
    if (!owner) return { tone: "unknown", text: ownEmail ? "brak konta „Moje konto”" : "ustaw ADMIN_OWN_USER_EMAIL" };
    const row = owner.bankHistory.find((h) => h.bankId === p.bankId && h.accountType === p.accountType);
    if (!row || (!row.wasClientFrom && !row.wasClientUntil)) return { tone: "unknown", text: "brak historii w tym banku w Moim koncie (jeśli nigdy nie byłeś klientem: raczej tak)" };
    const r = computeEligibility(p.cooldownMonths, p.cooldownCutoffDate, row.wasClientUntil, now, isCurrentClient(row));
    if (r.status === "eligible") return { tone: "ok", text: "tak, karencja minęła" };
    if (r.currentClient) return { tone: "no", text: "nie: jesteś obecnie klientem" };
    if (r.status === "not-eligible")
      return { tone: "no", text: r.cutoffFailed || !r.eligibleFromDate ? "nie: konto zamknięte po dacie granicznej" : `nie, od ${formatDate(r.eligibleFromDate)}` };
    return { tone: "unknown", text: "niepewne: promocja nie podaje karencji" };
  }

  const clickCount = (n: Network | null) => clicks.find((c) => c.affiliateNetwork === n)?._count ?? 0;

  return (
    <div className="space-y-10">
      <div className="flex items-start gap-3">
        <BadgePercent className="mt-1 h-6 w-6 text-gold-600" />
        <div>
          <h1 className="text-2xl font-semibold">Prowizje brokerów</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">
            Stawki eBroker i Comperia dla promocji na stronie, czyj link jest teraz pod „Przejdź do promocji” i czy
            Ty możesz założyć to konto dla prowizji. Dane codziennie odczytuje agent z paneli partnerskich; link
            przełącza się sam na brokera, który płaci więcej za nowego klienta, chyba że go przypniesz.
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
        <div className="rounded-xl2 border border-ink-100 p-4 text-sm text-ink-500">
          Kliknięcia bez przypisanego brokera (sprzed zmiany): {clickCount(null)}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Promocje na stronie</h2>
        <div className="mt-3 overflow-x-auto rounded-xl2 border border-ink-100">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-100/40 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                <th className="p-3">Promocja</th>
                {NETWORKS.map((n) => (
                  <th key={n} className="p-3">
                    {NETWORK_LABEL[n]}
                  </th>
                ))}
                <th className="p-3">Link teraz</th>
                <th className="p-3">Czy Ty możesz</th>
              </tr>
            </thead>
            <tbody>
              {[...groups.values()].map(({ promotion: p, offers: g }) => {
                const choice = chooseAffiliateLink(p, g, now);
                const own = ownStatus(p, g);
                return (
                  <tr key={p.id} className="border-b border-ink-100 align-top last:border-0">
                    <td className="p-3">
                      <Link href={`/admin/promocje/${p.id}`} className="font-medium text-ink-900 hover:underline">
                        {p.bank.name}: {p.name}
                      </Link>
                      <p className="text-xs text-ink-500">{p.status}</p>
                    </td>
                    {NETWORKS.map((n) => {
                      const o = g.find((x) => x.network === n && !x.missingSince);
                      if (!o) return <td key={n} className="p-3 text-ink-300">brak</td>;
                      return (
                        <td key={n} className="max-w-[320px] p-3">
                          <p className="font-medium text-ink-900">
                            {o.cpsCents != null && `CPS ${zl(o.cpsCents)}`} {o.cpaCents != null && `CPA ${zl(o.cpaCents)}`}
                          </p>
                          {o.conditions && (
                            <details className="mt-1 text-xs text-ink-500">
                              <summary className="cursor-pointer">kiedy należy się prowizja</summary>
                              <p className="mt-1 whitespace-pre-line">{o.conditions}</p>
                              {o.notes && <p className="mt-1 whitespace-pre-line">{o.notes}</p>}
                            </details>
                          )}
                          {o.newClientOnly && <p className="text-xs text-ink-500">tylko nowy klient</p>}
                          {o.ownApplicationsAllowed === false && <p className="text-xs text-coral-600">zakaz wniosków własnych</p>}
                          <p className="text-xs text-ink-300">widziane {formatDate(o.lastSeenAt)}</p>
                        </td>
                      );
                    })}
                    <td className="p-3">
                      <p className="font-medium text-ink-900">
                        {p.affiliateNetwork ? NETWORK_LABEL[p.affiliateNetwork as Network] : "?"}
                        {p.affiliateNetworkPinned && <span className="ml-1 text-xs text-gold-600">(przypięty)</span>}
                      </p>
                      <p className="text-xs text-ink-500">
                        {choice.kind === "switch"
                          ? `jutro przełączy na ${NETWORK_LABEL[choice.to.network]}`
                          : choice.kind === "decide"
                            ? `❓ ${choice.reason}`
                            : choice.reason}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {NETWORKS.filter((n) => g.some((x) => x.network === n && x.trackingUrl && !x.missingSince)).map((n) => (
                          <form key={n} action={pinAffiliateNetwork.bind(null, p.id, n)}>
                            <button className="flex items-center gap-1 rounded border border-ink-100 px-2 py-0.5 text-xs hover:bg-ink-100">
                              <Pin className="h-3 w-3" /> {NETWORK_LABEL[n]}
                            </button>
                          </form>
                        ))}
                        {p.affiliateNetworkPinned && (
                          <form action={pinAffiliateNetwork.bind(null, p.id, null)}>
                            <button className="flex items-center gap-1 rounded border border-ink-100 px-2 py-0.5 text-xs hover:bg-ink-100">
                              <PinOff className="h-3 w-3" /> odepnij
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                    <td className={`p-3 text-xs ${own.tone === "ok" ? "text-teal-700" : own.tone === "no" ? "text-coral-600" : "text-ink-500"}`}>
                      {own.text}
                    </td>
                  </tr>
                );
              })}
              {groups.size === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-ink-500">
                    Brak danych. Pojawią się po pierwszym odczycie paneli przez dziennego agenta.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {unmatched.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Kampanie bez promocji na stronie</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {unmatched.map((o) => (
              <li key={o.id}>
                <span className="text-ink-500">{NETWORK_LABEL[o.network as Network]}:</span> {o.bankName}: {o.name} ({o.category}),{" "}
                {o.cpsCents != null && `CPS ${zl(o.cpsCents)} `}
                {o.cpaCents != null && `CPA ${zl(o.cpaCents)}`}
                {o.detailUrl && (
                  <a href={o.detailUrl} target="_blank" rel="noreferrer" className="ml-2 text-xs text-ink-500 underline">
                    panel
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold">Konkursy i bonusy</h2>
        <p className="mt-1 text-sm text-ink-500">Sama premia konkursowa za podaną liczbę rozliczonych klientów, bez zwykłej prowizji.</p>
        <div className="mt-3 overflow-x-auto rounded-xl2 border border-ink-100">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-100/40 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                <th className="p-3">Konkurs</th>
                <th className="p-3">Okres</th>
                {PAYOUT_CLIENT_COUNTS.map((n) => (
                  <th key={n} className="p-3">
                    {n} kl.
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contests.map((c) => {
                const tiers = parseTiers(c.tiers);
                return (
                  <tr key={c.id} className="border-b border-ink-100 last:border-0">
                    <td className="p-3">
                      <span className="text-ink-500">{NETWORK_LABEL[c.network as Network]}:</span>{" "}
                      {c.sourceUrl ? (
                        <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="hover:underline">
                          {c.title}
                        </a>
                      ) : (
                        c.title
                      )}
                    </td>
                    <td className="p-3 text-ink-500">
                      {c.startDate ? formatDate(c.startDate) : "?"} – {c.endDate ? formatDate(c.endDate) : "?"}
                    </td>
                    {PAYOUT_CLIENT_COUNTS.map((n) => (
                      <td key={n} className="p-3">
                        {tiers.length ? zl(contestBonusCents(tiers, n)) : "?"}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {contests.length === 0 && (
                <tr>
                  <td colSpan={2 + PAYOUT_CLIENT_COUNTS.length} className="p-6 text-center text-ink-500">
                    Brak aktywnych konkursów w danych.
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
