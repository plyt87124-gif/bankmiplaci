"use client";

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
import type { DailyCount } from "@/lib/services/analytics";

interface TopPromotion {
  id: string;
  name: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

interface Props {
  totals: { pageViews: number; clicks: number; uniqueLoggedInVisitors: number };
  pageViewsTrend: DailyCount[];
  clicksTrend: DailyCount[];
  pageBreakdown: { path: string; count: number }[];
  topByImpressions: TopPromotion[];
  topByClicks: TopPromotion[];
}

function shortDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}

export function StatsCharts({ totals, pageViewsTrend, clicksTrend, pageBreakdown, topByImpressions, topByClicks }: Props) {
  const trend = pageViewsTrend.map((p, i) => ({
    date: shortDate(p.date),
    "Unikalne wejścia": p.count,
    "Kliknięcia w promocje": clicksTrend[i]?.count ?? 0
  }));

  return (
    <div className="mt-6 space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Unikalne wejścia (30 dni)" value={totals.pageViews} />
        <StatCard label="Kliknięcia w linki partnerskie (30 dni)" value={totals.clicks} />
        <StatCard label="Unikalni zalogowani użytkownicy (30 dni)" value={totals.uniqueLoggedInVisitors} />
      </div>

      <ChartCard title="Ruch w serwisie — ostatnie 30 dni">
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

      <ChartCard title="Najpopularniejsze strony — ostatnie 30 dni">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={pageBreakdown} layout="vertical" margin={{ left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-ink-100" />
            <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} stroke="currentColor" className="text-ink-500" />
            <YAxis type="category" dataKey="path" tick={{ fontSize: 12 }} width={140} stroke="currentColor" className="text-ink-500" />
            <Tooltip />
            <Bar dataKey="count" name="Unikalne wejścia" fill="#0F7B6C" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

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
