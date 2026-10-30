import { AI_BODY_MAX_BYTES, type AiErrorCode, type AiResponse } from "../ai-types";
import type { AiRequest } from "../ai-types";
import { parseAiRequest, parseModelAnswer } from "./ai-request";

// 서버 전용: /api/ask의 처리 흐름. Gemini 호출 함수를 밖에서 넣어 주므로 자동 검사에서 가짜로 바꿀 수 있습니다.

export interface AskDeps {
  /** GEMINI_API_KEY 값. 없으면 undefined (이 값은 절대 응답·로그에 쓰지 않습니다) */
  apiKey: string | undefined;
  /** AI_MOCK=1 이면 true */
  mock: boolean;
  call: (req: AiRequest, apiKey: string) => Promise<string | undefined>;
}

export interface AskResult {
  status: number;
  body: AiResponse;
}

const STATUS_BY_CODE: Record<AiErrorCode, number> = {
  BAD_REQUEST: 400,
  NO_KEY: 503,
  RATE_LIMIT: 429,
  TIMEOUT: 504,
  UPSTREAM: 502,
};

function failure(code: AiErrorCode): AskResult {
  return { status: STATUS_BY_CODE[code], body: { ok: false, code } };
}

/** 오류 객체에서 원인 종류만 뽑습니다. 메시지 원문(키·질문이 섞일 수 있음)은 쓰지 않습니다. */
export function classifyError(e: unknown): AiErrorCode {
  if (e instanceof Error && e.constructor.name === "UpstreamTimeout") return "TIMEOUT";
  const status =
    typeof e === "object" && e !== null && "status" in e ? Number((e as { status: unknown }).status) : NaN;
  if (status === 429) return "RATE_LIMIT";
  const message = e instanceof Error ? e.message : "";
  if (/RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(message)) return "RATE_LIMIT";
  return "UPSTREAM";
}

/** 모의 응답: 키 없이 화면과 검사를 확인하는 용도입니다. 반드시 mock: true를 붙입니다. */
export function buildMockAnswer(req: AiRequest) {
  const asksMissing = /준공일|미수금|수금|청구|기상|날씨/.test(req.question);
  const first = req.records[0];
  if (asksMissing || !first) {
    return {
      answer:
        "[모의 응답] 실제 준공일과 미수금은 자료에 없습니다. 자료에 있는 것은 계약상 준공일(예정일)뿐이며 실제 완료일이 아닙니다.",
      citedSites: first ? [{ siteId: first.siteId, month: first.month, fields: ["contractEndDate" as const] }] : [],
      notInData: true,
      mock: true as const,
    };
  }
  const metrics = req.siteMetrics.find((m) => m.siteId === first.siteId);
  const gap = metrics ? `공정차이 ${metrics.progressGap}pp(${metrics.status})` : "";
  return {
    answer: `[모의 응답] ${first.month} ${first.siteId}: 기록된 상황은 "${first.issueSummary}"이고, 계획된 대응은 "${first.actionPlan}"입니다. ${gap}`,
    citedSites: [{ siteId: first.siteId, month: first.month, fields: ["issueSummary" as const, "actionPlan" as const] }],
    notInData: false,
    mock: true as const,
  };
}

export async function handleAsk(bodyText: string, deps: AskDeps): Promise<AskResult> {
  if (Buffer.byteLength(bodyText, "utf8") > AI_BODY_MAX_BYTES) return failure("BAD_REQUEST");
  let raw: unknown;
  try {
    raw = JSON.parse(bodyText);
  } catch {
    return failure("BAD_REQUEST");
  }
  const req = parseAiRequest(raw);
  if (!req) return failure("BAD_REQUEST");

  if (deps.mock) return { status: 200, body: { ok: true, ...buildMockAnswer(req) } };
  if (!deps.apiKey) return failure("NO_KEY");

  let text: string | undefined;
  try {
    text = await deps.call(req, deps.apiKey);
  } catch (e) {
    const code = classifyError(e);
    // 원인 종류와 상태 번호만 기록합니다(키·질문·기록 내용은 기록하지 않음).
    const status = typeof e === "object" && e !== null && "status" in e ? String((e as { status: unknown }).status) : "-";
    console.error(`[ask] Gemini 호출 실패: ${code} (status ${status})`);
    return failure(code);
  }
  const answer = parseModelAnswer(text, req);
  if (!answer) {
    console.error("[ask] Gemini 응답 모양이 올바르지 않습니다");
    return failure("UPSTREAM");
  }
  return { status: 200, body: { ok: true, ...answer } };
}
