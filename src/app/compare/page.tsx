"use client";

import { CompareTable } from "@/components/CompareTable";
import { NoDataState } from "@/components/EmptyState";
import { FilterBar } from "@/components/FilterBar";
import { useScope } from "@/state/useScope";

export default function ComparePage() {
  const scope = useScope();
  if (!scope) return <NoDataState />;
  const { rows, agg } = scope;

  return (
    <div data-testid="compare-page">
      <FilterBar />
      <div className="pt-5">
        <CompareTable rows={rows} agg={agg} />
      </div>
    </div>
  );
}
