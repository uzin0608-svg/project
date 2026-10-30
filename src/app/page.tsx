"use client";

import { FilterBar } from "@/components/FilterBar";
import { InspectionRanking } from "@/components/InspectionRanking";
import { KpiCards } from "@/components/KpiCards";
import { MonthlyBars } from "@/components/MonthlyBars";
import { NoDataState } from "@/components/EmptyState";
import { TrendChart } from "@/components/TrendChart";
import { useScope } from "@/state/useScope";

export default function SummaryPage() {
  const scope = useScope();
  if (!scope) return <NoDataState />;
  const { agg, ranking, points, siteIds } = scope;

  return (
    <div data-testid="summary-page">
      <FilterBar />
      <div className="space-y-5 pt-5">
        <KpiCards agg={agg} expectedSiteCount={siteIds.length} />
        <InspectionRanking ranking={ranking} agg={agg} />
        <div className="grid gap-5 xl:grid-cols-2">
          <TrendChart points={points} />
          <MonthlyBars points={points} />
        </div>
      </div>
    </div>
  );
}
