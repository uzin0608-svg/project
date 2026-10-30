import { describe, expect, it } from "vitest";
import { buildDataset } from "@/lib/dataset";
import { validateImport } from "@/lib/validate";
import { csvLines, CSV_NAME, importText, loadDataset, readData } from "./helpers";

function csvWith(edit: (lines: string[]) => string[]): string {
  return "﻿" + edit(csvLines()).join("\r\n") + "\r\n";
}

/** 머리글 이름으로 열 번호를 찾아 한 칸만 바꾼 줄을 만든다(칸 안에 쉼표가 없는 줄만 사용) */
function setCell(line: string, column: number, value: string): string {
  const cells = line.split(",");
  cells[column] = value;
  return cells.join(",");
}

const COL = {
  month: 0, siteId: 1, siteName: 2, contractAmount: 3, plannedProgress: 4, actualProgress: 5,
  cumulativeEarned: 6, region: 7, projectType: 8, startDate: 9, contractEndDate: 10,
};

describe("정상 원본", () => {
  it("CSV는 144행·15열로 통과", () => {
    const r = importText(CSV_NAME, readData(CSV_NAME));
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.records).toHaveLength(144);
    expect(r.summary).toMatchObject({ source: "csv", rowCount: 144, columnCount: 15, siteCount: 12 });
    expect(r.summary?.monthRange).toEqual(["2025-10", "2026-09"]);
    expect(r.infos.some((i) => i.message.includes("백만원"))).toBe(true);
    expect(r.warnings).toEqual([]);
  });

  it("JSON도 144행으로 통과하고 CSV와 모든 값이 같다", () => {
    const j = importText("현장공정기성.json", readData("현장공정기성.json"));
    expect(j.errors).toEqual([]);
    expect(j.records).toHaveLength(144);
    const c = importText(CSV_NAME, readData(CSV_NAME));
    expect(j.records).toEqual(c.records);
  });

  it("CSV 다음 JSON을 가져와도 144행(이어 붙이지 않고 전체 교체)", () => {
    const first = buildDataset(loadDataset("csv").records);
    expect(first.records).toHaveLength(144);
    const second = buildDataset(loadDataset("json").records); // 적용 = 통째로 교체
    expect(second.records).toHaveLength(144);
    expect(second.byKey.size).toBe(144);
  });
});

describe("고의 오류 파일 3종은 모두 거부", () => {
  it("오류_공정률101.csv — 134행 actualProgress 범위 오류", () => {
    const r = importText("오류_공정률101.csv", readData("검증용_오류데이터", "오류_공정률101.csv"));
    expect(r.ok).toBe(false);
    expect(r.records).toEqual([]);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({ location: "134행", field: "actualProgress" });
    expect(r.errors[0].message).toContain("0~100");
  });

  it("오류_공정률빈값.csv — 134행 actualProgress 비어 있음(0으로 바꾸지 않음)", () => {
    const r = importText("오류_공정률빈값.csv", readData("검증용_오류데이터", "오류_공정률빈값.csv"));
    expect(r.ok).toBe(false);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({ location: "134행", field: "actualProgress" });
    expect(r.errors[0].message).toContain("비어");
  });

  it("오류_중복키.csv — 146행 중복", () => {
    const r = importText("오류_중복키.csv", readData("검증용_오류데이터", "오류_중복키.csv"));
    expect(r.ok).toBe(false);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].location).toBe("146행");
    expect(r.errors[0].message).toContain("2026-09 / D");
    expect(r.errors[0].message).toContain("중복");
  });
});

describe("검사 규칙", () => {
  const lines = csvLines();
  const idxSepD = lines.findIndex((l) => l.startsWith("2026-09,D,")); // 머리글이 0번 줄

  it("CSV·JSON이 아닌 확장자는 거부", () => {
    const r = validateImport("자료.xlsx", 100, "a,b");
    expect(r.ok).toBe(false);
    expect(r.errors[0].message).toContain("CSV 또는 JSON");
  });

  it("25MB를 넘으면 거부", () => {
    const r = validateImport("큰파일.csv", 26 * 1024 * 1024, "");
    expect(r.ok).toBe(false);
    expect(r.errors[0].message).toContain("25MB");
  });

  it("읽을 수 없는 JSON은 거부", () => {
    const r = validateImport("깨짐.json", 10, "{ not json");
    expect(r.ok).toBe(false);
    expect(r.errors[0].message).toContain("읽을 수 없습니다");
  });

  it("필수 열이 빠지면 열 이름을 알려 거부", () => {
    const r = importText(
      CSV_NAME,
      csvWith((ls) => ls.map((l) => l.split(",").slice(0, 14).join(","))), // 마지막 열(actionPlan) 제거
    );
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.field === "actionPlan")).toBe(true);
  });

  it("추가 열은 무시하고 안내한다", () => {
    const r = importText(
      CSV_NAME,
      csvWith((ls) => ls.map((l, i) => `${l},${i === 0 ? "기성률(%)" : "1.0"}`)),
    );
    expect(r.ok).toBe(true);
    expect(r.infos.some((i) => i.message.includes("추가 열 1개"))).toBe(true);
  });

  it("월·현장 ID·지역·유형·[가상] 표시 오류", () => {
    const cases: [number, string, string][] = [
      [COL.month, "2026-13", "month"],
      [COL.month, "2024-01", "month"],
      [COL.siteId, "Z", "siteId"],
      [COL.region, "서울", "region"],
      [COL.projectType, "인프라", "projectType"],
      [COL.siteName, "김포 공동주택 신축", "siteName"],
    ];
    for (const [col, value, field] of cases) {
      const r = importText(
        CSV_NAME,
        csvWith((ls) => ls.map((l, i) => (i === idxSepD ? setCell(l, col, value) : l))),
      );
      expect(r.ok, `${field}=${value}`).toBe(false);
      expect(r.errors.some((e) => e.field === field), `${field}=${value}`).toBe(true);
    }
  });

  it("숫자 오류: 계약금액 0, 소수 셋째 자리 초과, 숫자 아님, 누적기성액이 계약금액 초과", () => {
    const cases: [number, string, string, string][] = [
      [COL.contractAmount, "0", "contractAmount", "0보다"],
      [COL.actualProgress, "75.8123", "actualProgress", "소수 셋째"],
      [COL.plannedProgress, "abc", "plannedProgress", "숫자가 아닙니다"],
      [COL.cumulativeEarned, "999999", "cumulativeEarned", "계약금액"],
    ];
    for (const [col, value, field, text] of cases) {
      const r = importText(
        CSV_NAME,
        csvWith((ls) => ls.map((l, i) => (i === idxSepD ? setCell(l, col, value) : l))),
      );
      expect(r.ok, `${field}=${value}`).toBe(false);
      const hit = r.errors.find((e) => e.field === field);
      expect(hit?.message, `${field}=${value}`).toContain(text);
      expect(hit?.location).toBe(`${idxSepD + 1}행`);
    }
  });

  it("착공일이 계약상 준공일보다 늦으면 거부, 날짜 형식 오류도 거부", () => {
    const late = importText(
      CSV_NAME,
      csvWith((ls) => ls.map((l, i) => (i === idxSepD ? setCell(l, COL.startDate, "2030-01-01") : l))),
    );
    expect(late.ok).toBe(false);
    expect(late.errors.some((e) => e.message.includes("착공일"))).toBe(true);
    const bad = importText(
      CSV_NAME,
      csvWith((ls) => ls.map((l, i) => (i === idxSepD ? setCell(l, COL.startDate, "2024-02-30") : l))),
    );
    expect(bad.ok).toBe(false);
    expect(bad.errors.some((e) => e.field === "startDate")).toBe(true);
  });

  it("같은 현장의 계약금액이 행마다 다르면 거부", () => {
    const r = importText(
      CSV_NAME,
      csvWith((ls) => ls.map((l, i) => (i === idxSepD ? setCell(l, COL.contractAmount, "72601") : l))),
    );
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.field === "contractAmount" && e.message.includes("첫 행"))).toBe(true);
  });

  it("누적기성액이 전달보다 줄면 거부", () => {
    // D의 2026-09 누적기성액을 2026-08(47044.8)보다 작게
    const r = importText(
      CSV_NAME,
      csvWith((ls) => ls.map((l, i) => (i === idxSepD ? setCell(l, COL.cumulativeEarned, "40000") : l))),
    );
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.field === "cumulativeEarned" && e.message.includes("줄었습니다"))).toBe(true);
  });

  it("행이 빠지면(143행) 거부하지 않고 경고한다", () => {
    const r = importText(CSV_NAME, csvWith((ls) => ls.filter((_, i) => i !== idxSepD)));
    expect(r.ok).toBe(true);
    expect(r.records).toHaveLength(143);
    expect(r.warnings.some((w) => w.message.includes("1개 월·현장 조합이 없어"))).toBe(true);
  });

  it("데이터 행이 0개면 거부", () => {
    const r = importText(CSV_NAME, csvWith((ls) => [ls[0]]));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.message.includes("데이터 행이 없습니다"))).toBe(true);
  });

  it("오류가 여러 개여도 모두 모은다(첫 오류에서 멈추지 않음)", () => {
    const r = importText(
      CSV_NAME,
      csvWith((ls) =>
        ls.map((l, i) => (i === idxSepD ? setCell(setCell(l, COL.actualProgress, "101"), COL.region, "서울") : l)),
      ),
    );
    expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });
});

describe("JSON metadata 검사", () => {
  const base = JSON.parse(readData("현장공정기성.json")) as {
    metadata: Record<string, unknown>;
    records: unknown[];
  };
  const run = (metadata: Record<string, unknown> | undefined) =>
    importText("x.json", JSON.stringify({ ...(metadata === undefined ? {} : { metadata }), records: base.records }));

  it("schemaVersion·moneyUnit·progressUnit·requiredFields가 다르면 거부", () => {
    expect(run({ ...base.metadata, schemaVersion: "1.0" }).errors.some((e) => e.field === "schemaVersion")).toBe(true);
    expect(run({ ...base.metadata, moneyUnit: "원" }).errors.some((e) => e.field === "moneyUnit")).toBe(true);
    expect(run({ ...base.metadata, progressUnit: "ratio" }).errors.some((e) => e.field === "progressUnit")).toBe(true);
    expect(run({ ...base.metadata, requiredFields: ["month"] }).errors.some((e) => e.field === "requiredFields")).toBe(true);
  });

  it("metadata가 없으면 거부", () => {
    const r = run(undefined);
    expect(r.ok).toBe(false);
    expect(r.errors[0].location).toContain("metadata");
  });

  it("JSON 오류 위치는 'N번째 기록'", () => {
    const records = structuredClone(base.records) as Record<string, unknown>[];
    records[132].actualProgress = 101;
    const r = importText("x.json", JSON.stringify({ metadata: base.metadata, records }));
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatchObject({ location: "133번째 기록", field: "actualProgress" });
  });
});
