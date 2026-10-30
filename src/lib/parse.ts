import Papa from "papaparse";
import type { SourceKind } from "./types";

export interface RawTable {
  kind: SourceKind;
  /** CSV의 머리글(JSON은 null) */
  headers: string[] | null;
  rows: Record<string, unknown>[];
  /** rows와 같은 순서의 오류 위치 표기. CSV는 "134행"(머리글이 1행), JSON은 "3번째 기록" */
  locations: string[];
  /** JSON의 metadata(CSV는 null) */
  metadata: Record<string, unknown> | null;
}

export type ParseOutcome =
  | { ok: true; table: RawTable }
  | { ok: false; message: string };

const BOM = "﻿";

export function parseCsvText(text: string): ParseOutcome {
  const body = text.startsWith(BOM) ? text.slice(1) : text;
  const result = Papa.parse<Record<string, string>>(body, {
    header: true,
    delimiter: ",",
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const quoteError = result.errors.find((e) => e.type === "Quotes");
  if (quoteError) {
    const where = typeof quoteError.row === "number" ? ` (${quoteError.row + 2}행 근처)` : "";
    return { ok: false, message: `파일을 읽을 수 없습니다. 따옴표(")가 짝이 맞지 않습니다${where}.` };
  }
  const headers = result.meta.fields ?? [];
  if (headers.length === 0) {
    return { ok: false, message: "파일을 읽을 수 없습니다. 첫 줄에 열 이름(머리글)이 없습니다." };
  }
  const rows = result.data as Record<string, unknown>[];
  return {
    ok: true,
    table: {
      kind: "csv",
      headers,
      rows,
      locations: rows.map((_, i) => `${i + 2}행`),
      metadata: null,
    },
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function parseJsonText(text: string): ParseOutcome {
  const body = text.startsWith(BOM) ? text.slice(1) : text;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { ok: false, message: "파일을 읽을 수 없습니다. JSON 형식(괄호·쉼표·따옴표)을 확인해 주세요." };
  }
  if (!isPlainObject(parsed) || !Array.isArray(parsed.records)) {
    return {
      ok: false,
      message: "JSON 정보(metadata)와 기록(records)이 있는 형식이어야 합니다.",
    };
  }
  const rows: Record<string, unknown>[] = [];
  const locations: string[] = [];
  for (let i = 0; i < parsed.records.length; i++) {
    const item: unknown = parsed.records[i];
    rows.push(isPlainObject(item) ? item : {});
    locations.push(`${i + 1}번째 기록`);
  }
  return {
    ok: true,
    table: {
      kind: "json",
      headers: null,
      rows,
      locations,
      metadata: isPlainObject(parsed.metadata) ? parsed.metadata : null,
    },
  };
}
