import { monthEndDate } from "./dataset";
import { parseDecimal } from "./decimal";
import { parseCsvText, parseJsonText, type RawTable } from "./parse";
import {
  MAX_FILE_BYTES,
  MONTH_MAX,
  MONTH_MIN,
  PROJECT_TYPES,
  REGIONS,
  REQUIRED_FIELDS,
  type FieldName,
  type ImportSummary,
  type SiteRecord,
  type ValidationIssue,
} from "./types";

export interface ImportResult {
  /** 오류가 하나도 없을 때만 true. 이때만 records를 적용할 수 있습니다. */
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  infos: ValidationIssue[];
  records: SiteRecord[];
  summary: ImportSummary | null;
}

const SITE_ID_PATTERN = /^[A-L]$/;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(text: string): boolean {
  if (!DATE_PATTERN.test(text)) return false;
  const [y, m, d] = text.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

type Cell = { kind: "ok"; text: string } | { kind: "empty" } | { kind: "bad" };

function readCell(value: unknown): Cell {
  if (value === undefined || value === null) return { kind: "empty" };
  if (typeof value === "string") {
    const t = value.trim();
    return t === "" ? { kind: "empty" } : { kind: "ok", text: t };
  }
  if (typeof value === "number" && Number.isFinite(value)) return { kind: "ok", text: String(value) };
  return { kind: "bad" };
}

function formatMilli(milli: bigint): string {
  const negative = milli < 0n;
  const abs = negative ? -milli : milli;
  const frac = (abs % 1000n).toString().padStart(3, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${abs / 1000n}${frac ? "." + frac : ""}`;
}

interface Candidate {
  record: SiteRecord;
  location: string;
}

const NUMERIC_FIELDS: FieldName[] = [
  "contractAmount",
  "plannedProgress",
  "actualProgress",
  "cumulativeEarned",
];

const SITE_CONSTANT_FIELDS: { field: keyof SiteRecord & FieldName; label: string }[] = [
  { field: "siteName", label: "siteName" },
  { field: "region", label: "region" },
  { field: "projectType", label: "projectType" },
  { field: "contractAmount", label: "contractAmount" },
  { field: "startDate", label: "startDate" },
  { field: "contractEndDate", label: "contractEndDate" },
];

/** 행 하나를 읽어 SiteRecord로 만듭니다. 문제가 있으면 errors에 쌓고 null을 돌려줍니다. */
function readRow(
  raw: Record<string, unknown>,
  location: string,
  errors: ValidationIssue[],
): SiteRecord | null {
  const before = errors.length;
  const err = (field: FieldName, message: string) =>
    errors.push({ severity: "error", location, field, message });

  const text: Partial<Record<FieldName, string>> = {};
  for (const field of REQUIRED_FIELDS) {
    const cell = readCell(raw[field]);
    if (cell.kind === "empty") err(field, "비어 있습니다.");
    else if (cell.kind === "bad") err(field, "올바른 형식의 값이 아닙니다.");
    else text[field] = cell.text;
  }

  const num: Partial<Record<FieldName, bigint>> = {};
  for (const field of NUMERIC_FIELDS) {
    const t = text[field];
    if (t === undefined) continue;
    const parsed = parseDecimal(t);
    if (!parsed.ok) {
      err(
        field,
        parsed.reason === "decimals"
          ? "소수 셋째 자리까지만 입력할 수 있습니다."
          : `숫자가 아닙니다: "${t}"`,
      );
    } else {
      num[field] = parsed.value;
    }
  }

  const contract = num.contractAmount;
  if (contract !== undefined && contract <= 0n) err("contractAmount", "0보다 커야 합니다.");
  for (const field of ["plannedProgress", "actualProgress"] as const) {
    const v = num[field];
    if (v !== undefined && (v < 0n || v > 100000n)) {
      err(field, `${formatMilli(v)}은(는) 0~100 범위를 벗어났습니다.`);
    }
  }
  const earned = num.cumulativeEarned;
  if (earned !== undefined) {
    if (earned < 0n) err("cumulativeEarned", "0 이상이어야 합니다.");
    else if (contract !== undefined && contract > 0n && earned > contract) {
      err("cumulativeEarned", `계약금액(${formatMilli(contract)})을 넘을 수 없습니다.`);
    }
  }

  const month = text.month;
  if (month !== undefined) {
    if (!MONTH_PATTERN.test(month)) err("month", `${month}은(는) 올바른 월(YYYY-MM)이 아닙니다.`);
    else if (month < MONTH_MIN || month > MONTH_MAX) {
      err("month", `${month}은(는) ${MONTH_MIN}~${MONTH_MAX} 범위를 벗어났습니다.`);
    }
  }
  if (text.siteId !== undefined && !SITE_ID_PATTERN.test(text.siteId)) {
    err("siteId", `${text.siteId}은(는) 현장 ID(A~L)가 아닙니다.`);
  }
  if (text.siteName !== undefined && !text.siteName.startsWith("[가상]")) {
    err("siteName", "현장명에 [가상] 표시가 없습니다.");
  }
  if (text.region !== undefined && !(REGIONS as readonly string[]).includes(text.region)) {
    err("region", `${text.region}은(는) 허용된 지역(${REGIONS.join("·")})이 아닙니다.`);
  }
  if (text.projectType !== undefined && !(PROJECT_TYPES as readonly string[]).includes(text.projectType)) {
    err("projectType", `${text.projectType}은(는) 허용된 공사 유형(${PROJECT_TYPES.join("·")})이 아닙니다.`);
  }

  let startOk = false;
  let endOk = false;
  if (text.startDate !== undefined) {
    if (isValidDate(text.startDate)) startOk = true;
    else err("startDate", `${text.startDate}은(는) 올바른 날짜(YYYY-MM-DD)가 아닙니다.`);
  }
  if (text.contractEndDate !== undefined) {
    if (isValidDate(text.contractEndDate)) endOk = true;
    else err("contractEndDate", `${text.contractEndDate}은(는) 올바른 날짜(YYYY-MM-DD)가 아닙니다.`);
  }
  if (startOk && endOk && text.startDate! >= text.contractEndDate!) {
    err("startDate", "착공일이 계약상 준공일보다 늦거나 같습니다.");
  }
  if (startOk && month !== undefined && MONTH_PATTERN.test(month) && monthEndDate(month) < text.startDate!) {
    err("month", `${month}은(는) 착공일(${text.startDate})보다 이른 월입니다.`);
  }

  if (errors.length > before) return null;
  return {
    month: text.month!,
    siteId: text.siteId!,
    siteName: text.siteName!,
    contractAmount: num.contractAmount!,
    plannedProgress: num.plannedProgress!,
    actualProgress: num.actualProgress!,
    cumulativeEarned: num.cumulativeEarned!,
    region: text.region!,
    projectType: text.projectType!,
    startDate: text.startDate!,
    contractEndDate: text.contractEndDate!,
    currentWork: text.currentWork!,
    issueCategory: text.issueCategory!,
    issueSummary: text.issueSummary!,
    actionPlan: text.actionPlan!,
  };
}

function checkMetadata(metadata: Record<string, unknown> | null, errors: ValidationIssue[]) {
  const err = (field: string, message: string) =>
    errors.push({ severity: "error", location: "JSON 정보(metadata)", field, message });
  if (metadata === null) {
    err("metadata", "JSON 정보(metadata)가 없습니다.");
    return;
  }
  if (metadata.schemaVersion !== "2.0") err("schemaVersion", "schemaVersion이 2.0이 아닙니다.");
  if (metadata.moneyUnit !== "백만원") err("moneyUnit", "moneyUnit이 백만원이 아닙니다.");
  if (metadata.progressUnit !== "percent_0_100") err("progressUnit", "progressUnit이 percent_0_100이 아닙니다.");
  const fields = metadata.requiredFields;
  const sameFields =
    Array.isArray(fields) &&
    fields.length === REQUIRED_FIELDS.length &&
    REQUIRED_FIELDS.every((f) => fields.includes(f));
  if (!sameFields) err("requiredFields", "requiredFields가 필수 15개 열과 같지 않습니다.");
}

/** 월별 누락 계산: 현장 수 × (첫 달~마지막 달) − 실제 행 수 */
function countMissing(records: SiteRecord[]): number {
  const sites = new Set(records.map((r) => r.siteId));
  const months = records.map((r) => r.month).sort();
  if (months.length === 0) return 0;
  const [firstY, firstM] = months[0].split("-").map(Number);
  const [lastY, lastM] = months[months.length - 1].split("-").map(Number);
  const monthCount = (lastY - firstY) * 12 + (lastM - firstM) + 1;
  return Math.max(0, sites.size * monthCount - records.length);
}

function validateTable(table: RawTable): ImportResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const infos: ValidationIssue[] = [];

  if (table.kind === "json") checkMetadata(table.metadata, errors);
  if (table.kind === "csv") {
    infos.push({
      severity: "info",
      location: "파일",
      message: "CSV에는 단위 정보가 없어 설명서 기준(금액 백만원, 공정률 %)으로 읽습니다.",
    });
    const headers = table.headers ?? [];
    for (const field of REQUIRED_FIELDS) {
      if (!headers.includes(field)) {
        errors.push({ severity: "error", location: "파일", field, message: `필수 열 ${field}이(가) 없습니다.` });
      }
    }
    const extra = headers.filter((h) => !(REQUIRED_FIELDS as readonly string[]).includes(h));
    if (extra.length > 0) {
      infos.push({ severity: "info", location: "파일", message: `추가 열 ${extra.length}개는 사용하지 않습니다.` });
    }
  } else {
    const extraKeys = new Set<string>();
    for (const row of table.rows) {
      for (const key of Object.keys(row)) {
        if (!(REQUIRED_FIELDS as readonly string[]).includes(key)) extraKeys.add(key);
      }
    }
    if (extraKeys.size > 0) {
      infos.push({ severity: "info", location: "파일", message: `추가 항목 ${extraKeys.size}개는 사용하지 않습니다.` });
    }
  }

  const headerMissing = errors.some((e) => e.location === "파일" && e.field !== undefined);
  if (table.rows.length === 0) {
    errors.push({ severity: "error", location: "파일", message: "데이터 행이 없습니다." });
  }

  const candidates: Candidate[] = [];
  if (!headerMissing) {
    table.rows.forEach((raw, i) => {
      const record = readRow(raw, table.locations[i], errors);
      if (record) candidates.push({ record, location: table.locations[i] });
    });
  }

  // 같은 월·현장 중복, 현장 정보 일관성
  const seen = new Map<string, string>();
  const firstBySite = new Map<string, Candidate>();
  for (const c of candidates) {
    const key = `${c.record.month}|${c.record.siteId}`;
    const prevLocation = seen.get(key);
    if (prevLocation) {
      errors.push({
        severity: "error",
        location: c.location,
        message: `${c.record.month} / ${c.record.siteId}이(가) ${prevLocation}에 이미 있습니다(중복).`,
      });
    } else {
      seen.set(key, c.location);
    }
    const first = firstBySite.get(c.record.siteId);
    if (!first) {
      firstBySite.set(c.record.siteId, c);
      continue;
    }
    for (const { field, label } of SITE_CONSTANT_FIELDS) {
      if (c.record[field] !== first.record[field]) {
        errors.push({
          severity: "error",
          location: c.location,
          field: label,
          message: `${c.record.siteId} 현장의 ${label} 값이 첫 행(${first.location})과 다릅니다.`,
        });
      }
    }
  }

  // 누적 공정률·누적기성액은 줄어들 수 없음
  const bySite = new Map<string, Candidate[]>();
  for (const c of candidates) {
    const list = bySite.get(c.record.siteId) ?? [];
    list.push(c);
    bySite.set(c.record.siteId, list);
  }
  for (const [siteId, list] of bySite) {
    const sorted = [...list].sort((a, b) => a.record.month.localeCompare(b.record.month));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1].record;
      const cur = sorted[i].record;
      if (cur.month === prev.month) continue; // 중복은 위에서 이미 보고
      const checks: [string, bigint, bigint, string][] = [
        ["plannedProgress", cur.plannedProgress, prev.plannedProgress, "누적 계획공정률"],
        ["actualProgress", cur.actualProgress, prev.actualProgress, "누적 실제공정률"],
        ["cumulativeEarned", cur.cumulativeEarned, prev.cumulativeEarned, "누적기성액"],
      ];
      for (const [field, now, before, label] of checks) {
        if (now < before) {
          errors.push({
            severity: "error",
            location: sorted[i].location,
            field,
            message: `${siteId} 현장 ${cur.month}: ${label}이(가) 전달보다 줄었습니다.`,
          });
        }
      }
    }
  }

  const records = candidates.map((c) => c.record);
  const ok = errors.length === 0;
  if (ok) {
    const missing = countMissing(records);
    if (missing > 0) {
      warnings.push({
        severity: "warning",
        location: "파일",
        message: `${missing}개 월·현장 조합이 없어 확인 가능한 행만 집계합니다.`,
      });
    }
  }

  const months = records.map((r) => r.month).sort();
  const columnCount =
    table.kind === "csv"
      ? (table.headers ?? []).filter((h) => (REQUIRED_FIELDS as readonly string[]).includes(h)).length
      : REQUIRED_FIELDS.length;
  const summary: ImportSummary = {
    source: table.kind,
    rowCount: table.rows.length,
    columnCount,
    monthRange: months.length > 0 ? [months[0], months[months.length - 1]] : null,
    siteCount: new Set(records.map((r) => r.siteId)).size,
  };
  return { ok, errors, warnings, infos, records: ok ? records : [], summary };
}

function fail(message: string, location = "파일"): ImportResult {
  return {
    ok: false,
    errors: [{ severity: "error", location, message }],
    warnings: [],
    infos: [],
    records: [],
    summary: null,
  };
}

/** 파일 이름·크기·내용을 모두 검사합니다. 오류가 있으면 ok=false이며 지금 자료는 건드리지 않습니다. */
export function validateImport(fileName: string, fileSize: number, text: string): ImportResult {
  const lower = fileName.toLowerCase();
  const isCsv = lower.endsWith(".csv");
  const isJson = lower.endsWith(".json");
  if (!isCsv && !isJson) return fail("CSV 또는 JSON 파일만 25MB 이하로 가져올 수 있습니다.");
  if (fileSize > MAX_FILE_BYTES) return fail("CSV 또는 JSON 파일만 25MB 이하로 가져올 수 있습니다.");
  const parsed = isCsv ? parseCsvText(text) : parseJsonText(text);
  if (!parsed.ok) return fail(parsed.message);
  return validateTable(parsed.table);
}
