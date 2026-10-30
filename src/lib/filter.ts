import type { Dataset } from "./dataset";
import { ALL, DEFAULT_MONTH, type Filters } from "./types";

/** 처음 열었을 때의 필터: 2026-09(자료에 없으면 마지막 월), 나머지는 전체 */
export function defaultFilters(dataset: Dataset): Filters {
  const month = dataset.months.includes(DEFAULT_MONTH)
    ? DEFAULT_MONTH
    : (dataset.months[dataset.months.length - 1] ?? DEFAULT_MONTH);
  return { month, region: ALL, projectType: ALL, siteId: ALL };
}

/** 지역·공사 유형에 맞는 현장 ID(현장 ID 순). 현장 선택은 반영하지 않습니다. */
export function sitesMatchingRegionType(dataset: Dataset, filters: Filters): string[] {
  return dataset.sites
    .filter((s) => filters.region === ALL || s.region === filters.region)
    .filter((s) => filters.projectType === ALL || s.projectType === filters.projectType)
    .map((s) => s.siteId);
}

/** 모든 숫자·차트·표·CSV·AI가 따르는 현장 범위 */
export function scopeSiteIds(dataset: Dataset, filters: Filters): string[] {
  const candidates = sitesMatchingRegionType(dataset, filters);
  return filters.siteId === ALL ? candidates : candidates.filter((id) => id === filters.siteId);
}

/** 지역·유형을 바꿔 고른 현장이 범위에서 빠지면 현장을 전체로 되돌립니다. */
export function normalizeFilters(
  dataset: Dataset,
  filters: Filters,
): { filters: Filters; siteReset: boolean } {
  if (filters.siteId === ALL) return { filters, siteReset: false };
  if (sitesMatchingRegionType(dataset, filters).includes(filters.siteId)) {
    return { filters, siteReset: false };
  }
  return { filters: { ...filters, siteId: ALL }, siteReset: true };
}

/** 같은 범위인지 비교하는 표식(AI 요청의 늦은 응답 구별에 씁니다) */
export function scopeKey(filters: Filters, dataVersion: number): string {
  return [dataVersion, filters.month, filters.region, filters.projectType, filters.siteId].join("|");
}

export function scopeLabel(dataset: Dataset, filters: Filters): string {
  const [y, m] = filters.month.split("-");
  const siteCount = scopeSiteIds(dataset, filters).length;
  const region = filters.region === ALL ? "전체 지역" : filters.region;
  const type = filters.projectType === ALL ? "전체 공사유형" : filters.projectType;
  const site = filters.siteId === ALL ? "" : ` · 현장 ${filters.siteId}`;
  return `${y}년 ${Number(m)}월 · ${region} · ${type}${site} (${siteCount}개 현장)`;
}
