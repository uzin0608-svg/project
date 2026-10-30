import { callGemini } from "@/lib/server/gemini";
import { handleAsk } from "@/lib/server/handle-ask";

// 서버에서 실행되는 유일한 코드. 키는 환경 변수(GEMINI_API_KEY)에서만 읽고 응답·로그에 쓰지 않습니다.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SERVER_TIMEOUT_MS = 25_000;

export async function POST(request: Request): Promise<Response> {
  const bodyText = await request.text();
  const apiKey = process.env.GEMINI_API_KEY?.trim() || undefined;
  const result = await handleAsk(bodyText, {
    apiKey,
    mock: process.env.AI_MOCK === "1",
    call: (req, key) => callGemini(req, key, SERVER_TIMEOUT_MS),
  });
  return Response.json(result.body, { status: result.status });
}
