// 원본 15개 열 이름은 CSV 헤더·JSON 키와 같습니다.

export const REQUIRED_FIELDS = [
  "month",
  "siteId",
  "siteName",
  "contractAmount",
  "plannedProgress",
  "actualProgress",
  "cumulativeEarned",
  "region",
  "projectType",
  "startDate",
  "contractEndDate",
  "currentWork",
  "issueCategory",
  "issueSummary",
  "actionPlan",
] as const;

export type FieldName = (typeof REQUIRED_FIELDS)[number];

export const REGIONS = ["인천", "경기", "충남", "충북", "세종", "강원", "대전"] as const;
export const PROJECT_TYPES = ["공동주택", "물류시설", "업무시설", "상업시설", "생산시설"] as const;

export const MONTH_MIN = "2025-10";
export const MONTH_MAX = "2026-09";
export const DEFAULT_MONTH = "2026-09";
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** 검사를 통과한 한 행. 금액·공정률은 1000배 정수(BigInt)입니다. */
export interface SiteRecord {
  month: string;
  siteId: string;
  siteName: string;
  contractAmount: bigint;
  plannedProgress: bigint;
  actualProgress: bigint;
  cumulativeEarned: bigint;
  region: string;
  projectType: string;
  startDate: string;
  contractEndDate: string;
  currentWork: string;
  issueCategory: string;
  issueSummary: string;
  actionPlan: string;
}

export interface SiteInfo {
  siteId: string;
  siteName: string;
  region: string;
  projectType: string;
  contractAmount: bigint;
  startDate: string;
  contractEndDate: string;
}

export type Status = "normal" | "caution" | "inspect";

export const STATUS_LABEL: Record<Status, string> = {
  normal: "정상",
  caution: "주의",
  inspect: "점검",
};

export const ALL = "ALL";

export interface Filters {
  month: string;
  region: string; // 지역 이름 또는 ALL
  projectType: string; // 공사 유형 또는 ALL
  siteId: string; // 현장 ID 또는 ALL
}

export type SourceKind = "csv" | "json";

export interface ValidationIssue {
  severity: "error" | "warning" | "info";
  /** 예: "134행", "3번째 기록", "파일" */
  location: string;
  field?: string;
  message: string;
}

export interface ImportSummary {
  source: SourceKind;
  rowCount: number;
  columnCount: number;
  monthRange: [string, string] | null;
  siteCount: number;
}
