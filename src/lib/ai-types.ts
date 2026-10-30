// 브라우저와 서버(/api/ask)가 함께 쓰는 AI 요청·응답 모양

export const AI_QUESTION_MAX = 500;
export const AI_BODY_MAX_BYTES = 256 * 1024;

/** AI가 참고해도 되는 기록 필드 이름 */
export const CITABLE_FIELDS = [
  "currentWork",
  "issueCategory",
  "issueSummary",
  "actionPlan",
  "contractEndDate",
  "startDate",
] as const;
export type CitableField = (typeof CITABLE_FIELDS)[number];

export interface AiScope {
  month: string;
  region: string;
  projectType: string;
  siteId: string;
  siteIds: string[];
  monthRange: [string, string];
  moneyUnit: "백만원";
  progressUnit: "%";
}

/** 선택 월의 원문 기록(파일에 적힌 그대로의 문장) */
export interface AiRecord {
  month: string;
  siteId: string;
  siteName: string;
  region: string;
  projectType: string;
  startDate: string;
  contractEndDate: string;
  currentWork: string;
  issueCategory: string;
  issueSummary: string;
  actionPlan: string;
}

/** 프로그램이 계산한 지표. 계산 불가는 null */
export interface AiSiteMetrics {
  month: string;
  siteId: string;
  contractAmount: number;
  plannedProgress: number;
  actualProgress: number;
  progressGap: number;
  cumulativeEarned: number;
  earnedRate: number;
  monthlyEarned: number | null;
  status: "정상" | "주의" | "점검";
}

export interface AiTrendPoint {
  month: string;
  siteCount: number;
  earnedRate: number | null;
  plannedProgress: number | null;
  actualProgress: number | null;
  progressGap: number | null;
  monthlyEarned: number | null;
  normal: number;
  caution: number;
  inspect: number;
}

export interface AiRequest {
  question: string;
  scope: AiScope;
  /** 선택 월의 원문 기록 */
  records: AiRecord[];
  /** 프로그램이 계산한 값(선택 월) */
  siteMetrics: AiSiteMetrics[];
  overall: AiTrendPoint;
  /** 시작 월~선택 월의 월별 요약 */
  trend: AiTrendPoint[];
  /** 한 현장을 골랐을 때만: 시작 월~선택 월의 원문 기록과 지표 */
  siteHistory: { record: AiRecord; metrics: AiSiteMetrics }[] | null;
}

export interface AiCitation {
  siteId: string;
  month: string;
  fields: CitableField[];
}

export interface AiAnswer {
  answer: string;
  citedSites: AiCitation[];
  notInData: boolean;
  /** 모의 응답이면 true */
  mock?: boolean;
}

export type AiErrorCode = "NO_KEY" | "RATE_LIMIT" | "TIMEOUT" | "UPSTREAM" | "BAD_REQUEST";

export type AiResponse =
  | ({ ok: true } & AiAnswer)
  | { ok: false; code: AiErrorCode };

export const AI_ERROR_TEXT: Record<AiErrorCode, string> = {
  NO_KEY: "API 키가 설정되지 않았습니다",
  RATE_LIMIT: "사용 한도를 넘었습니다",
  TIMEOUT: "시간 초과",
  UPSTREAM: "AI 서비스 연결 문제",
  BAD_REQUEST: "질문을 처리할 수 없습니다",
};
