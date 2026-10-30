import { describe, expect, it } from "vitest";
import { defaultFilters, normalizeFilters, scopeKey, scopeLabel, scopeSiteIds, sitesMatchingRegionType } from "@/lib/filter";
import { reducer, initialState } from "@/state/reducer";
import { ALL, type Filters } from "@/lib/types";
import { buildDataset } from "@/lib/dataset";
import { loadDataset } from "./helpers";

const ds = loadDataset("csv");
const f = (patch: Partial<Filters>): Filters => ({ month: "2026-09", region: ALL, projectType: ALL, siteId: ALL, ...patch });

describe("필터", () => {
  it("처음 필터는 2026-09·전체", () => {
    expect(defaultFilters(ds)).toEqual(f({}));
  });

  it("새 자료에 2026-09가 없으면 가장 마지막 월", () => {
    const short = buildDataset(ds.records.filter((r) => r.month <= "2026-03"));
    expect(defaultFilters(short).month).toBe("2026-03");
  });

  it("지역·유형으로 현장 목록이 좁혀진다", () => {
    expect(sitesMatchingRegionType(ds, f({ region: "경기" }))).toEqual(["B", "C", "D", "H"]);
    expect(sitesMatchingRegionType(ds, f({ region: "인천", projectType: "공동주택" }))).toEqual(["A", "G"]);
  });

  it("현장을 고르면 그 현장만 범위", () => {
    expect(scopeSiteIds(ds, f({ siteId: "D" }))).toEqual(["D"]);
  });

  it("지역을 바꿔 선택 현장이 빠지면 현장을 전체로 되돌린다", () => {
    const r = normalizeFilters(ds, f({ siteId: "A", region: "경기" }));
    expect(r.siteReset).toBe(true);
    expect(r.filters.siteId).toBe(ALL);
    expect(normalizeFilters(ds, f({ siteId: "D", region: "경기" })).siteReset).toBe(false);
  });

  it("범위 글과 표식", () => {
    expect(scopeLabel(ds, f({}))).toBe("2026년 9월 · 전체 지역 · 전체 공사유형 (12개 현장)");
    expect(scopeKey(f({}), 1)).not.toBe(scopeKey(f({}), 2));
    expect(scopeKey(f({ month: "2026-08" }), 1)).not.toBe(scopeKey(f({}), 1));
  });
});

describe("화면 상태(reducer)", () => {
  const loaded = reducer(initialState, { type: "LOAD", dataset: ds });
  const withAnswer = reducer(loaded, {
    type: "AI_ADD",
    item: { id: 1, question: "q", scopeText: "s", status: "pending", request: {} as never },
  });

  it("자료를 적용하면 필터·강조·AI 답변이 처음 상태로 돌아가고 자료 버전이 늘어난다", () => {
    const dirty = { ...withAnswer, filters: f({ month: "2026-01" }), focusSiteId: "D" };
    const again = reducer(dirty, { type: "LOAD", dataset: ds });
    expect(again.filters).toEqual(f({}));
    expect(again.focusSiteId).toBeNull();
    expect(again.aiItems).toEqual([]);
    expect(again.dataVersion).toBe(dirty.dataVersion + 1);
  });

  it("필터가 바뀌면 이전 AI 답변과 강조가 지워진다", () => {
    const next = reducer({ ...withAnswer, focusSiteId: "D" }, { type: "FILTERS", filters: f({ month: "2026-08" }), notice: null });
    expect(next.aiItems).toEqual([]);
    expect(next.focusSiteId).toBeNull();
    expect(next.filters.month).toBe("2026-08");
  });

  it("없어진 답변을 갱신하려는 늦은 응답은 무시된다", () => {
    const cleared = reducer(withAnswer, { type: "AI_CLEAR" });
    const late = reducer(cleared, { type: "AI_UPDATE", id: 1, patch: { status: "done" } });
    expect(late.aiItems).toEqual([]);
  });
});

