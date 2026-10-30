"use client";

import { useMemo } from "react";
import { aggregate, inspectionRanking, siteRows, trend } from "@/lib/calc";
import { scopeSiteIds } from "@/lib/filter";
import { useDashboard } from "./DashboardProvider";

/** 현재 필터 범위의 계산 결과. 모든 화면이 같은 값을 쓰도록 한 곳에서 계산합니다. */
export function useScope() {
  const { state } = useDashboard();
  const { dataset, filters } = state;

  return useMemo(() => {
    if (!dataset) return null;
    const siteIds = scopeSiteIds(dataset, filters);
    return {
      dataset,
      filters,
      siteIds,
      agg: aggregate(dataset, siteIds, filters.month),
      points: trend(dataset, siteIds, filters.month),
      ranking: inspectionRanking(dataset, siteIds, filters.month),
      rows: siteRows(dataset, siteIds, filters.month),
    };
  }, [dataset, filters]);
}
