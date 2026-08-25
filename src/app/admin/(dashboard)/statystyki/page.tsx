import {
  getPageViewsTrend,
  getClicksTrend,
  getPageBreakdown,
  getTopPromotionsByMetric,
  getTrafficTotals
} from "@/lib/services/analytics";
import { StatsCharts } from "./StatsCharts";

export default async function StatsPage() {
  const [pageViewsTrend, clicksTrend, pageBreakdown, topByImpressions, topByClicks, totals] = await Promise.all([
    getPageViewsTrend(30),
    getClicksTrend(30),
    getPageBreakdown(30),
    getTopPromotionsByMetric("impressions", 10),
    getTopPromotionsByMetric("clicks", 10),
    getTrafficTotals(30)
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Statystyki</h1>
      <p className="mt-1 text-sm text-ink-500">Ruch w serwisie z ostatnich 30 dni — czy rośnie, maleje, i co się klika.</p>

      <StatsCharts
        totals={totals}
        pageViewsTrend={pageViewsTrend}
        clicksTrend={clicksTrend}
        pageBreakdown={pageBreakdown}
        topByImpressions={topByImpressions}
        topByClicks={topByClicks}
      />
    </div>
  );
}
