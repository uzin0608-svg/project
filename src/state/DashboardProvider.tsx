"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { buildAiRequest } from "@/lib/ai-context";
import type { AiErrorCode, AiResponse } from "@/lib/ai-types";
import type { Dataset } from "@/lib/dataset";
import { defaultFilters, normalizeFilters, scopeKey, scopeLabel } from "@/lib/filter";
import type { Filters } from "@/lib/types";
import { initialState, reducer, type State } from "./reducer";

export type { AiItem } from "./reducer";

/** 브라우저는 30초까지만 기다립니다(서버는 25초) */
const CLIENT_TIMEOUT_MS = 30_000;

interface DashboardContextValue {
  state: State;
  loadDataset: (dataset: Dataset) => void;
  setFilters: (patch: Partial<Filters>) => void;
  resetFilters: () => void;
  setFocus: (siteId: string | null) => void;
  dismissNotice: () => void;
  askAi: (question: string) => void;
  clearAi: () => void;
  aiPending: boolean;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  // 비동기 응답이 도착했을 때 "지금" 범위와 비교하려고 최신 상태를 보관합니다.
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const controllerRef = useRef<AbortController | null>(null);
  const nextIdRef = useRef(1);

  const abortInFlight = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  const loadDataset = useCallback(
    (dataset: Dataset) => {
      abortInFlight();
      dispatch({ type: "LOAD", dataset });
    },
    [abortInFlight],
  );

  const applyFilters = useCallback(
    (next: Filters) => {
      const { dataset, filters } = stateRef.current;
      if (!dataset) return;
      const { filters: normalized, siteReset } = normalizeFilters(dataset, next);
      const changed =
        normalized.month !== filters.month ||
        normalized.region !== filters.region ||
        normalized.projectType !== filters.projectType ||
        normalized.siteId !== filters.siteId;
      if (!changed && !siteReset) return;
      abortInFlight();
      dispatch({
        type: "FILTERS",
        filters: normalized,
        notice: siteReset ? "선택한 현장이 범위에서 빠져 전체로 바꿨습니다." : null,
      });
    },
    [abortInFlight],
  );

  const setFilters = useCallback(
    (patch: Partial<Filters>) => applyFilters({ ...stateRef.current.filters, ...patch }),
    [applyFilters],
  );

  const resetFilters = useCallback(() => {
    const { dataset } = stateRef.current;
    if (dataset) applyFilters(defaultFilters(dataset));
  }, [applyFilters]);

  const setFocus = useCallback((siteId: string | null) => dispatch({ type: "FOCUS", siteId }), []);
  const dismissNotice = useCallback(() => dispatch({ type: "DISMISS_NOTICE" }), []);
  const clearAi = useCallback(() => {
    abortInFlight();
    dispatch({ type: "AI_CLEAR" });
  }, [abortInFlight]);

  const askAi = useCallback(
    (question: string) => {
      const { dataset, filters, dataVersion, aiItems } = stateRef.current;
      if (!dataset || aiItems.some((it) => it.status === "pending")) return;
      const request = buildAiRequest(dataset, filters, question.trim());
      const key = scopeKey(filters, dataVersion);
      const id = nextIdRef.current++;
      dispatch({
        type: "AI_ADD",
        item: {
          id,
          question: question.trim(),
          scopeText: scopeLabel(dataset, filters),
          status: "pending",
          request,
        },
      });

      const controller = new AbortController();
      controllerRef.current = controller;
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, CLIENT_TIMEOUT_MS);

      const stillCurrent = () => {
        const s = stateRef.current;
        return scopeKey(s.filters, s.dataVersion) === key;
      };
      const finishError = (code: AiErrorCode) => {
        if (stillCurrent()) dispatch({ type: "AI_UPDATE", id, patch: { status: "error", errorCode: code } });
      };

      fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      })
        .then(async (res) => {
          let body: AiResponse;
          try {
            body = (await res.json()) as AiResponse;
          } catch {
            finishError("UPSTREAM");
            return;
          }
          // 범위가 바뀐 뒤 도착한 응답은 새 범위에 표시하지 않고 버립니다.
          if (!stillCurrent()) return;
          if (body.ok) {
            const { ok: _ok, ...answer } = body;
            void _ok;
            dispatch({ type: "AI_UPDATE", id, patch: { status: "done", answer } });
          } else {
            finishError(body.code);
          }
        })
        .catch(() => {
          if (timedOut) finishError("TIMEOUT");
          else if (!controller.signal.aborted) finishError("UPSTREAM");
          // 필터 변경 등으로 직접 취소한 경우는 아무것도 표시하지 않습니다.
        })
        .finally(() => {
          clearTimeout(timer);
          if (controllerRef.current === controller) controllerRef.current = null;
        });
    },
    [],
  );

  const value = useMemo<DashboardContextValue>(
    () => ({
      state,
      loadDataset,
      setFilters,
      resetFilters,
      setFocus,
      dismissNotice,
      askAi,
      clearAi,
      aiPending: state.aiItems.some((it) => it.status === "pending"),
    }),
    [state, loadDataset, setFilters, resetFilters, setFocus, dismissNotice, askAi, clearAi],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard는 DashboardProvider 안에서만 쓸 수 있습니다.");
  return ctx;
}
