import { readFileSync } from "node:fs";
import path from "node:path";
import { buildDataset, type Dataset } from "@/lib/dataset";
import { milliToTenths, tenthsToPlain } from "@/lib/decimal";
import { validateImport, type ImportResult } from "@/lib/validate";

// data/ 폴더의 원본 파일은 읽기만 합니다.
const DATA_DIR = path.resolve(process.cwd(), "data");

export function readData(...parts: string[]): string {
  return readFileSync(path.join(DATA_DIR, ...parts), "utf8");
}

export function importText(fileName: string, text: string): ImportResult {
  return validateImport(fileName, Buffer.byteLength(text, "utf8"), text);
}

export function loadDataset(kind: "csv" | "json" = "csv"): Dataset {
  const name = kind === "csv" ? "현장공정기성.csv" : "현장공정기성.json";
  const result = importText(name, readData(name));
  if (!result.ok) throw new Error(`정상 원본이 거부됨: ${JSON.stringify(result.errors.slice(0, 3))}`);
  return buildDataset(result.records);
}

export const CSV_NAME = "현장공정기성.csv";

/** CSV 원본을 줄 단위로 나눕니다(머리글 포함, 끝의 빈 줄 제외) */
export function csvLines(): string[] {
  const lines = readData(CSV_NAME).replace(/^﻿/, "").split("\r\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** 1000배 정수 금액을 "63763.2" 같은 소수 첫째 자리 문자로 */
export function m1(milli: bigint | null): string | null {
  return milli === null ? null : tenthsToPlain(milliToTenths(milli));
}

export function t1(tenths: bigint | null): string | null {
  return tenths === null ? null : tenthsToPlain(tenths);
}
