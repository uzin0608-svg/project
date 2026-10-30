"use client";

import { useRouter } from "next/navigation";
import type { Aggregate, SiteMetrics } from "@/lib/calc";
import { fmtPct, fmtPp } from "@/lib/format";
import { milliToTenths } from "@/lib/decimal";
import { useDashboard } from "@/state/DashboardProvider";
import { StatusBadge } from "./StatusBadge";

function CountChips({ counts }: { counts: Aggregate["counts"] }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs" data-testid="status-counts">
      <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">정상 {counts.normal}곳</span>
      <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">주의 {counts.caution}곳</span>
      <span className="rounded border border-red-200 bg-red-50 px-2 py-1 font-semibold text-red-700">점검 {counts.inspect}곳</span>
    </div>
  );
}

/** 점검 상태 현장만 공정차이가 작은 순으로 보여 줍니다. 한 줄을 누르면 비교표에서 기록을 펼칩니다. */
export function InspectionRanking({ ranking, agg }: { ranking: SiteMetrics[]; agg: Aggregate }) {
  const router = useRouter();
  const { setFocus } = useDashboard();

  const open = (siteId: string) => {
    setFocus(siteId);
    router.push("/compare");
  };

  return (
    <section aria-label="점검 현장 순위" className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
        <h2 className="border-l-4 border-red-600 pl-2 text-base font-semibold text-slate-900">
          점검이 필요한 현장 순위 (공정차이 순)
        </h2>
        {ranking.length > 0 && (
          <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
            집중 관리 대상 {ranking.length}곳
          </span>
        )}
        <div className="ml-auto">
          <CountChips counts={agg.counts} />
        </div>
      </div>

      {agg.siteCount === 0 ? (
        <p className="p-6 text-sm text-slate-600" data-testid="ranking-empty">
          선택한 범위에 자료가 없어 순위를 만들 수 없습니다.
        </p>
      ) : ranking.length === 0 ? (
        <div className="p-6" data-testid="no-inspection">
          <p className="font-semibold text-slate-900">점검 대상 없음</p>
          <p className="mt-1 text-sm text-slate-600">
            고른 범위에 점검 현장이 없습니다. 정상 {agg.counts.normal}곳 · 주의 {agg.counts.caution}곳
          </p>
        </div>
      ) : (
        <>
          <p className="px-4 pt-3 text-xs text-slate-500">
            공정차이가 작은(늦은) 순서입니다. 줄을 누르면 비교표로 이동해 그 현장의 기록을 펼칩니다.
          </p>
          <div className="overflow-x-auto p-4">
            <table className="w-full min-w-[820px] text-left text-sm" data-testid="ranking-table">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2">순위</th>
                  <th className="px-3 py-2">현장명</th>
                  <th className="px-3 py-2">공사 유형</th>
                  <th className="px-3 py-2">지역</th>
                  <th className="px-3 py-2 text-right">계획 공정률</th>
                  <th className="px-3 py-2 text-right">실제 공정률</th>
                  <th className="px-3 py-2 text-right">기성률</th>
                  <th className="px-3 py-2 text-right">공정차이</th>
                  <th className="px-3 py-2">상태</th>
                  <th className="px-3 py-2">조치 사항</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((m, i) => (
                  <tr
                    key={m.record.siteId}
                    data-testid={`rank-row-${m.record.siteId}`}
                    onClick={() => open(m.record.siteId)}
                    className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-3 py-2.5">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-50 text-xs font-bold text-red-700">
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-slate-900">현장 {m.record.siteId}</span>
                      <span className="ml-1 text-xs text-slate-500">{m.record.siteName}</span>
                    </td>
                    <td className="px-3 py-2.5">{m.record.projectType}</td>
                    <td className="px-3 py-2.5">{m.record.region}</td>
                    <td className="num px-3 py-2.5 text-right text-slate-600">{fmtPct(milliToTenths(m.record.plannedProgress))}</td>
                    <td className="num px-3 py-2.5 text-right font-semibold">{fmtPct(milliToTenths(m.record.actualProgress))}</td>
                    <td className="num px-3 py-2.5 text-right">{fmtPct(m.earnedRateTenths)}</td>
                    <td className="num px-3 py-2.5 text-right font-semibold text-red-700">{fmtPp(m.gapTenths)}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={m.status} /></td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          open(m.record.siteId);
                        }}
                        className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100"
                      >
                        상세 기록 →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
