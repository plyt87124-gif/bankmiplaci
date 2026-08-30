import {
  getPageViewsTrend,
  getClicksTrend,
  getPageBreakdown,
  getTopPromotionsByMetric,
  getTrafficTotals,
  getSourceBreakdown,
  getChecklistStats,
  getEligibilityFunnelStats,
  getBankBreakdown,
  getCampaignBreakdown
} from "@/lib/services/analytics";
import { StatsCharts } from "./StatsCharts";

const VALID_RANGES = [7, 30, 90];

export default async function StatsPage({ searchParams }: { searchParams: { days?: string } }) {
  const days = VALID_RANGES.includes(Number(searchParams.days)) ? Number(searchParams.days) : 30;

  const [
    pageViewsTrend,
    clicksTrend,
    pageBreakdown,
    sourceBreakdown,
    bankBreakdown,
    topByImpressions,
    topByClicks,
    totals,
    checklistStats,
    eligibilityFunnel,
    campaignBreakdown
  ] = await Promise.all([
    getPageViewsTrend(days),
    getClicksTrend(days),
    getPageBreakdown(days),
    getSourceBreakdown(days),
    getBankBreakdown(days),
    getTopPromotionsByMetric("impressions", 10),
    getTopPromotionsByMetric("clicks", 10),
    getTrafficTotals(days),
    getChecklistStats(),
    getEligibilityFunnelStats(),
    getCampaignBreakdown(days)
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Statystyki</h1>
      <p className="mt-1 text-sm text-ink-500">Ruch w serwisie z ostatnich {days} dni — czy rośnie, maleje, i co się klika.</p>

      <StatsCharts
        days={days}
        totals={totals}
        pageViewsTrend={pageViewsTrend}
        clicksTrend={clicksTrend}
        pageBreakdown={pageBreakdown}
        sourceBreakdown={sourceBreakdown}
        bankBreakdown={bankBreakdown}
        topByImpressions={topByImpressions}
        topByClicks={topByClicks}
        checklistStats={checklistStats}
        eligibilityFunnel={eligibilityFunnel}
        campaignBreakdown={campaignBreakdown}
      />
    </div>
  );
}
