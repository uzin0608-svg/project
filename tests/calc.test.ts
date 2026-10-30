import { describe, expect, it } from "vitest";
import { aggregate, inspectionRanking, siteMetrics, siteRows, trend } from "@/lib/calc";
import { recordKey } from "@/lib/dataset";
import { scopeSiteIds } from "@/lib/filter";
import { fmtMoney, fmtPct, fmtPp } from "@/lib/format";
import { ALL, STATUS_LABEL } from "@/lib/types";
import { loadDataset, m1, t1 } from "./helpers";

const ds = loadDataset("csv");
const allIds = ds.sites.map((s) => s.siteId);

describe("검산표 — 월별 전체 현장", () => {
  // [월, 누적기성액, 기성률, 계획, 실제, 공정차이, 당월기성액, 정상, 주의, 점검]
  const table: [string, string, string, string, string, string, string | null, number, number, number][] = [
    ["2025-10", "105449.7", "16.7", "19.4", "19.6", "0.2", null, 10, 2, 0],
    ["2025-11", "125857.8", "20.0", "22.8", "23.2", "0.3", "20408.1", 10, 2, 0],
    ["2025-12", "148530.2", "23.6", "26.9", "27.0", "0.2", "22672.4", 9, 3, 0],
    ["2026-01", "173599.9", "27.5", "31.4", "31.3", "-0.1", "25069.7", 9, 3, 0],
    ["2026-02", "202848.9", "32.2", "36.7", "36.2", "-0.4", "29249.0", 8, 4, 0],
    ["2026-03", "233981.1", "37.1", "42.4", "41.6", "-0.8", "31132.2", 8, 3, 1],
    ["2026-04", "266640.0", "42.3", "48.6", "47.1", "-1.5", "32658.9", 8, 2, 2],
    ["2026-05", "300878.0", "47.7", "54.8", "52.9", "-1.9", "34238.0", 8, 1, 3],
    ["2026-06", "335344.9", "53.2", "60.7", "58.3", "-2.4", "34466.9", 7, 2, 3],
    ["2026-07", "364718.5", "57.8", "65.8", "63.2", "-2.6", "29373.6", 6, 2, 4],
    ["2026-08", "395184.7", "62.7", "69.9", "67.6", "-2.3", "30466.2", 6, 2, 4],
    ["2026-09", "424063.4", "67.2", "73.2", "71.2", "-2.0", "28878.7", 6, 3, 3],
  ];

  for (const [month, earned, rate, planned, actual, gap, monthly, normal, caution, inspect] of table) {
    it(`${month}`, () => {
      const a = aggregate(ds, allIds, month);
      expect(a.siteCount).toBe(12);
      expect(m1(a.contractMilli)).toBe("630700.0");
      expect(m1(a.earnedMilli)).toBe(earned);
      expect(t1(a.earnedRateTenths)).toBe(rate);
      expect(t1(a.plannedTenths)).toBe(planned);
      expect(t1(a.actualTenths)).toBe(actual);
      expect(t1(a.gapTenths)).toBe(gap);
      expect(m1(a.monthlyEarnedMilli)).toBe(monthly);
      expect(a.counts).toEqual({ normal, caution, inspect });
    });
  }
});

describe("정답 숫자 — 9월 전체", () => {
  const a = aggregate(ds, allIds, "2026-09");
  it("표시 문자", () => {
    expect(fmtMoney(a.contractMilli)).toBe("630,700.0");
    expect(fmtMoney(a.earnedMilli)).toBe("424,063.4");
    expect(fmtPct(a.earnedRateTenths)).toBe("67.2%");
    expect(fmtPct(a.plannedTenths)).toBe("73.2%");
    expect(fmtPct(a.actualTenths)).toBe("71.2%");
    expect(fmtPp(a.gapTenths)).toBe("-2.0pp");
    expect(fmtMoney(a.monthlyEarnedMilli)).toBe("28,878.7");
  });
  it("8월·7월 누적기성액과 기성률", () => {
    const aug = aggregate(ds, allIds, "2026-08");
    const jul = aggregate(ds, allIds, "2026-07");
    expect(fmtMoney(aug.earnedMilli)).toBe("395,184.7");
    expect(fmtPct(aug.earnedRateTenths)).toBe("62.7%");
    expect(fmtMoney(jul.earnedMilli)).toBe("364,718.5");
    expect(fmtPct(jul.earnedRateTenths)).toBe("57.8%");
  });
  it("전체 공정차이는 반올림 전 값으로 계산한다(반올림한 두 값을 다시 빼지 않음)", () => {
    // 가중 실제 71.2xx − 가중 계획 73.2xx 가 -2.0 이어야 하고, 표시값 71.2 − 73.2 = -2.0 과 같다
    expect(t1(a.gapTenths)).toBe("-2.0");
  });
});

describe("정답 숫자 — 9월 현장별", () => {
  // [ID, 기성률, 공정차이, 당월기성액, 상태]
  const sites: [string, string, string, string, string][] = [
    ["A", "73.8", "1.7", "4665.6", "정상"],
    ["B", "78.4", "1.8", "3854.4", "정상"],
    ["C", "95.0", "1.4", "1166.4", "정상"],
    ["D", "69.4", "-10.7", "3339.6", "점검"],
    ["E", "98.6", "0.3", "302.4", "정상"],
    ["F", "60.5", "-3.4", "2117.0", "주의"],
    ["G", "50.1", "1.6", "3849.3", "정상"],
    ["H", "27.2", "-1.8", "543.4", "주의"],
    ["I", "60.7", "-7.6", "3052.8", "점검"],
    ["J", "92.7", "-0.8", "1393.2", "주의"],
    ["K", "60.5", "-5.4", "3586.0", "점검"],
    ["L", "87.4", "2.2", "1008.6", "정상"],
  ];
  for (const [id, rate, gap, monthly, status] of sites) {
    it(`현장 ${id}`, () => {
      const m = siteMetrics(ds, ds.byKey.get(recordKey("2026-09", id))!);
      expect(t1(m.earnedRateTenths)).toBe(rate);
      expect(t1(m.gapTenths)).toBe(gap);
      expect(m1(m.monthlyEarnedMilli)).toBe(monthly);
      expect(STATUS_LABEL[m.status]).toBe(status);
    });
  }

  it("점검 순서는 D → I → K", () => {
    const ranking = inspectionRanking(ds, allIds, "2026-09");
    expect(ranking.map((r) => r.record.siteId)).toEqual(["D", "I", "K"]);
    expect(ranking.map((r) => t1(r.gapTenths))).toEqual(["-10.7", "-7.6", "-5.4"]);
  });

  it("D의 최근 공정차이: 8월 -11.2pp → 9월 -10.7pp", () => {
    const aug = siteMetrics(ds, ds.byKey.get(recordKey("2026-08", "D"))!);
    const sep = siteMetrics(ds, ds.byKey.get(recordKey("2026-09", "D"))!);
    expect(t1(aug.gapTenths)).toBe("-11.2");
    expect(t1(sep.gapTenths)).toBe("-10.7");
    expect(STATUS_LABEL[sep.status]).toBe("점검");
  });
});

describe("당월기성액과 누적값의 구별", () => {
  it("2025-10은 계산 불가(null)이며 누적액으로 대신하지 않는다", () => {
    const a = aggregate(ds, allIds, "2025-10");
    expect(a.monthlyEarnedMilli).toBeNull();
    expect(m1(a.earnedMilli)).toBe("105449.7");
    for (const m of siteRows(ds, allIds, "2025-10")) expect(m.monthlyEarnedMilli).toBeNull();
  });

  it("J의 7월 당월기성액 0.0은 정상값(null이 아님)", () => {
    const j = siteMetrics(ds, ds.byKey.get(recordKey("2026-07", "J"))!);
    expect(j.monthlyEarnedMilli).toBe(0n);
    expect(m1(j.monthlyEarnedMilli)).toBe("0.0");
    expect(j.record.actualProgress).toBeGreaterThan(
      ds.byKey.get(recordKey("2026-06", "J"))!.actualProgress,
    );
  });

  it("전월이 빠진 현장이 하나라도 있으면 전체 당월기성액은 계산 불가", () => {
    const records = ds.records.filter((r) => !(r.month === "2026-08" && r.siteId === "D"));
    const partial = { ...ds, byKey: new Map(records.map((r) => [recordKey(r.month, r.siteId), r])) };
    expect(aggregate(partial, allIds, "2026-09").monthlyEarnedMilli).toBeNull();
    // 다른 달은 영향 없음
    expect(aggregate(partial, allIds, "2026-08").siteCount).toBe(11);
  });
});

describe("지역·유형 필터", () => {
  const regionTable: [string, number, string, string, string, [number, number, number]][] = [
    ["인천", 2, "185100.0", "113211.9", "61.2", [2, 0, 0]],
    ["경기", 4, "210400.0", "144189.2", "68.5", [2, 1, 1]],
    ["충남", 2, "55400.0", "40717.9", "73.5", [1, 1, 0]],
    ["충북", 1, "57600.0", "34963.2", "60.7", [0, 0, 1]],
    ["세종", 1, "32400.0", "30034.8", "92.7", [0, 1, 0]],
    ["강원", 1, "65200.0", "39446.0", "60.5", [0, 0, 1]],
    ["대전", 1, "24600.0", "21500.4", "87.4", [1, 0, 0]],
  ];
  for (const [region, count, contract, earned, rate, [n, c, i]] of regionTable) {
    it(`9월 ${region}`, () => {
      const ids = scopeSiteIds(ds, { month: "2026-09", region, projectType: ALL, siteId: ALL });
      const a = aggregate(ds, ids, "2026-09");
      expect(ids).toHaveLength(count);
      expect(m1(a.contractMilli)).toBe(contract);
      expect(m1(a.earnedMilli)).toBe(earned);
      expect(t1(a.earnedRateTenths)).toBe(rate);
      expect(a.counts).toEqual({ normal: n, caution: c, inspect: i });
    });
  }

  it("9월 인천·공동주택 → A·G 2곳", () => {
    const ids = scopeSiteIds(ds, { month: "2026-09", region: "인천", projectType: "공동주택", siteId: ALL });
    expect(ids).toEqual(["A", "G"]);
  });

  it("범위에 현장이 없으면 모두 계산 불가이며 0%로 바꾸지 않는다", () => {
    const ids = scopeSiteIds(ds, { month: "2026-09", region: "인천", projectType: "생산시설", siteId: ALL });
    expect(ids).toEqual([]);
    const a = aggregate(ds, ids, "2026-09");
    expect(a.siteCount).toBe(0);
    expect(a.earnedRateTenths).toBeNull();
    expect(a.plannedTenths).toBeNull();
    expect(a.actualTenths).toBeNull();
    expect(a.gapTenths).toBeNull();
    expect(a.monthlyEarnedMilli).toBeNull();
    expect(inspectionRanking(ds, ids, "2026-09")).toEqual([]);
  });
});

describe("추이", () => {
  it("선택 월까지만, 매월 별도 집계한다", () => {
    expect(trend(ds, allIds, "2026-09")).toHaveLength(12);
    const mar = trend(ds, allIds, "2026-03");
    expect(mar.map((p) => p.month)).toEqual(["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03"]);
    expect(trend(ds, allIds, "2025-10")).toHaveLength(1);
  });

  it("같은 필터 범위로 집계한다(D만 → 계약금액 72,600 고정)", () => {
    const pts = trend(ds, ["D"], "2026-09");
    expect(pts).toHaveLength(12);
    for (const p of pts) expect(m1(p.contractMilli)).toBe("72600.0");
  });
});
