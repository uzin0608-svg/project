import { siteRows } from "./calc";
import type { Dataset } from "./dataset";
import { milliToText, tenthsToPlain, milliToTenths } from "./decimal";
import { scopeSiteIds } from "./filter";
import { NA } from "./format";
import { ALL, REQUIRED_FIELDS, STATUS_LABEL, type Filters } from "./types";

export const EXPORT_EXTRA_HEADERS = ["기성률(%)", "공정차이(pp)", "상태", "당월기성액(백만원)"] as const;

function escapeCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export interface CsvExport {
  /** UTF-8 BOM으로 시작하는 파일 내용(줄바꿈은 CRLF) */
  content: string;
  fileName: string;
  /** 머리글을 뺀 데이터 행 수 */
  rowCount: number;
}

/** 지금 고른 월·지역·유형·현장과 같은 범위를 원본 15개 열 + 추가 4개 열로 만듭니다. */
export function buildCsvExport(dataset: Dataset, filters: Filters): CsvExport {
  const rows = siteRows(dataset, scopeSiteIds(dataset, filters), filters.month);
  const header = [...REQUIRED_FIELDS, ...EXPORT_EXTRA_HEADERS].map(escapeCell).join(",");
  const lines = rows.map((m) => {
    const r = m.record;
    const cells: string[] = [
      r.month,
      r.siteId,
      r.siteName,
      milliToText(r.contractAmount, 0),
      milliToText(r.plannedProgress, 1),
      milliToText(r.actualProgress, 1),
      milliToText(r.cumulativeEarned, 0),
      r.region,
      r.projectType,
      r.startDate,
      r.contractEndDate,
      r.currentWork,
      r.issueCategory,
      r.issueSummary,
      r.actionPlan,
      tenthsToPlain(m.earnedRateTenths),
      tenthsToPlain(m.gapTenths),
      STATUS_LABEL[m.status],
      m.monthlyEarnedMilli === null ? NA : tenthsToPlain(milliToTenths(m.monthlyEarnedMilli)),
    ];
    return cells.map(escapeCell).join(",");
  });
  const parts = [filters.region, filters.projectType, filters.siteId].filter((p) => p !== ALL);
  const scopeText = parts.length > 0 ? parts.join("-") : "전체";
  return {
    content: "﻿" + [header, ...lines].join("\r\n") + "\r\n",
    fileName: `현장공정기성_${filters.month}_${scopeText}.csv`,
    rowCount: lines.length,
  };
}
