"use client";

import { useState } from "react";
import type { Aggregate } from "@/lib/calc";
import { prevMonth } from "@/lib/dataset";
import { fmtMonthShort, fmtMoney, NA } from "@/lib/format";
import { milliToTenths } from "@/lib/decimal";

const W = 640;
const H = 250;
const PAD = { left: 16, right: 16, top: 34, bottom: 30 };

/** 월별 당월기성액 막대. 누적기성액이 아니라 "그 달에 늘어난 금액"입니다. */
export function MonthlyBars({ points }: { points: Aggregate[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = points.length;

  if (n === 0 || points.every((p) => p.siteCount === 0)) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" data-testid="monthly-bars">
        <h2 className="text-base font-semibold">월별 기성액 (당월기성액)</h2>
        <p className="mt-4 text-sm text-slate-600">선택한 범위에 자료가 없어 그릴 수 없습니다.</p>
      </section>
    );
  }

  const values = points.map((p) => (p.monthlyEarnedMilli === null ? null : Number(milliToTenths(p.monthlyEarnedMilli)) / 10));
  const max = Math.max(1, ...values.filter((v): v is number => v !== null));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / n;
  const barW = Math.min(36, slot * 0.6);
  const base = H - PAD.bottom;
  const selected = n - 1;
  const active = hover ?? selected;
  const sel = points[selected];
  const hasNull = points.some((p) => p.monthlyEarnedMilli === null && p.siteCount > 0);
  const showLabel = (i: number) => n <= 8 || (n - 1 - i) % 2 === 0;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" data-testid="monthly-bars">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">월별 기성액 (당월기성액)</h2>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">단위: 백만원</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">그 달에 늘어난 기성액입니다. 월말까지 쌓인 누적기성액과 다릅니다.</p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label="월별 당월기성액 막대 차트"
        onMouseLeave={() => setHover(null)}
      >
        <line x1={PAD.left} x2={W - PAD.right} y1={base} y2={base} stroke="#cbd5e1" />
        {points.map((p, i) => {
          const cx = PAD.left + slot * i + slot / 2;
          const v = values[i];
          const isSel = i === selected;
          const h = v === null ? 0 : (v / max) * plotH;
          return (
            <g key={p.month} onMouseEnter={() => setHover(i)}>
              <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={plotH + PAD.bottom} fill="transparent" />
              {v === null ? (
                p.siteCount > 0 && (
                  <text x={cx} y={base - 6} textAnchor="middle" fontSize="11" fill="#64748b">
                    {NA}*
                  </text>
                )
              ) : (
                <rect
                  x={cx - barW / 2}
                  y={base - h}
                  width={barW}
                  height={h}
                  rx="2"
                  fill={isSel ? "#0f172a" : i === active ? "#475569" : "#cbd5e1"}
                />
              )}
              {i === active && v !== null && (
                <text x={cx} y={base - h - 6} textAnchor="middle" fontSize="12" fontWeight="700" fill="#0f172a" data-testid="bar-value">
                  {fmtMoney(p.monthlyEarnedMilli)}
                </text>
              )}
              {showLabel(i) && (
                <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fontWeight={isSel ? 700 : 400} fill={isSel ? "#0f172a" : "#64748b"}>
                  {fmtMonthShort(p.month)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-3 text-sm" data-testid="monthly-formula">
        {sel.monthlyEarnedMilli !== null ? (
          <p>
            <span className="font-semibold">{Number(sel.month.slice(5))}월 당월기성액</span>{" "}
            <span className="num font-bold">{fmtMoney(sel.monthlyEarnedMilli)}</span> ={" "}
            <span className="num">{fmtMoney(sel.earnedMilli)}</span>({Number(sel.month.slice(5))}월 누적) −{" "}
            <span className="num">{fmtMoney(sel.earnedMilli - sel.monthlyEarnedMilli)}</span>(
            {Number(prevMonth(sel.month).slice(5))}월 누적)
          </p>
        ) : sel.siteCount > 0 ? (
          <p>
            <span className="font-semibold">{sel.month} 당월기성액: {NA}</span> — 전월({prevMonth(sel.month)}) 자료가
            없어 계산할 수 없습니다. 누적기성액 <span className="num">{fmtMoney(sel.earnedMilli)}</span>은 당월기성액이
            아닙니다.
          </p>
        ) : (
          <p>선택한 범위에 자료가 없습니다.</p>
        )}
      </div>
      <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
        {hasNull && <li data-testid="bars-null-note">* 전월 자료가 없어 계산할 수 없습니다. 누적액을 당월액으로 대신 쓰지 않습니다.</li>}
        <li>누적기성액은 수금액이 아닙니다. 수금액·미수금은 이 자료에 없습니다.</li>
      </ul>
    </section>
  );
}
