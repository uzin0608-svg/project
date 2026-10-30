"use client";

import { useState } from "react";
import type { Aggregate } from "@/lib/calc";
import { fmtMonthShort, fmtPct, fmtPp } from "@/lib/format";

const W = 640;
const H = 250;
const PAD = { left: 46, right: 18, top: 18, bottom: 30 };

/** 시작 월~선택 월의 계획·실제 공정률(계약금액 가중평균) 선 차트 */
export function TrendChart({ points }: { points: Aggregate[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const valid = points.filter((p) => p.plannedTenths !== null && p.actualTenths !== null);

  if (valid.length === 0) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" data-testid="trend-chart">
        <h2 className="text-base font-semibold">계획 vs 실제 공정률 추이</h2>
        <p className="mt-4 text-sm text-slate-600">선택한 범위에 자료가 없어 그릴 수 없습니다.</p>
      </section>
    );
  }

  const n = points.length;
  const plannedValues = points.map((p) => (p.plannedTenths === null ? null : Number(p.plannedTenths) / 10));
  const actualValues = points.map((p) => (p.actualTenths === null ? null : Number(p.actualTenths) / 10));
  const all = [...plannedValues, ...actualValues].filter((v): v is number => v !== null);
  // 눈금은 10% 또는 20% 단위로 정리합니다.
  const tickStep = Math.max(...all) - Math.min(...all) > 50 ? 20 : 10;
  const yMin = Math.max(0, Math.floor((Math.min(...all) - 2) / tickStep) * tickStep);
  const yMax = Math.min(100, Math.ceil((Math.max(...all) + 2) / tickStep) * tickStep);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => (n === 1 ? PAD.left + plotW / 2 : PAD.left + (i * plotW) / (n - 1));
  const y = (v: number) => PAD.top + ((yMax - v) / (yMax - yMin)) * plotH;

  const pathOf = (values: (number | null)[]) => {
    let d = "";
    let pen = false;
    values.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      pen = true;
    });
    return d.trim();
  };

  const ticks: number[] = [];
  for (let t = yMin; t <= yMax; t += tickStep) ticks.push(t);

  const active = hover ?? n - 1;
  const ap = points[active];
  const showLabel = (i: number) => n <= 8 || (n - 1 - i) % 2 === 0;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    if (n === 1) return setHover(0);
    const idx = Math.round(((px - PAD.left) / plotW) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, idx)));
  };

  const tipW = 150;
  // 툴팁은 점의 반대쪽(오른쪽 절반이면 왼쪽)에 두어 선을 가리지 않게 합니다.
  const tipX = x(active) > W / 2 ? x(active) - tipW - 12 : x(active) + 12;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" data-testid="trend-chart">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">계획 vs 실제 공정률 추이</h2>
        <div className="flex items-center gap-3 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1">
            <svg width="22" height="6" aria-hidden><line x1="0" y1="3" x2="22" y2="3" stroke="#64748b" strokeWidth="2" strokeDasharray="4 3" /></svg>
            계획 공정선
          </span>
          <span className="inline-flex items-center gap-1">
            <svg width="22" height="6" aria-hidden><line x1="0" y1="3" x2="22" y2="3" stroke="#0f172a" strokeWidth="3" /></svg>
            실제 공정선
          </span>
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {points[0].month} ~ {points[n - 1].month} 누적 가중 공정률 ({n}개월)
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`계획과 실제 공정률 추이. ${ap.month} 계획 ${fmtPct(ap.plannedTenths)}, 실제 ${fmtPct(ap.actualTenths)}, 간격 ${fmtPp(ap.gapTenths)}`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#e2e8f0" />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#64748b">{t.toFixed(0)}%</text>
          </g>
        ))}
        {points.map((p, i) =>
          showLabel(i) ? (
            <text key={p.month} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#64748b">
              {fmtMonthShort(p.month)}
            </text>
          ) : null,
        )}
        <path d={pathOf(plannedValues)} fill="none" stroke="#64748b" strokeWidth="2" strokeDasharray="5 4" />
        <path d={pathOf(actualValues)} fill="none" stroke="#0f172a" strokeWidth="3" />
        {points.map((p, i) => (
          <g key={p.month}>
            {plannedValues[i] !== null && <circle cx={x(i)} cy={y(plannedValues[i]!)} r={i === active ? 4 : 2.5} fill="#64748b" />}
            {actualValues[i] !== null && <circle cx={x(i)} cy={y(actualValues[i]!)} r={i === active ? 5 : 3} fill="#0f172a" />}
          </g>
        ))}
        <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={H - PAD.bottom} stroke="#94a3b8" strokeDasharray="3 3" />
        {ap.plannedTenths !== null && ap.actualTenths !== null && (
          <g data-testid="trend-tooltip" transform={`translate(${tipX}, ${PAD.top})`}>
            <rect width={tipW} height="66" rx="4" fill="#fff" stroke="#cbd5e1" />
            <text x="8" y="16" fontSize="11" fill="#475569">{ap.month}</text>
            <text x="8" y="32" fontSize="12" fill="#475569">계획 {fmtPct(ap.plannedTenths)}</text>
            <text x="8" y="47" fontSize="12" fontWeight="600" fill="#0f172a">실제 {fmtPct(ap.actualTenths)}</text>
            <text x="8" y="62" fontSize="12" fontWeight="600" fill={ap.gapTenths !== null && ap.gapTenths < 0n ? "#b91c1c" : "#0f172a"}>
              간격 {fmtPp(ap.gapTenths)}
            </text>
          </g>
        )}
      </svg>
      <p className="sr-only" data-testid="trend-summary">
        {points.map((p) => `${p.month} 계획 ${fmtPct(p.plannedTenths)} 실제 ${fmtPct(p.actualTenths)}`).join(", ")}
      </p>
    </section>
  );
}
