"use client";

import { useState } from "react";
import { buildCsvExport } from "@/lib/export-csv";
import { sitesMatchingRegionType } from "@/lib/filter";
import { fmtMonthLong } from "@/lib/format";
import { ALL, PROJECT_TYPES, REGIONS, type Filters } from "@/lib/types";
import { useDashboard } from "@/state/DashboardProvider";

const SELECT_CLASS =
  "h-9 rounded border border-slate-300 bg-white px-2.5 text-sm text-slate-800 hover:bg-slate-50";

function downloadFile(content: string, fileName: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 월·지역·공사 유형·현장 선택과 CSV 내보내기. 현황 요약·비교표가 같은 필터를 씁니다. */
export function FilterBar() {
  const { state, setFilters, resetFilters, dismissNotice } = useDashboard();
  const { dataset, filters, notice } = state;
  // 안내 글은 만들어진 때의 필터와 함께 보관해, 필터가 바뀌면 보이지 않게 합니다.
  const [exportState, setExportState] = useState<{ text: string; filters: Filters } | null>(null);
  const exportMessage = exportState && exportState.filters === filters ? exportState.text : null;

  if (!dataset) return null;

  const regions = REGIONS.filter((r) => dataset.sites.some((s) => s.region === r));
  const types = PROJECT_TYPES.filter((t) => dataset.sites.some((s) => s.projectType === t));
  const siteOptions = sitesMatchingRegionType(dataset, filters);
  const exportPreview = buildCsvExport(dataset, filters);

  const onExport = () => {
    try {
      const result = buildCsvExport(dataset, filters);
      if (result.rowCount === 0) return;
      downloadFile(result.content, result.fileName);
      setExportState({ text: `${result.rowCount}행을 내보냈습니다. (${result.fileName})`, filters });
    } catch {
      setExportState({ text: "내보내지 못했습니다. 다시 시도해 주세요.", filters });
    }
  };

  return (
    <div className="border-b border-slate-200 bg-slate-50/60 py-3" data-testid="filter-bar">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-semibold text-slate-700">필터 조건</span>
        <label className="sr-only" htmlFor="filter-month">월</label>
        <select
          id="filter-month"
          className={SELECT_CLASS}
          value={filters.month}
          onChange={(e) => setFilters({ month: e.target.value })}
        >
          {dataset.months.map((m) => (
            <option key={m} value={m}>
              {m} ({fmtMonthLong(m)})
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="filter-region">지역</label>
        <select
          id="filter-region"
          className={SELECT_CLASS}
          value={filters.region}
          onChange={(e) => setFilters({ region: e.target.value })}
        >
          <option value={ALL}>전체 지역</option>
          {regions.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="filter-type">공사 유형</label>
        <select
          id="filter-type"
          className={SELECT_CLASS}
          value={filters.projectType}
          onChange={(e) => setFilters({ projectType: e.target.value })}
        >
          <option value={ALL}>전체 공사유형</option>
          {types.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="filter-site">현장</label>
        <select
          id="filter-site"
          className={SELECT_CLASS}
          value={filters.siteId}
          onChange={(e) => setFilters({ siteId: e.target.value })}
        >
          <option value={ALL}>전체 {siteOptions.length}개 현장 집계</option>
          {siteOptions.map((id) => (
            <option key={id} value={id}>
              현장 {id}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={resetFilters}
          className="h-9 rounded border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
        >
          필터 초기화
        </button>
        <button
          type="button"
          onClick={onExport}
          disabled={exportPreview.rowCount === 0}
          className="ml-auto h-9 rounded bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          현재 범위 CSV 내보내기(19개 열)
        </button>
      </div>
      <div className="mt-2 space-y-1 text-xs" aria-live="polite">
        {notice && (
          <p className="flex items-center gap-2 rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-blue-800" data-testid="filter-notice">
            {notice}
            <button type="button" onClick={dismissNotice} className="ml-auto text-blue-700 underline">
              닫기
            </button>
          </p>
        )}
        {exportPreview.rowCount === 0 && <p className="text-slate-500">내보낼 자료가 없습니다.</p>}
        {exportMessage && (
          <p className="text-emerald-700" data-testid="export-message">
            {exportMessage}
          </p>
        )}
      </div>
    </div>
  );
}
