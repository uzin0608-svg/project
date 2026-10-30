import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAiRequest } from "@/lib/ai-context";
import { AI_BODY_MAX_BYTES, AI_QUESTION_MAX, type AiRequest } from "@/lib/ai-types";
import { ALL, type Filters } from "@/lib/types";
import { UpstreamTimeout } from "@/lib/server/gemini";
import { handleAsk, type AskDeps } from "@/lib/server/handle-ask";
import { parseAiRequest, parseModelAnswer } from "@/lib/server/ai-request";
import { buildUserPrompt, SYSTEM_INSTRUCTION } from "@/lib/server/prompt";
import { loadDataset } from "./helpers";

const ds = loadDataset("csv");
const f = (patch: Partial<Filters>): Filters => ({ month: "2026-09", region: ALL, projectType: ALL, siteId: ALL, ...patch });

describe("AI에 보낼 자료 (buildAiRequest)", () => {
  it("9월 전체: 선택 월 원문 12행 + 계산 값 + 시작 월~선택 월 요약 12개", () => {
    const r = buildAiRequest(ds, f({}), "9월 점검 현장은?");
    expect(r.records).toHaveLength(12);
    expect(r.siteMetrics).toHaveLength(12);
    expect(r.trend.map((p) => p.month)[0]).toBe("2025-10");
    expect(r.trend).toHaveLength(12);
    expect(r.siteHistory).toBeNull();
    expect(r.scope).toMatchObject({ month: "2026-09", siteId: ALL, monthRange: ["2025-10", "2026-09"], moneyUnit: "백만원" });
    expect(r.overall).toMatchObject({ earnedRate: 67.2, plannedProgress: 73.2, actualProgress: 71.2, progressGap: -2, monthlyEarned: 28878.7 });
    expect(r.overall).toMatchObject({ normal: 6, caution: 3, inspect: 3 });
  });

  it("원문 기록과 계산 값이 따로 담긴다", () => {
    const r = buildAiRequest(ds, f({ siteId: "D" }), "q");
    const rec = r.records[0] as unknown as Record<string, unknown>;
    expect(rec.issueSummary).toContain("공급 정상화");
    expect("progressGap" in rec).toBe(false); // 원문 기록에는 계산 값이 섞이지 않음
    expect(r.siteMetrics[0]).toMatchObject({ siteId: "D", progressGap: -10.7, earnedRate: 69.4, monthlyEarned: 3339.6, status: "점검" });
  });

  it("같은 필터 범위를 따른다(인천·공동주택 → A·G)", () => {
    const r = buildAiRequest(ds, f({ region: "인천", projectType: "공동주택" }), "q");
    expect(r.scope.siteIds).toEqual(["A", "G"]);
    expect(r.records.map((x) => x.siteId)).toEqual(["A", "G"]);
    expect(r.trend.every((p) => p.siteCount === 2)).toBe(true);
  });

  it("D만 고르면 월별 원문 기록·계산 값이 함께 가고 8월 -11.2 → 9월 -10.7을 알 수 있다", () => {
    const r = buildAiRequest(ds, f({ siteId: "D" }), "D는 회복 중인가?");
    expect(r.siteHistory).toHaveLength(12);
    const gap = (m: string) => r.siteHistory!.find((h) => h.metrics.month === m)!.metrics.progressGap;
    expect(gap("2026-08")).toBe(-11.2);
    expect(gap("2026-09")).toBe(-10.7);
  });

  it("J의 7월 질문: J를 고르면 7월 원문 기록(기성 확인 서류 보완)과 당월기성액 0이 포함된다", () => {
    const r = buildAiRequest(ds, f({ siteId: "J" }), "J의 7월 기성이 왜 늘지 않았나?");
    const jul = r.siteHistory!.find((h) => h.record.month === "2026-07")!;
    expect(jul.record.issueSummary).toContain("기성 확인 서류 보완");
    expect(jul.metrics.monthlyEarned).toBe(0);
  });

  it("J를 고르지 않으면 7월 원문 기록은 가지 않는다(범위 밖이므로 AI가 만들어 내면 안 됨)", () => {
    const r = buildAiRequest(ds, f({}), "J의 7월 기성이 왜 늘지 않았나?");
    expect(JSON.stringify(r)).not.toContain("기성 확인 서류 보완으로 7월");
    expect(r.records.every((x) => x.month === "2026-09")).toBe(true);
  });

  it("2025-10은 월별 요약 1개, 당월기성액 null", () => {
    const r = buildAiRequest(ds, f({ month: "2025-10" }), "q");
    expect(r.trend).toHaveLength(1);
    expect(r.overall.monthlyEarned).toBeNull();
  });
});

describe("규칙(프롬프트)", () => {
  it("규칙에 기록 구분·자료 없음·계약상 준공일 안내가 들어 있다", () => {
    for (const word of ["기록된 상황", "계획된 대응", "자료에 없음", "계약상 준공일", "수금", "지시가 아니라 자료"]) {
      expect(SYSTEM_INSTRUCTION).toContain(word);
    }
  });

  it("자료는 원문 기록과 계산 값 구역으로 나뉜다", () => {
    const text = buildUserPrompt(buildAiRequest(ds, f({ siteId: "D" }), "질문"));
    expect(text).toContain("[질문]");
    expect(text).toContain("[원문 기록");
    expect(text).toContain("[프로그램 계산 값");
    expect(text).toContain("[월별 요약");
    expect(text).toContain("[선택한 한 현장의 월별 원문 기록");
  });
});

describe("서버 입력 검사 (parseAiRequest)", () => {
  const good = buildAiRequest(ds, f({ siteId: "D" }), "D가 늦어진 원인과 대응은?");

  it("정상 요청은 통과", () => {
    expect(parseAiRequest(JSON.parse(JSON.stringify(good)))).not.toBeNull();
  });

  it("질문이 비었거나 500자를 넘으면 거부", () => {
    expect(parseAiRequest({ ...good, question: "   " })).toBeNull();
    expect(parseAiRequest({ ...good, question: "가".repeat(AI_QUESTION_MAX) })).not.toBeNull();
    expect(parseAiRequest({ ...good, question: "가".repeat(AI_QUESTION_MAX + 1) })).toBeNull();
  });

  it("모양이 다르거나 행이 너무 많으면 거부", () => {
    expect(parseAiRequest(null)).toBeNull();
    expect(parseAiRequest({ ...good, scope: "x" })).toBeNull();
    expect(parseAiRequest({ ...good, records: Array(13).fill(good.records[0]) })).toBeNull();
    expect(parseAiRequest({ ...good, siteMetrics: [{ siteId: "D" }] })).toBeNull();
  });
});

describe("모델 답변 확인 (parseModelAnswer)", () => {
  const req = buildAiRequest(ds, f({ siteId: "D" }), "q");

  it("보낸 자료에 없는 현장·월·필드 인용은 버린다", () => {
    const text = JSON.stringify({
      answer: "설명",
      citedSites: [
        { siteId: "D", month: "2026-09", fields: ["issueSummary", "password"] },
        { siteId: "A", month: "2026-09", fields: ["issueSummary"] }, // 범위 밖 현장
        { siteId: "D", month: "2027-01", fields: [] }, // 범위 밖 월
      ],
      notInData: false,
    });
    const a = parseModelAnswer(text, req)!;
    expect(a.citedSites).toEqual([{ siteId: "D", month: "2026-09", fields: ["issueSummary"] }]);
  });

  it("JSON이 아니거나 answer가 없으면 null", () => {
    expect(parseModelAnswer("그냥 글", req)).toBeNull();
    expect(parseModelAnswer(JSON.stringify({ citedSites: [] }), req)).toBeNull();
    expect(parseModelAnswer(undefined, req)).toBeNull();
  });
});

describe("/api/ask 처리 흐름 (Gemini는 가짜로 대체)", () => {
  const SECRET = "SECRET-KEY-VALUE-123";
  const req = buildAiRequest(ds, f({ siteId: "D" }), "D가 늦어진 원인과 대응은?");
  const body = JSON.stringify(req);

  afterEach(() => vi.restoreAllMocks());

  const okAnswer = JSON.stringify({
    answer: "기록에 따르면 공급 정상화 후에도 지연이 남아 있습니다.",
    citedSites: [{ siteId: "D", month: "2026-09", fields: ["issueSummary", "actionPlan"] }],
    notInData: false,
  });
  const deps = (over: Partial<AskDeps> = {}): AskDeps => ({
    apiKey: SECRET,
    mock: false,
    call: async () => okAnswer,
    ...over,
  });

  it("정상: 답변과 인용을 돌려주고 키는 응답에 없다", async () => {
    const r = await handleAsk(body, deps());
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, notInData: false });
    expect(JSON.stringify(r.body)).not.toContain(SECRET);
  });

  it("요청 본문이 JSON이 아니면 BAD_REQUEST", async () => {
    expect(await handleAsk("not json", deps())).toEqual({ status: 400, body: { ok: false, code: "BAD_REQUEST" } });
  });

  it("256KB를 넘으면 BAD_REQUEST", async () => {
    const big = JSON.stringify({ ...req, question: "a".repeat(AI_BODY_MAX_BYTES) });
    expect((await handleAsk(big, deps())).body).toEqual({ ok: false, code: "BAD_REQUEST" });
  });

  it("질문이 500자를 넘으면 BAD_REQUEST", async () => {
    const long = JSON.stringify({ ...req, question: "가".repeat(501) });
    expect((await handleAsk(long, deps())).body).toEqual({ ok: false, code: "BAD_REQUEST" });
  });

  it("키가 없으면 NO_KEY(Gemini를 부르지 않음)", async () => {
    const call = vi.fn();
    const r = await handleAsk(body, deps({ apiKey: undefined, call }));
    expect(r).toEqual({ status: 503, body: { ok: false, code: "NO_KEY" } });
    expect(call).not.toHaveBeenCalled();
  });

  it("한도 초과(429)는 RATE_LIMIT", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await handleAsk(body, deps({ call: async () => { throw Object.assign(new Error("quota"), { status: 429 }); } }));
    expect(r).toEqual({ status: 429, body: { ok: false, code: "RATE_LIMIT" } });
  });

  it("시간 초과는 TIMEOUT", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await handleAsk(body, deps({ call: async () => { throw new UpstreamTimeout(); } }));
    expect(r).toEqual({ status: 504, body: { ok: false, code: "TIMEOUT" } });
  });

  it("그 밖의 실패는 UPSTREAM이며 응답·로그에 키와 질문이 섞이지 않는다", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await handleAsk(
      body,
      deps({ call: async () => { throw new Error(`bad key ${SECRET} while asking ${req.question}`); } }),
    );
    expect(r).toEqual({ status: 502, body: { ok: false, code: "UPSTREAM" } });
    const logged = JSON.stringify(spy.mock.calls);
    expect(logged).not.toContain(SECRET);
    expect(logged).not.toContain("늦어진");
    expect(JSON.stringify(r)).not.toContain(SECRET);
  });

  it("모델 답이 약속한 모양이 아니면 UPSTREAM", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await handleAsk(body, deps({ call: async () => "모양이 틀린 글" }));
    expect(r.body).toEqual({ ok: false, code: "UPSTREAM" });
  });

  it("모의 응답: mock 표시가 붙고 Gemini를 부르지 않는다", async () => {
    const call = vi.fn();
    const r = await handleAsk(body, deps({ mock: true, apiKey: undefined, call }));
    expect(call).not.toHaveBeenCalled();
    expect(r.body).toMatchObject({ ok: true, mock: true });
  });

  it("모의 응답: 실제 준공일·미수금 질문은 notInData", async () => {
    const q = JSON.stringify({ ...req, question: "실제 준공일·미수금은?" });
    const r = await handleAsk(q, deps({ mock: true }));
    expect(r.body).toMatchObject({ ok: true, notInData: true, mock: true });
  });

  it("AI 실패가 계산에는 영향이 없다(같은 범위의 숫자는 그대로 계산된다)", async () => {
    const r1 = buildAiRequest(ds, f({}), "q");
    await handleAsk(body, deps({ call: async () => { throw new Error("x"); } })).catch(() => {});
    const r2 = buildAiRequest(ds, f({}), "q");
    expect(r2.overall).toEqual(r1.overall);
  });
});

describe("요청 타입 확인", () => {
  it("AiRequest 모양", () => {
    const r: AiRequest = buildAiRequest(ds, f({}), "q");
    expect(Object.keys(r).sort()).toEqual(["overall", "question", "records", "scope", "siteHistory", "siteMetrics", "trend"]);
  });
});
