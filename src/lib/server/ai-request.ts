import {
  AI_QUESTION_MAX,
  CITABLE_FIELDS,
  type AiAnswer,
  type AiRequest,
  type CitableField,
} from "../ai-types";

// 서버 전용: 브라우저가 보낸 요청을 검사하고, Gemini 답변의 모양을 확인합니다. (API 키는 여기서 다루지 않습니다.)

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_ROWS = 12;
const MAX_TEXT = 1000;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isShortString(v: unknown): v is string {
  return typeof v === "string" && v.length <= MAX_TEXT;
}

function isArrayWithin(v: unknown, max: number): v is unknown[] {
  return Array.isArray(v) && v.length <= max;
}

const RECORD_STRING_KEYS = [
  "month",
  "siteId",
  "siteName",
  "region",
  "projectType",
  "startDate",
  "contractEndDate",
  "currentWork",
  "issueCategory",
  "issueSummary",
  "actionPlan",
] as const;

function isAiRecord(v: unknown): boolean {
  return isObject(v) && RECORD_STRING_KEYS.every((k) => isShortString(v[k]));
}

function isNumberOrNull(v: unknown): boolean {
  return v === null || (typeof v === "number" && Number.isFinite(v));
}

function isAiMetrics(v: unknown): boolean {
  if (!isObject(v)) return false;
  return (
    isShortString(v.month) &&
    isShortString(v.siteId) &&
    ["contractAmount", "plannedProgress", "actualProgress", "progressGap", "cumulativeEarned", "earnedRate"].every(
      (k) => typeof v[k] === "number" && Number.isFinite(v[k] as number),
    ) &&
    isNumberOrNull(v.monthlyEarned) &&
    ["정상", "주의", "점검"].includes(v.status as string)
  );
}

function isTrendPoint(v: unknown): boolean {
  if (!isObject(v)) return false;
  return (
    isShortString(v.month) &&
    typeof v.siteCount === "number" &&
    ["earnedRate", "plannedProgress", "actualProgress", "progressGap", "monthlyEarned"].every((k) =>
      isNumberOrNull(v[k]),
    ) &&
    ["normal", "caution", "inspect"].every((k) => typeof v[k] === "number")
  );
}

/** 모양이 맞지 않으면 null (BAD_REQUEST로 거부) */
export function parseAiRequest(raw: unknown): AiRequest | null {
  if (!isObject(raw)) return null;
  const { question, scope, records, siteMetrics, overall, trend, siteHistory } = raw;
  if (typeof question !== "string") return null;
  const trimmed = question.trim();
  if (trimmed.length < 1 || trimmed.length > AI_QUESTION_MAX) return null;

  if (!isObject(scope)) return null;
  if (!isShortString(scope.month) || !MONTH_PATTERN.test(scope.month)) return null;
  if (!isShortString(scope.region) || !isShortString(scope.projectType) || !isShortString(scope.siteId)) return null;
  if (!isArrayWithin(scope.siteIds, MAX_ROWS) || !scope.siteIds.every(isShortString)) return null;
  if (
    !Array.isArray(scope.monthRange) ||
    scope.monthRange.length !== 2 ||
    !scope.monthRange.every((m) => typeof m === "string" && MONTH_PATTERN.test(m))
  ) {
    return null;
  }

  if (!isArrayWithin(records, MAX_ROWS) || !records.every(isAiRecord)) return null;
  if (!isArrayWithin(siteMetrics, MAX_ROWS) || !siteMetrics.every(isAiMetrics)) return null;
  if (!isTrendPoint(overall)) return null;
  if (!isArrayWithin(trend, MAX_ROWS) || !trend.every(isTrendPoint)) return null;
  if (siteHistory !== null) {
    if (!isArrayWithin(siteHistory, MAX_ROWS)) return null;
    for (const h of siteHistory) {
      if (!isObject(h) || !isAiRecord(h.record) || !isAiMetrics(h.metrics)) return null;
    }
  }

  return {
    question: trimmed,
    scope: scope as unknown as AiRequest["scope"],
    records: records as unknown as AiRequest["records"],
    siteMetrics: siteMetrics as unknown as AiRequest["siteMetrics"],
    overall: overall as unknown as AiRequest["overall"],
    trend: trend as unknown as AiRequest["trend"],
    siteHistory: siteHistory as unknown as AiRequest["siteHistory"],
  };
}

/** Gemini가 돌려준 글을 확인합니다. 모양이 다르면 null. 보낸 자료에 없는 현장·월 인용은 버립니다. */
export function parseModelAnswer(text: string | undefined, req: AiRequest): AiAnswer | null {
  if (!text) return null;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(data) || typeof data.answer !== "string" || data.answer.trim() === "") return null;

  const allowedSites = new Set(req.scope.siteIds);
  const [firstMonth, lastMonth] = req.scope.monthRange;
  const citations: AiAnswer["citedSites"] = [];
  if (Array.isArray(data.citedSites)) {
    for (const c of data.citedSites) {
      if (!isObject(c) || typeof c.siteId !== "string" || typeof c.month !== "string") continue;
      if (!allowedSites.has(c.siteId)) continue;
      if (c.month < firstMonth || c.month > lastMonth) continue;
      const fields = Array.isArray(c.fields)
        ? (c.fields.filter((f): f is CitableField => (CITABLE_FIELDS as readonly string[]).includes(f as string)) as CitableField[])
        : [];
      citations.push({ siteId: c.siteId, month: c.month, fields });
    }
  }
  return {
    answer: data.answer.trim(),
    citedSites: citations,
    notInData: data.notInData === true,
  };
}
