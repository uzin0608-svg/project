import type {
  AiRecord,
  AiRequest,
  AiSiteMetrics,
  AiTrendPoint,
} from "./ai-types";
import { aggregate, siteMetrics, trend, type Aggregate, type SiteMetrics } from "./calc";
import { recordKey, type Dataset } from "./dataset";
import { milliToNumber, milliToTenths, tenthsToPlain } from "./decimal";
import { scopeSiteIds } from "./filter";
import { STATUS_LABEL, type Filters, type SiteRecord } from "./types";

function tenthsNumber(t: bigint): number {
  return Number(tenthsToPlain(t));
}

function nullableTenths(t: bigint | null): number | null {
  return t === null ? null : tenthsNumber(t);
}

function toAiRecord(r: SiteRecord): AiRecord {
  return {
    month: r.month,
    siteId: r.siteId,
    siteName: r.siteName,
    region: r.region,
    projectType: r.projectType,
    startDate: r.startDate,
    contractEndDate: r.contractEndDate,
    currentWork: r.currentWork,
    issueCategory: r.issueCategory,
    issueSummary: r.issueSummary,
    actionPlan: r.actionPlan,
  };
}

function toAiMetrics(m: SiteMetrics): AiSiteMetrics {
  const r = m.record;
  return {
    month: r.month,
    siteId: r.siteId,
    contractAmount: milliToNumber(r.contractAmount),
    plannedProgress: milliToNumber(r.plannedProgress),
    actualProgress: milliToNumber(r.actualProgress),
    progressGap: tenthsNumber(m.gapTenths),
    cumulativeEarned: milliToNumber(r.cumulativeEarned),
    earnedRate: tenthsNumber(m.earnedRateTenths),
    monthlyEarned: m.monthlyEarnedMilli === null ? null : tenthsNumber(milliToTenths(m.monthlyEarnedMilli)),
    status: STATUS_LABEL[m.status] as AiSiteMetrics["status"],
  };
}

function toTrendPoint(a: Aggregate): AiTrendPoint {
  return {
    month: a.month,
    siteCount: a.siteCount,
    earnedRate: nullableTenths(a.earnedRateTenths),
    plannedProgress: nullableTenths(a.plannedTenths),
    actualProgress: nullableTenths(a.actualTenths),
    progressGap: nullableTenths(a.gapTenths),
    monthlyEarned: a.monthlyEarnedMilli === null ? null : tenthsNumber(milliToTenths(a.monthlyEarnedMilli)),
    normal: a.counts.normal,
    caution: a.counts.caution,
    inspect: a.counts.inspect,
  };
}

/**
 * 같은 필터 범위로 AI에 보낼 자료를 만듭니다.
 * 원문 기록(records, siteHistory.record)과 프로그램이 계산한 값(siteMetrics, overall, trend)을 따로 담습니다.
 */
export function buildAiRequest(dataset: Dataset, filters: Filters, question: string): AiRequest {
  const siteIds = scopeSiteIds(dataset, filters);
  const rows: SiteRecord[] = [];
  for (const id of siteIds) {
    const rec = dataset.byKey.get(recordKey(filters.month, id));
    if (rec) rows.push(rec);
  }
  const metrics = rows.map((r) => siteMetrics(dataset, r));
  const points = trend(dataset, siteIds, filters.month);

  let siteHistory: AiRequest["siteHistory"] = null;
  if (filters.siteId !== "ALL" && siteIds.length === 1) {
    siteHistory = [];
    for (const m of dataset.months.filter((mm) => mm <= filters.month)) {
      const rec = dataset.byKey.get(recordKey(m, siteIds[0]));
      if (rec) siteHistory.push({ record: toAiRecord(rec), metrics: toAiMetrics(siteMetrics(dataset, rec)) });
    }
  }

  return {
    question,
    scope: {
      month: filters.month,
      region: filters.region,
      projectType: filters.projectType,
      siteId: filters.siteId,
      siteIds,
      monthRange: [dataset.months[0] ?? filters.month, filters.month],
      moneyUnit: "백만원",
      progressUnit: "%",
    },
    records: rows.map(toAiRecord),
    siteMetrics: metrics.map(toAiMetrics),
    overall: toTrendPoint(aggregate(dataset, siteIds, filters.month)),
    trend: points.map(toTrendPoint),
    siteHistory,
  };
}
