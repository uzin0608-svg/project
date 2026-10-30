import { prevMonth, recordKey, type Dataset } from "./dataset";
import { milliToTenths, roundDiv } from "./decimal";
import type { SiteRecord, Status } from "./types";

const MINUS_FIVE_PP = -5000n; // 1000배 정수 기준 -5.0pp

/** 공정차이(실제 − 계획, 1000배 정수)로 상태를 판정합니다. issueCategory는 쓰지 않습니다. */
export function statusOf(gapMilli: bigint): Status {
  if (gapMilli >= 0n) return "normal";
  if (gapMilli > MINUS_FIVE_PP) return "caution";
  return "inspect";
}

export interface SiteMetrics {
  record: SiteRecord;
  /** 기성률(%), 소수 첫째 자리(10배 정수) */
  earnedRateTenths: bigint;
  /** 공정차이 반올림 전(1000배 정수) */
  gapMilli: bigint;
  gapTenths: bigint;
  status: Status;
  /** 당월기성액(1000배 정수). 바로 전월 행이 없으면 null(계산 불가) */
  monthlyEarnedMilli: bigint | null;
}

export function siteMetrics(dataset: Dataset, record: SiteRecord): SiteMetrics {
  const gapMilli = record.actualProgress - record.plannedProgress;
  const prev = dataset.byKey.get(recordKey(prevMonth(record.month), record.siteId));
  return {
    record,
    earnedRateTenths: roundDiv(record.cumulativeEarned * 1000n, record.contractAmount),
    gapMilli,
    gapTenths: milliToTenths(gapMilli),
    status: statusOf(gapMilli),
    monthlyEarnedMilli: prev ? record.cumulativeEarned - prev.cumulativeEarned : null,
  };
}

export interface Aggregate {
  month: string;
  /** 집계에 쓴 현장 수 */
  siteCount: number;
  contractMilli: bigint;
  earnedMilli: bigint;
  /** 아래 비율은 대상이 없으면 null(계산 불가) */
  earnedRateTenths: bigint | null;
  plannedTenths: bigint | null;
  actualTenths: bigint | null;
  gapTenths: bigint | null;
  monthlyEarnedMilli: bigint | null;
  counts: Record<Status, number>;
}

/** 한 달·현장 목록의 전체 집계. 중간 반올림 없이 계산하고 마지막에 한 번만 반올림합니다. */
export function aggregate(dataset: Dataset, siteIds: string[], month: string): Aggregate {
  const metrics: SiteMetrics[] = [];
  for (const id of siteIds) {
    const rec = dataset.byKey.get(recordKey(month, id));
    if (rec) metrics.push(siteMetrics(dataset, rec));
  }
  const counts: Record<Status, number> = { normal: 0, caution: 0, inspect: 0 };
  if (metrics.length === 0) {
    return {
      month,
      siteCount: 0,
      contractMilli: 0n,
      earnedMilli: 0n,
      earnedRateTenths: null,
      plannedTenths: null,
      actualTenths: null,
      gapTenths: null,
      monthlyEarnedMilli: null,
      counts,
    };
  }
  let contract = 0n;
  let earned = 0n;
  let weightedPlanned = 0n; // Σ 계약금액 × 계획 공정률
  let weightedActual = 0n;
  let monthly: bigint | null = 0n;
  for (const m of metrics) {
    const r = m.record;
    contract += r.contractAmount;
    earned += r.cumulativeEarned;
    weightedPlanned += r.contractAmount * r.plannedProgress;
    weightedActual += r.contractAmount * r.actualProgress;
    counts[m.status] += 1;
    if (m.monthlyEarnedMilli === null || monthly === null) monthly = null;
    else monthly += m.monthlyEarnedMilli;
  }
  // 공정률(1000배) → 소수 첫째 자리(10배): 가중 분자 ÷ (계약금액 합계 × 100)
  const denominator = contract * 100n;
  return {
    month,
    siteCount: metrics.length,
    contractMilli: contract,
    earnedMilli: earned,
    earnedRateTenths: roundDiv(earned * 1000n, contract),
    plannedTenths: roundDiv(weightedPlanned, denominator),
    actualTenths: roundDiv(weightedActual, denominator),
    gapTenths: roundDiv(weightedActual - weightedPlanned, denominator),
    monthlyEarnedMilli: monthly,
    counts,
  };
}

/** 시작 월(자료의 첫 달)부터 선택 월까지 매월 별도로 집계합니다. */
export function trend(dataset: Dataset, siteIds: string[], selectedMonth: string): Aggregate[] {
  return dataset.months
    .filter((m) => m <= selectedMonth)
    .map((m) => aggregate(dataset, siteIds, m));
}

/** 점검 상태 현장만 공정차이 오름차순(같으면 현장 ID 순)으로 정렬합니다. */
export function inspectionRanking(
  dataset: Dataset,
  siteIds: string[],
  month: string,
): SiteMetrics[] {
  return siteIds
    .map((id) => dataset.byKey.get(recordKey(month, id)))
    .filter((r): r is SiteRecord => r !== undefined)
    .map((r) => siteMetrics(dataset, r))
    .filter((m) => m.status === "inspect")
    .sort((a, b) =>
      a.gapMilli === b.gapMilli
        ? a.record.siteId.localeCompare(b.record.siteId)
        : a.gapMilli < b.gapMilli
          ? -1
          : 1,
    );
}

/** 선택 월의 현장별 지표(현장 ID 순). 비교표·CSV가 같이 씁니다. */
export function siteRows(dataset: Dataset, siteIds: string[], month: string): SiteMetrics[] {
  return siteIds
    .map((id) => dataset.byKey.get(recordKey(month, id)))
    .filter((r): r is SiteRecord => r !== undefined)
    .map((r) => siteMetrics(dataset, r));
}
