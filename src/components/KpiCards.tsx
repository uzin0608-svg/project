import type { Aggregate } from "@/lib/calc";
import { fmtMonthLong, fmtMoney, fmtPct, fmtPp, NA } from "@/lib/format";

function Card({
  label,
  badge,
  value,
  testId,
  children,
  valueClass = "text-slate-900",
}: {
  label: string;
  badge: string;
  value: string;
  testId: string;
  children?: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5">{badge}</span>
      </div>
      <p data-testid={testId} className={`num mt-2 text-[32px] font-bold leading-[38px] ${valueClass}`}>
        {value}
      </p>
      {children && <div className="mt-2 space-y-0.5 text-xs text-slate-600">{children}</div>}
    </div>
  );
}

export function KpiCards({ agg, expectedSiteCount }: { agg: Aggregate; expectedSiteCount: number }) {
  const gapNegative = agg.gapTenths !== null && agg.gapTenths < 0n;
  return (
    <section aria-label="전체 요약" data-testid="kpi-cards">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold text-slate-900">공정 및 기성 총괄 요약</h2>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">계약금액 가중평균</span>
        <span
          data-testid="monthly-chip"
          className="ml-auto rounded bg-blue-50 px-3 py-1 text-sm font-medium text-blue-900"
        >
          {fmtMonthLong(agg.month)} 당월기성액:{" "}
          <span className="num font-bold">{agg.monthlyEarnedMilli === null ? NA : `${fmtMoney(agg.monthlyEarnedMilli)}백만원`}</span>
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card label="전체 기성률" badge="누적 실적" value={fmtPct(agg.earnedRateTenths)} testId="kpi-earned-rate">
          <p className="flex justify-between"><span>총 계약금액</span><span className="num font-medium">{agg.siteCount ? `${fmtMoney(agg.contractMilli)}백만원` : NA}</span></p>
          <p className="flex justify-between"><span>누적 기성액</span><span className="num font-medium">{agg.siteCount ? `${fmtMoney(agg.earnedMilli)}백만원` : NA}</span></p>
        </Card>
        <Card label="계획 공정률" badge="계약금액 가중평균" value={fmtPct(agg.plannedTenths)} testId="kpi-planned">
          <p>월말 누적 계획공정률</p>
        </Card>
        <Card label="실제 공정률" badge="계약금액 가중평균" value={fmtPct(agg.actualTenths)} testId="kpi-actual">
          <p>월말 누적 실제공정률</p>
        </Card>
        <Card
          label="공정차이 (계획 대비)"
          badge="실제 − 계획"
          value={fmtPp(agg.gapTenths)}
          testId="kpi-gap"
          valueClass={gapNegative ? "text-red-700" : "text-slate-900"}
        >
          <p>0pp 미만이면 계획보다 늦은 상태입니다.</p>
        </Card>
      </div>
      {agg.siteCount > 0 && agg.siteCount < expectedSiteCount && (
        <p className="mt-2 text-xs text-amber-700" data-testid="missing-warning">
          선택한 {expectedSiteCount}개 현장 중 {agg.siteCount}개 현장의 자료만 있어 확인 가능한 행만 집계했습니다.
        </p>
      )}
      {agg.siteCount === 0 && (
        <p className="mt-2 text-sm text-slate-600" data-testid="empty-range">
          선택한 범위에 자료가 없습니다. 숫자는 &quot;계산 불가&quot;로 표시하며 0%로 바꾸지 않습니다.
        </p>
      )}
    </section>
  );
}
