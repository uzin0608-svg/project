import { describe, expect, it } from "vitest";
import { buildDataset } from "@/lib/dataset";
import { buildCsvExport, EXPORT_EXTRA_HEADERS } from "@/lib/export-csv";
import { ALL, REQUIRED_FIELDS, type Filters } from "@/lib/types";
import { csvLines, loadDataset } from "./helpers";

const ds = loadDataset("csv");
const original = csvLines();
const f = (patch: Partial<Filters>): Filters => ({ month: "2026-09", region: ALL, projectType: ALL, siteId: ALL, ...patch });

function bodyLines(content: string): string[] {
  const lines = content.split("\r\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines.slice(1);
}

describe("CSV 내보내기", () => {
  it("UTF-8 BOM·CRLF·19개 열 머리글", () => {
    const out = buildCsvExport(ds, f({}));
    expect(out.content.startsWith("﻿")).toBe(true);
    expect(out.content.endsWith("\r\n")).toBe(true);
    const header = out.content.slice(1).split("\r\n")[0].split(",");
    expect(header).toEqual([...REQUIRED_FIELDS, ...EXPORT_EXTRA_HEADERS]);
    expect(header).toHaveLength(19);
  });

  it("9월 D만 → 데이터 1행, 추가 4개 열 값은 69.4·-10.7·점검·3339.6", () => {
    const out = buildCsvExport(ds, f({ siteId: "D" }));
    expect(out.rowCount).toBe(1);
    const [row] = bodyLines(out.content);
    expect(row.endsWith(",69.4,-10.7,점검,3339.6")).toBe(true);
    expect(out.fileName).toBe("현장공정기성_2026-09_D.csv");
  });

  it("9월 인천·공동주택 → A·G 2행(현장 ID 순)", () => {
    const out = buildCsvExport(ds, f({ region: "인천", projectType: "공동주택" }));
    expect(out.rowCount).toBe(2);
    expect(bodyLines(out.content).map((l) => l.split(",")[1])).toEqual(["A", "G"]);
  });

  it("9월 전체 → 12행", () => {
    expect(buildCsvExport(ds, f({})).rowCount).toBe(12);
  });

  it("2025-10은 당월기성액 칸이 '계산 불가'(빈칸·0 아님)", () => {
    const out = buildCsvExport(ds, f({ month: "2025-10" }));
    expect(out.rowCount).toBe(12);
    for (const row of bodyLines(out.content)) expect(row.endsWith(",계산 불가")).toBe(true);
  });

  it("범위에 자료가 없으면 0행", () => {
    expect(buildCsvExport(ds, f({ region: "인천", projectType: "생산시설" })).rowCount).toBe(0);
  });

  it("원본 15개 열은 원본 파일의 해당 줄과 글자까지 같다(144행 전체)", () => {
    let checked = 0;
    for (const month of ds.months) {
      const out = buildCsvExport(ds, f({ month }));
      for (const row of bodyLines(out.content)) {
        const key = row.split(",").slice(0, 2).join(",");
        const src = original.find((l) => l.startsWith(key + ","));
        expect(src, key).toBeDefined();
        expect(row.startsWith(src + ","), key).toBe(true);
        checked += 1;
      }
    }
    expect(checked).toBe(144);
  });

  it("쉼표·따옴표·줄바꿈이 든 칸은 따옴표로 감싼다", () => {
    const base = ds.records[0];
    const tricky = { ...base, issueSummary: '상황, "인용" 포함\n둘째 줄' };
    const ds2 = buildDataset([tricky]);
    const out = buildCsvExport(ds2, { month: base.month, region: ALL, projectType: ALL, siteId: ALL });
    expect(out.content).toContain('"상황, ""인용"" 포함\n둘째 줄"');
  });
});
