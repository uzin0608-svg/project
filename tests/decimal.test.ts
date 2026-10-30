import { describe, expect, it } from "vitest";
import {
  milliToNumber,
  milliToTenths,
  milliToText,
  parseDecimal,
  roundDiv,
  tenthsToGrouped,
  tenthsToPlain,
} from "@/lib/decimal";
import { statusOf } from "@/lib/calc";
import { fmtMoney, fmtPct, fmtPp, NA } from "@/lib/format";

describe("parseDecimal", () => {
  it("소수를 1000배 정수로 정확히 읽는다", () => {
    expect(parseDecimal("86.5")).toEqual({ ok: true, value: 86500n });
    expect(parseDecimal("13132.8")).toEqual({ ok: true, value: 13132800n });
    expect(parseDecimal("1971")).toEqual({ ok: true, value: 1971000n });
    expect(parseDecimal("0.125")).toEqual({ ok: true, value: 125n });
    expect(parseDecimal("-5")).toEqual({ ok: true, value: -5000n });
  });

  it("숫자가 아니면 format, 소수 셋째 자리를 넘으면 decimals", () => {
    expect(parseDecimal("abc")).toEqual({ ok: false, reason: "format" });
    expect(parseDecimal("1e3")).toEqual({ ok: false, reason: "format" });
    expect(parseDecimal("1,000")).toEqual({ ok: false, reason: "format" });
    expect(parseDecimal("12.3456")).toEqual({ ok: false, reason: "decimals" });
  });
});

describe("반올림(마지막에 한 번, 0.05는 올림)", () => {
  it("roundDiv", () => {
    expect(roundDiv(5n, 10n)).toBe(1n); // 0.5 → 1
    expect(roundDiv(4n, 10n)).toBe(0n);
    expect(roundDiv(-5n, 10n)).toBe(-1n); // 0에서 먼 쪽
    expect(roundDiv(15n, 10n)).toBe(2n);
  });

  it("milliToTenths: 69.395 → 69.4, 69.394 → 69.4, 69.349 → 69.3", () => {
    expect(milliToTenths(69350n)).toBe(694n); // 69.35 → 69.4
    expect(milliToTenths(69349n)).toBe(693n);
  });
});

describe("표시용 문자", () => {
  it("쉼표·소수 첫째 자리", () => {
    expect(tenthsToPlain(694n)).toBe("69.4");
    expect(tenthsToPlain(-107n)).toBe("-10.7");
    expect(tenthsToPlain(-5n)).toBe("-0.5");
    expect(tenthsToPlain(0n)).toBe("0.0");
    expect(tenthsToGrouped(6307000n)).toBe("630,700.0");
    expect(fmtMoney(424063400n)).toBe("424,063.4");
  });

  it("비율·공정차이·계산 불가", () => {
    expect(fmtPct(672n)).toBe("67.2%");
    expect(fmtPp(-107n)).toBe("-10.7pp");
    expect(fmtPp(17n)).toBe("+1.7pp");
    expect(fmtPp(0n)).toBe("0.0pp");
    expect(fmtPct(null)).toBe(NA);
    expect(fmtMoney(null)).toBe(NA);
  });

  it("파일에 적힌 모양으로 되돌린다", () => {
    expect(milliToText(8000n, 1)).toBe("8.0");
    expect(milliToText(1971000n, 0)).toBe("1971");
    expect(milliToText(13132800n, 0)).toBe("13132.8");
    expect(milliToText(86500n, 1)).toBe("86.5");
    expect(milliToNumber(86500n)).toBe(86.5);
  });
});

describe("상태 판정 경계 (공정차이 = 실제 − 계획)", () => {
  const gap = (planned: string, actual: string) => {
    const p = parseDecimal(planned);
    const a = parseDecimal(actual);
    if (!p.ok || !a.ok) throw new Error("bad");
    return a.value - p.value;
  };
  it("계획 70·실제 70 → 정상, 65.1 → 주의, 65 → 점검", () => {
    expect(statusOf(gap("70", "70"))).toBe("normal");
    expect(statusOf(gap("70", "65.1"))).toBe("caution");
    expect(statusOf(gap("70", "65"))).toBe("inspect");
  });
  it("-0.1은 주의, +0.1은 정상", () => {
    expect(statusOf(gap("70", "69.9"))).toBe("caution");
    expect(statusOf(gap("70", "70.1"))).toBe("normal");
  });
});
