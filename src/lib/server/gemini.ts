import { GoogleGenAI, Type } from "@google/genai";
import type { AiRequest } from "../ai-types";
import { buildUserPrompt, SYSTEM_INSTRUCTION } from "./prompt";

// 서버 전용: Gemini API를 부르는 유일한 곳입니다. API 키는 호출하는 쪽(route.ts)이 환경 변수에서 읽어 넘깁니다.

/** 실습조건에 정해진 모델. 이 한 줄에서만 바꿉니다. */
export const GEMINI_MODEL = "gemini-3.8-flash";

export class UpstreamTimeout extends Error {}

/** Gemini를 한 번 호출해 JSON 글(응답 본문)을 돌려줍니다. 자동 재시도는 하지 않습니다. */
export async function callGemini(req: AiRequest, apiKey: string, timeoutMs: number): Promise<string | undefined> {
  const ai = new GoogleGenAI({ apiKey });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: buildUserPrompt(req),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: { type: Type.STRING },
            citedSites: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  siteId: { type: Type.STRING },
                  month: { type: Type.STRING },
                  fields: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ["siteId", "month", "fields"],
              },
            },
            notInData: { type: Type.BOOLEAN },
          },
          required: ["answer", "citedSites", "notInData"],
        },
        abortSignal: controller.signal,
      },
    });
    return response.text;
  } catch (e) {
    if (controller.signal.aborted) throw new UpstreamTimeout();
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
