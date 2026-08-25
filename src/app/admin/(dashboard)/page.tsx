import { db } from "@/lib/db";
import Link from "next/link";
import { PromotionStatus } from "@prisma/client";

export default async function AdminDashboardPage() {
  const [activeCount, expiredCount, draftCount, totalClicks, totalImpressions, topByClicks] = await Promise.all([
    db.promotion.count({ where: { status: PromotionStatus.ACTIVE } }),
    db.promotion.count({ where: { status: PromotionStatus.EXPIRED } }),
    db.promotion.count({ where: { status: PromotionStatus.DRAFT } }),
    db.click.count(),
    db.impression.count(),
    db.promotion.findMany({
      take: 5,
      include: { bank: true, _count: { select: { clicks: true, impressions: true } } },
      orderBy: { clicks: { _count: "desc" } }
    })
  ]);

  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : "—";

  return (
    <div>
      <h1 className="text-2xl font-semibold">Pulpit</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Aktywne promocje" value={activeCount} />
        <StatCard label="Wygasłe promocje" value={expiredCount} />
        <StatCard label="Wersje robocze" value={draftCount} />
        <StatCard label="CTR (kliknięcia / wyświetlenia)" value={`${ctr}%`} />
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold">Najczęściej klikane promocje</h2>
        <div className="mt-4 overflow-x-auto rounded-xl2 border border-ink-100 bg-surface">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-ink-500">
                <th className="p-3 font-medium">Promocja</th>
                <th className="p-3 font-medium">Wyświetlenia</th>
                <th className="p-3 font-medium">Kliknięcia</th>
                <th className="p-3 font-medium">CTR</th>
              </tr>
            </thead>
            <tbody>
              {topByClicks.map((p) => {
                const rowCtr = p._count.impressions > 0 ? ((p._count.clicks / p._count.impressions) * 100).toFixed(1) : "—";
                return (
                  <tr key={p.id} className="border-b border-ink-100 last:border-0">
                    <td className="p-3">
                      <Link href={`/admin/promocje/${p.id}`} className="font-medium text-ink-900 hover:underline">
                        {p.bank.name} — {p.name}
                      </Link>
                    </td>
                    <td className="p-3">{p._count.impressions}</td>
                    <td className="p-3">{p._count.clicks}</td>
                    <td className="p-3">{rowCtr}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl2 border border-ink-100 bg-surface p-5">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}
