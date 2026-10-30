import { tenthsToGrouped, tenthsToPlain, milliToTenths } from "./decimal";

export const NA = "계산 불가";

/** 금액(1000배 정수) → "63,763.2". 계산 불가면 "계산 불가" */
export function fmtMoney(milli: bigint | null): string {
  return milli === null ? NA : tenthsToGrouped(milliToTenths(milli));
}

/** 비율(10배 정수) → "67.2%" */
export function fmtPct(tenths: bigint | null): string {
  return tenths === null ? NA : `${tenthsToPlain(tenths)}%`;
}

/** 공정차이(10배 정수) → "-10.7pp", 양수는 "+1.7pp" */
export function fmtPp(tenths: bigint | null): string {
  if (tenths === null) return NA;
  const text = tenthsToPlain(tenths);
  return `${tenths > 0n ? "+" : ""}${text}pp`;
}

/** "2026-09" → "2026년 9월" */
export function fmtMonthLong(month: string): string {
  const [y, m] = month.split("-");
  return `${y}년 ${Number(m)}월`;
}

/** "2026-09" → "26-09" (차트 이름표) */
export function fmtMonthShort(month: string): string {
  return month.slice(2);
}
