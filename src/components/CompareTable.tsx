"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { Aggregate, SiteMetrics } from "@/lib/calc";
import { milliToTenths } from "@/lib/decimal";
import { fmtMoney, fmtPct, fmtPp } from "@/lib/format";
import { useDashboard } from "@/state/DashboardProvider";
import { StatusBadge, STATUS_TEXT_COLOR } from "./StatusBadge";

/** 12개 현장 비교표. 행을 펼치면 같은 페이지 안에서 공사기간·기록된 상황·계획된 대응이 열립니다. */
export function CompareTable({ rows, agg }: { rows: SiteMetrics[]; agg: Aggregate }) {
  const { state } = useDashboard();
  const focusSiteId = state.focusSiteId;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [lastFocus, setLastFocus] = useState<string | null>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  // 점검 순위에서 누르고 넘어온 경우: 그 현장만 펼칩니다(다른 줄은 접음).
  if (focusSiteId !== lastFocus) {
    setLastFocus(focusSiteId);
    if (focusSiteId) setExpanded(new Set([focusSiteId]));
  }

  // 그 현장 줄 위치로 화면을 이동합니다.
  useEffect(() => {
    if (!focusSiteId) return;
    const t = setTimeout(() => {
      rowRefs.current.get(focusSiteId)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 50);
    return () => clearTimeout(t);
  }, [focusSiteId]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600" data-testid="compare-empty">
        선택한 범위에 자료가 없습니다.
      </p>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm" data-testid="compare-section">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
        <h2 className="text-lg font-semibold text-slate-900">
          {state.filters.month.slice(0, 4)}년 {Number(state.filters.month.slice(5))}월 종합 공정률 및 기성 실적 현황
        </h2>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{rows.length}개 현장</span>
        <div className="ml-auto flex flex-wrap gap-3 text-xs text-slate-600">
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-600" />점검 (공정차이 ≤ -5.0pp)</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-600" />주의 (-5.0pp &lt; 공정차이 &lt; 0)</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-600" />정상 (공정차이 ≥ 0)</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm" data-testid="compare-table">
          <thead className="bg-slate-50 text-[11px] font-semibold tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2">현장명</th>
              <th className="px-3 py-2">지역</th>
              <th className="px-3 py-2">공사 유형</th>
              <th className="px-3 py-2">당월 주요 공종</th>
              <th className="px-3 py-2 text-right">계약금액(백만원)</th>
              <th className="px-3 py-2 text-right">누적기성액(백만원)</th>
              <th className="px-3 py-2 text-right">당월기성액(백만원)</th>
              <th className="px-3 py-2 text-right">기성률</th>
              <th className="px-3 py-2 text-right">계획공정</th>
              <th className="px-3 py-2 text-right">실제공정</th>
              <th className="px-3 py-2 text-right">공정차이</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2"><span className="sr-only">기록 펼침</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const r = m.record;
              const isOpen = expanded.has(r.siteId);
              const isFocus = focusSiteId === r.siteId;
              return (
                <Fragment key={r.siteId}>
                  <tr
                    ref={(el) => {
                      if (el) rowRefs.current.set(r.siteId, el);
                      else rowRefs.current.delete(r.siteId);
                    }}
                    data-testid={`compare-row-${r.siteId}`}
                    data-focused={isFocus ? "true" : undefined}
                    className={`border-b border-slate-100 ${
                      isFocus
                        ? "border-l-2 border-l-blue-600 bg-blue-50"
                        : m.status === "inspect"
                          ? "bg-red-50/50"
                          : isOpen
                            ? "bg-slate-100"
                            : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="px-3 py-2.5">
                      <span className={`font-semibold ${m.status === "inspect" ? "text-red-700" : "text-slate-900"}`}>현장 {r.siteId}</span>
                      <span className="block text-xs text-slate-500">{r.siteName}</span>
                    </td>
                    <td className="px-3 py-2.5">{r.region}</td>
                    <td className="px-3 py-2.5">{r.projectType}</td>
                    <td className="px-3 py-2.5">{r.currentWork}</td>
                    <td className="num px-3 py-2.5 text-right">{fmtMoney(r.contractAmount)}</td>
                    <td className="num px-3 py-2.5 text-right">{fmtMoney(r.cumulativeEarned)}</td>
                    <td className="num px-3 py-2.5 text-right" data-testid={`monthly-${r.siteId}`}>{fmtMoney(m.monthlyEarnedMilli)}</td>
                    <td className="num px-3 py-2.5 text-right">{fmtPct(m.earnedRateTenths)}</td>
                    <td className="num px-3 py-2.5 text-right text-slate-600">{fmtPct(milliToTenths(r.plannedProgress))}</td>
                    <td className="num px-3 py-2.5 text-right font-semibold">{fmtPct(milliToTenths(r.actualProgress))}</td>
                    <td className={`num px-3 py-2.5 text-right font-semibold ${STATUS_TEXT_COLOR[m.status]}`}>{fmtPp(m.gapTenths)}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={m.status} /></td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-label={`현장 ${r.siteId} 기록 ${isOpen ? "접기" : "펼치기"}`}
                        data-testid={`toggle-${r.siteId}`}
                        onClick={() => toggle(r.siteId)}
                        className="rounded px-2 py-1 text-slate-600 hover:bg-slate-200"
                      >
                        {isOpen ? "▲" : "▼"}
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-slate-200 bg-slate-50" data-testid={`detail-${r.siteId}`}>
                      <td colSpan={13} className="px-4 py-4">
                        <div className="rounded-lg border border-slate-200 bg-white p-4">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            <h3 className="text-base font-semibold text-slate-900">현장 {r.siteId} 상세 기록</h3>
                            <span className="text-xs text-slate-600">
                              공사기간 {r.startDate} ~ {r.contractEndDate} (계약상 준공일)
                            </span>
                            <span className="text-xs text-slate-500">기준 월 {r.month}</span>
                          </div>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div className="rounded bg-slate-50 p-3">
                              <p className="text-xs font-semibold text-slate-500">기록된 상황</p>
                              <p className="mt-1 text-sm text-slate-900">“{r.issueSummary}”</p>
                            </div>
                            <div className="rounded bg-slate-50 p-3">
                              <p className="text-xs font-semibold text-slate-500">계획된 대응</p>
                              <p className="mt-1 text-sm text-slate-900">“{r.actionPlan}”</p>
                            </div>
                          </div>
                          <p className="mt-3 text-xs text-slate-600">
                            현장 기록 분류: <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium">{r.issueCategory}</span>
                            <span className="ml-2 text-slate-500">(정상·주의·점검 상태와 별개로 현장이 남긴 분류입니다)</span>
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            계약상 준공일은 예정일이며 실제 완료일이 아닙니다. 기록된 상황과 계획된 대응은 가상 시나리오의 기록이고 원인 확정이나 완료·효과를 뜻하지 않습니다.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200 px-4 py-3 text-sm" data-testid="compare-footer">
        <span className="font-semibold">
          총 {agg.siteCount}개 현장 중: 정상 {agg.counts.normal}곳 · 주의 {agg.counts.caution}곳 · 점검 {agg.counts.inspect}곳
        </span>
        <span className="text-slate-600">총 기성률: <span className="num font-semibold">{fmtPct(agg.earnedRateTenths)}</span></span>
      </div>
    </section>
  );
}
