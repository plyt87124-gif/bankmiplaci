"use client";

import Link from "next/link";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";
import type { DailyCount, CampaignBreakdownRow } from "@/lib/services/analytics";

const SOURCE_LABEL: Record<string, string> = {
  direct: "Bezpośrednie",
  search: "Wyszukiwarki",
  social: "Social media"
};

function sourceLabel(source: string): string {
  return SOURCE_LABEL[source] ?? source;
}

interface TopPromotion {
  id: string;
  name: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

interface Props {
  days: number;
  totals: { pageViews: number; clicks: number; uniqueLoggedInVisitors: number };
  pageViewsTrend: DailyCount[];
  clicksTrend: DailyCount[];
  pageBreakdown: { path: string; count: number }[];
  sourceBreakdown: { source: string; count: number }[];
  bankBreakdown: { name: string; impressions: number; clicks: number }[];
  topByImpressions: TopPromotion[];
  topByClicks: TopPromotion[];
  checklistStats: { activeCount: number; completedCount: number; avgProgressPercent: number };
  eligibilityFunnel: { emailsSent: number; linksClicked: number; ctaClicked: number };
  campaignBreakdown: CampaignBreakdownRow[];
}

const RANGES = [7, 30, 90];

function shortDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}

export function StatsCharts({
  days,
  totals,
  pageViewsTrend,
  clicksTrend,
  pageBreakdown,
  sourceBreakdown,
  bankBreakdown,
  topByImpressions,
  topByClicks,
  checklistStats,
  eligibilityFunnel,
  campaignBreakdown
}: Props) {
  const trend = pageViewsTrend.map((p, i) => ({
    date: shortDate(p.date),
    "Unikalne wejścia": p.count,
    "Kliknięcia w promocje": clicksTrend[i]?.count ?? 0
  }));

  const sourceData = sourceBreakdown.map((s) => ({ source: sourceLabel(s.source), count: s.count }));

  return (
    <div className="mt-6 space-y-8">
      <div className="flex gap-2">
        {RANGES.map((r) => (
          <Link
            key={r}
            href={`/admin/statystyki?days=${r}`}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${r === days ? "bg-ink-solid text-white" : "bg-ink-100 text-ink-700"}`}
          >
            {r} dni
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={`Unikalne wejścia (${days} dni)`} value={totals.pageViews} />
        <StatCard label={`Kliknięcia w linki partnerskie (${days} dni)`} value={totals.clicks} />
        <StatCard label={`Unikalni zalogowani użytkownicy (${days} dni)`} value={totals.uniqueLoggedInVisitors} />
      </div>

      <ChartCard title="Ruch w serwisie">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-ink-100" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="currentColor" className="text-ink-500" />
            <YAxis tick={{ fontSize: 12 }} stroke="currentColor" className="text-ink-500" allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="Unikalne wejścia" stroke="#0F7B6C" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Kliknięcia w promocje" stroke="#A9822A" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Najpopularniejsze strony">
        <p className="mb-2 text-xs text-ink-500">
          Odwiedzający danej strony — ta sama osoba odwiedzająca kilka podstron liczy się osobno na każdej z nich,
          więc suma słupków poniżej jest wyższa niż „Unikalne wejścia” z karty powyżej (tam liczymy unikalne IP raz
          dla całego serwisu, niezależnie od liczby odwiedzonych podstron).
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={pageBreakdown} layout="vertical" margin={{ left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-ink-100" />
            <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} stroke="currentColor" className="text-ink-500" />
            <YAxis type="category" dataKey="path" tick={{ fontSize: 12 }} width={140} stroke="currentColor" className="text-ink-500" />
            <Tooltip />
            <Bar dataKey="count" name="Odwiedzający stronę" fill="#0F7B6C" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Źródła ruchu">
          <p className="mb-2 text-xs text-ink-500">Skąd przyszli odwiedzający — klasyfikowane z document.referrer przy pierwszym wejściu na stronę.</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={sourceData} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-ink-100" />
              <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} stroke="currentColor" className="text-ink-500" />
              <YAxis type="category" dataKey="source" tick={{ fontSize: 12 }} width={110} stroke="currentColor" className="text-ink-500" />
              <Tooltip />
              <Bar dataKey="count" name="Odwiedzający" fill="#A9822A" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Ruch według banku">
          <p className="mb-2 text-xs text-ink-500">Wyświetlenia i kliknięcia zsumowane po wszystkich promocjach danego banku.</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={bankBreakdown} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-ink-100" />
              <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} stroke="currentColor" className="text-ink-500" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={110} stroke="currentColor" className="text-ink-500" />
              <Tooltip />
              <Bar dataKey="impressions" name="Wyświetlenia" fill="#0F7B6C" radius={[0, 4, 4, 0]} />
              <Bar dataKey="clicks" name="Kliknięcia" fill="#A9822A" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <CampaignTable rows={campaignBreakdown} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Zaangażowanie w ściągi">
          <div className="grid grid-cols-3 gap-3">
            <MiniStat label="Aktywnie śledzone" value={checklistStats.activeCount} />
            <MiniStat label="Ukończone" value={checklistStats.completedCount} />
            <MiniStat label="Śr. postęp" value={`${checklistStats.avgProgressPercent}%`} />
          </div>
        </ChartCard>

        <ChartCard title="Lejek maili o karencji">
          <div className="grid grid-cols-3 gap-3">
            <MiniStat label="Maile wysłane" value={eligibilityFunnel.emailsSent} />
            <MiniStat label="Link kliknięty" value={eligibilityFunnel.linksClicked} />
            <MiniStat label="„Przejdź do promocji”" value={eligibilityFunnel.ctaClicked} />
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TopPromotionsTable title="Najczęściej wyświetlane promocje" rows={topByImpressions} primaryMetric="impressions" />
        <TopPromotionsTable title="Najczęściej klikane promocje" rows={topByClicks} primaryMetric="clicks" />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl2 border border-ink-100 bg-surface p-5">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value.toLocaleString("pl-PL")}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl2 border border-ink-100 bg-paper p-3 text-center">
      <p className="font-display text-xl font-semibold">{value}</p>
      <p className="mt-1 text-[11px] text-ink-500">{label}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl2 border border-ink-100 bg-surface p-5">
      <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function TopPromotionsTable({
  title,
  rows,
  primaryMetric
}: {
  title: string;
  rows: TopPromotion[];
  primaryMetric: "impressions" | "clicks";
}) {
  return (
    <div className="rounded-xl2 border border-ink-100 bg-surface p-5">
      <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-ink-500">
              <th className="p-2 font-medium">Promocja</th>
              <th className="p-2 font-medium">Wyświetlenia</th>
              <th className="p-2 font-medium">Kliknięcia</th>
              <th className="p-2 font-medium">CTR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${primaryMetric}-${r.id}`} className="border-b border-ink-100 last:border-0">
                <td className="p-2">{r.name}</td>
                <td className="p-2">{r.impressions}</td>
                <td className="p-2">{r.clicks}</td>
                <td className="p-2">{r.ctr}%</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="p-2 text-ink-500" colSpan={4}>
                  Brak danych.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CampaignTable({ rows }: { rows: CampaignBreakdownRow[] }) {
  return (
    <div className="rounded-xl2 border border-ink-100 bg-surface p-5">
      <h2 className="text-sm font-semibold text-ink-900">Kampanie (UTM)</h2>
      <p className="mt-1 text-xs text-ink-500">
        Wyświetlenia promocji i kliknięcia w link afiliacyjny pogrupowane wg{" "}
        <code className="font-mono">utm_source</code>/<code className="font-mono">utm_medium</code>/
        <code className="font-mono">utm_campaign</code>/<code className="font-mono">utm_content</code> — zob.{" "}
        <code className="font-mono">docs/marketing/utm-standard.md</code>.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-ink-500">
              <th className="p-2 font-medium">Źródło</th>
              <th className="p-2 font-medium">Medium</th>
              <th className="p-2 font-medium">Kampania</th>
              <th className="p-2 font-medium">Content</th>
              <th className="p-2 font-medium">Wyświetlenia</th>
              <th className="p-2 font-medium">Kliknięcia</th>
              <th className="p-2 font-medium">CTR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={`${r.utmSource}-${r.utmMedium}-${r.utmCampaign}-${r.utmContent}-${i}`}
                className="border-b border-ink-100 last:border-0"
              >
                <td className="p-2 font-mono text-xs">{r.utmSource}</td>
                <td className="p-2 font-mono text-xs text-ink-500">{r.utmMedium ?? "—"}</td>
                <td className="p-2 font-mono text-xs text-ink-500">{r.utmCampaign ?? "—"}</td>
                <td className="p-2 font-mono text-xs text-ink-500">{r.utmContent ?? "—"}</td>
                <td className="p-2">{r.impressions}</td>
                <td className="p-2">{r.clicks}</td>
                <td className="p-2">{r.ctr}%</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="p-2 text-ink-500" colSpan={7}>
                  Brak danych — jeszcze żaden link z UTM nie wygenerował wejścia ani kliknięcia w wybranym okresie.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
