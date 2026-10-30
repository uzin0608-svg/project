// 소수를 1000배 한 정수(BigInt)로 다룹니다. 계산 중에는 반올림하지 않고, 화면에 보이기 직전에 한 번만 반올림합니다.
// 예: "86.5" → 86500n, "13132.8" → 13132800n

export const MILLI = 1000n;

export type ParseDecimalResult =
  | { ok: true; value: bigint }
  | { ok: false; reason: "format" | "decimals" };

const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;
const MAX_DECIMALS = 3;

/** 글자 그대로 읽어 1000배 정수로 바꿉니다. 숫자가 아니면 format, 소수 셋째 자리를 넘으면 decimals. */
export function parseDecimal(text: string): ParseDecimalResult {
  const trimmed = text.trim();
  if (!DECIMAL_PATTERN.test(trimmed)) return { ok: false, reason: "format" };
  const negative = trimmed.startsWith("-");
  const body = negative ? trimmed.slice(1) : trimmed;
  const [intPart, fracPart = ""] = body.split(".");
  if (fracPart.length > MAX_DECIMALS) return { ok: false, reason: "decimals" };
  const padded = fracPart.padEnd(MAX_DECIMALS, "0");
  const value = BigInt(intPart) * MILLI + BigInt(padded);
  return { ok: true, value: negative ? -value : value };
}

/** 분자 ÷ 분모를 가장 가까운 정수로 나눕니다(0.5는 0에서 먼 쪽으로). 분모는 양수여야 합니다. */
export function roundDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error("denominator must be positive");
  const negative = numerator < 0n;
  const abs = negative ? -numerator : numerator;
  const q = (2n * abs + denominator) / (2n * denominator);
  return negative ? -q : q;
}

/** 1000배 정수를 소수 첫째 자리(10배 정수)로 반올림합니다. */
export function milliToTenths(milli: bigint): bigint {
  return roundDiv(milli, 100n);
}

/** 쉼표 없이 소수 첫째 자리 고정 문자로 만듭니다. 예: 694n → "69.4", -107n → "-10.7" */
export function tenthsToPlain(tenths: bigint): string {
  const negative = tenths < 0n;
  const abs = negative ? -tenths : tenths;
  const intPart = abs / 10n;
  const frac = abs % 10n;
  return `${negative && abs !== 0n ? "-" : ""}${intPart}.${frac}`;
}

/** 천 단위 쉼표를 넣은 소수 첫째 자리 문자. 예: 6376320n → "637,632.0" */
export function tenthsToGrouped(tenths: bigint): string {
  const plain = tenthsToPlain(tenths);
  const negative = plain.startsWith("-");
  const [intPart, frac] = (negative ? plain.slice(1) : plain).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}.${frac}`;
}

/**
 * 파일에 적힌 모양으로 되돌립니다(CSV 내보내기용).
 * minDecimals가 1이면 "8.0", 0이면 "1971"처럼 필요한 만큼만 소수를 씁니다.
 */
export function milliToText(milli: bigint, minDecimals: 0 | 1): string {
  const negative = milli < 0n;
  const abs = negative ? -milli : milli;
  const intPart = abs / MILLI;
  let frac = (abs % MILLI).toString().padStart(3, "0").replace(/0+$/, "");
  if (frac.length < minDecimals) frac = frac.padEnd(minDecimals, "0");
  return `${negative ? "-" : ""}${intPart}${frac ? "." + frac : ""}`;
}

/** AI에 보낼 때 쓰는 숫자(JavaScript number). 소수 셋째 자리까지만 있으므로 오차가 없습니다. */
export function milliToNumber(milli: bigint): number {
  return Number(milliToText(milli, 0));
}
