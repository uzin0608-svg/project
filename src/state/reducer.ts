import type { AiAnswer, AiErrorCode, AiRequest } from "@/lib/ai-types";
import type { Dataset } from "@/lib/dataset";
import { defaultFilters } from "@/lib/filter";
import { ALL, type Filters } from "@/lib/types";

export interface AiItem {
  id: number;
  question: string;
  /** 질문을 보낸 때의 범위 글(예: 2026년 9월 · 전체 지역 …) */
  scopeText: string;
  status: "pending" | "done" | "error";
  request: AiRequest;
  answer?: AiAnswer;
  errorCode?: AiErrorCode;
}

export interface State {
  dataset: Dataset | null;
  /** 자료를 새로 적용할 때마다 1씩 늘어납니다(늦은 AI 응답 구별용) */
  dataVersion: number;
  filters: Filters;
  /** 필터가 바뀌었음을 알리는 안내 글 */
  notice: string | null;
  /** 점검 순위에서 눌러 비교표에서 강조할 현장 */
  focusSiteId: string | null;
  aiItems: AiItem[];
}

export type Action =
  | { type: "LOAD"; dataset: Dataset }
  | { type: "FILTERS"; filters: Filters; notice: string | null }
  | { type: "FOCUS"; siteId: string | null }
  | { type: "DISMISS_NOTICE" }
  | { type: "AI_ADD"; item: AiItem }
  | { type: "AI_UPDATE"; id: number; patch: Partial<AiItem> }
  | { type: "AI_CLEAR" };

const EMPTY_FILTERS: Filters = { month: "2026-09", region: ALL, projectType: ALL, siteId: ALL };

export const initialState: State = {
  dataset: null,
  dataVersion: 0,
  filters: EMPTY_FILTERS,
  notice: null,
  focusSiteId: null,
  aiItems: [],
};

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOAD":
      // 자료는 통째로 교체하고(이어 붙이지 않음) 필터·강조·AI 답변을 처음 상태로 되돌립니다.
      return {
        dataset: action.dataset,
        dataVersion: state.dataVersion + 1,
        filters: defaultFilters(action.dataset),
        notice: null,
        focusSiteId: null,
        aiItems: [],
      };
    case "FILTERS":
      // 필터가 바뀌면 강조와 이전 AI 답변을 지웁니다.
      return { ...state, filters: action.filters, notice: action.notice, focusSiteId: null, aiItems: [] };
    case "FOCUS":
      return { ...state, focusSiteId: action.siteId };
    case "DISMISS_NOTICE":
      return { ...state, notice: null };
    case "AI_ADD":
      return { ...state, aiItems: [...state.aiItems, action.item] };
    case "AI_UPDATE":
      return {
        ...state,
        aiItems: state.aiItems.map((it) => (it.id === action.id ? { ...it, ...action.patch } : it)),
      };
    case "AI_CLEAR":
      return { ...state, aiItems: [] };
  }
}
