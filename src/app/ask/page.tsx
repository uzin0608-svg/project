"use client";

import Link from "next/link";
import { useState } from "react";
import { NoDataState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { AI_ERROR_TEXT, AI_QUESTION_MAX, type AiAnswer, type CitableField } from "@/lib/ai-types";
import { siteMetrics } from "@/lib/calc";
import { prevMonth, recordKey, type Dataset } from "@/lib/dataset";
import { milliToTenths } from "@/lib/decimal";
import { scopeLabel } from "@/lib/filter";
import { fmtMoney, fmtPct, fmtPp } from "@/lib/format";
import { ALL } from "@/lib/types";
import { useDashboard, type AiItem } from "@/state/DashboardProvider";

const EXAMPLES = [
  "D가 늦어진 원인과 대응은?",
  "9월 점검 현장은 어디고 이유는?",
  "D는 회복 중인가?",
  "J의 7월 기성이 왜 늘지 않았나?",
  "실제 준공일·미수금은?",
];

const FIELD_LABEL: Record<CitableField, string> = {
  currentWork: "당월 주요 공종",
  issueCategory: "현장 기록 분류",
  issueSummary: "기록된 상황",
  actionPlan: "계획된 대응",
  contractEndDate: "계약상 준공일(예정일)",
  startDate: "착공일",
};

function recordText(dataset: Dataset, month: string, siteId: string, field: CitableField): string | null {
  const r = dataset.byKey.get(recordKey(month, siteId));
  return r ? r[field] : null;
}

/** AI가 인용했다고 알려 준 현장의 숫자는 AI 글이 아니라 프로그램 계산값으로 보여 줍니다. */
function Evidence({ dataset, answer }: { dataset: Dataset; answer: AiAnswer }) {
  const seen = new Set<string>();
  const cites = answer.citedSites
    .filter((c) => {
      const key = `${c.month}|${c.siteId}`;
      if (seen.has(key) || !dataset.byKey.has(recordKey(c.month, c.siteId))) return false;
      seen.add(key);
      return true;
    })
    // 기준 월이 가장 늦은 것(선택 월)을 먼저 보여 줍니다.
    .sort((a, b) => (a.month === b.month ? a.siteId.localeCompare(b.siteId) : a.month < b.month ? 1 : -1));
  if (cites.length === 0) {
    return answer.notInData ? null : (
      <p className="mt-3 rounded bg-slate-100 px-3 py-2 text-xs text-slate-700" data-testid="no-evidence">
        근거 확인 불가 — 답변이 인용한 현장·월을 보낸 자료에서 확인하지 못했습니다.
      </p>
    );
  }
  return (
    <div className="mt-3 space-y-3" data-testid="evidence">
      {cites.map((c) => {
        const rec = dataset.byKey.get(recordKey(c.month, c.siteId))!;
        const m = siteMetrics(dataset, rec);
        return (
          <div key={`${c.month}${c.siteId}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="text-slate-600">기준 월 <b className="text-slate-900">{c.month}</b></span>
              <span className="text-slate-600">대상 현장 <b className="text-slate-900">현장 {c.siteId} ({rec.siteName})</b></span>
              <StatusBadge status={m.status} />
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-500">근거 숫자 (프로그램 계산값)</p>
            <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Num label="계획 공정률" value={fmtPct(milliToTenths(rec.plannedProgress))} />
              <Num label="실제 공정률" value={fmtPct(milliToTenths(rec.actualProgress))} />
              <Num label="공정차이" value={fmtPp(m.gapTenths)} danger={m.gapTenths < 0n} />
              <Num label="기성률" value={fmtPct(m.earnedRateTenths)} />
              <Num label="당월기성액" value={fmtMoney(m.monthlyEarnedMilli)} />
            </div>
            {c.fields.length > 0 && (
              <div className="mt-2 space-y-1.5">
                <p className="text-xs font-semibold text-slate-500">참고한 기록 필드</p>
                {c.fields.map((f) => (
                  <p key={f} className="text-sm text-slate-800">
                    <span className="mr-2 rounded bg-white px-1.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                      {FIELD_LABEL[f]} ({f})
                    </span>
                    “{recordText(dataset, c.month, c.siteId, f)}”
                  </p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Num({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded bg-white p-2 ring-1 ring-slate-200">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`num text-base font-bold ${danger ? "text-red-700" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}

function AnswerBlock({ item, dataset, onRetry }: { item: AiItem; dataset: Dataset; onRetry: (q: string) => void }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" data-testid="ai-item">
      <div className="rounded bg-slate-100 px-3 py-2">
        <p className="font-medium text-slate-900" data-testid="ai-question">“{item.question}”</p>
        <p className="mt-0.5 text-xs text-slate-500">분석 범위: {item.scopeText}</p>
      </div>

      {item.status === "pending" && (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-600" data-testid="ai-pending" role="status">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
          답변을 기다리는 중입니다… (대시보드와 CSV는 계속 쓸 수 있습니다)
        </p>
      )}

      {item.status === "error" && item.errorCode && (
        <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900" data-testid="ai-error" role="alert">
          <p className="font-semibold">AI 연결에 실패했습니다(원인: {AI_ERROR_TEXT[item.errorCode]}).</p>
          <p className="mt-0.5">대시보드와 CSV는 계속 쓸 수 있습니다.</p>
          <button
            type="button"
            onClick={() => onRetry(item.question)}
            className="mt-2 rounded border border-red-300 bg-white px-3 py-1 text-xs text-red-800 hover:bg-red-100"
          >
            다시 보내기
          </button>
        </div>
      )}

      {item.status === "done" && item.answer && (
        <div className="mt-3" data-testid="ai-answer">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {item.answer.mock && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800" data-testid="mock-badge">
                모의 응답
              </span>
            )}
            {item.answer.notInData && (
              <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700" data-testid="not-in-data-badge">
                자료에 없음
              </span>
            )}
          </div>
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-900" data-testid="ai-answer-text">{item.answer.answer}</p>
          {item.answer.notInData && (
            <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700" data-testid="not-in-data-note">
              <p>이 자료에는 계약상 준공일(예정일)만 있고, 실제 준공일·실제 완료일·청구액·수금액·미수금은 없습니다. 계약상 준공일은 실제 완료를 보장하거나 예측하는 값이 아닙니다.</p>
            </div>
          )}
          <Evidence dataset={dataset} answer={item.answer} />
        </div>
      )}
    </div>
  );
}

export default function AskPage() {
  const { state, askAi, clearAi, aiPending } = useDashboard();
  const { dataset, filters, aiItems } = state;
  const [text, setText] = useState("");

  if (!dataset) return <NoDataState />;

  const tooLong = text.trim().length > AI_QUESTION_MAX;
  const canSend = text.trim().length > 0 && !tooLong && !aiPending;

  const send = (q: string) => {
    askAi(q);
    setText("");
  };

  // 오른쪽 "분석 참조 현장": 고른 현장, 없으면 가장 최근 답변이 인용한 현장
  let refSiteId: string | null = filters.siteId !== ALL ? filters.siteId : null;
  if (!refSiteId) {
    for (let i = aiItems.length - 1; i >= 0 && !refSiteId; i--) {
      const cite = aiItems[i].answer?.citedSites.find((c) => dataset.byKey.has(recordKey(c.month, c.siteId)));
      if (cite) refSiteId = cite.siteId;
    }
  }
  const refInfo = refSiteId ? dataset.siteMap.get(refSiteId) : undefined;
  const refNow = refSiteId ? dataset.byKey.get(recordKey(filters.month, refSiteId)) : undefined;
  const refPrev = refSiteId ? dataset.byKey.get(recordKey(prevMonth(filters.month), refSiteId)) : undefined;

  return (
    <div className="space-y-5 pt-5" data-testid="ask-page">
      <section className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <span className="rounded bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-800" data-testid="ask-scope">
          현재 분석 범위: {scopeLabel(dataset, filters)}
        </span>
        <p className="text-xs text-slate-600">
          AI는 프로그램이 계산한 숫자와 현장 기록(상황·대응)만 근거로 답변합니다. 필터를 바꾸면 이전 답변이 지워집니다.
        </p>
        <Link href="/" className="ml-auto text-xs text-blue-700 underline">범위 바꾸기(현황 요약)</Link>
      </section>

      <section aria-label="예시 질문">
        <p className="mb-2 text-xs font-semibold text-slate-600">현장 분석 추천 질문</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((q, i) => (
            <button
              key={q}
              type="button"
              disabled={aiPending}
              onClick={() => send(q)}
              data-testid={`example-${i + 1}`}
              className={`rounded-full border px-3 py-1.5 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 ${
                i === 4 ? "border-red-200 text-red-700" : "border-slate-300 text-slate-800"
              }`}
            >
              {i + 1}. “{q}”
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4" data-testid="ai-history">
          {aiItems.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600" data-testid="ai-empty">
              예시 질문을 누르거나 아래 입력창에 질문을 입력하세요.
            </p>
          )}
          {aiItems.map((item) => (
            <AnswerBlock key={item.id} item={item} dataset={dataset} onRetry={askAi} />
          ))}
        </div>

        {refInfo && refNow && (
          <aside className="h-fit rounded-lg border border-slate-200 bg-white p-4 shadow-sm" data-testid="ref-site">
            <h2 className="text-base font-semibold text-slate-900">분석 참조 현장 (현장 {refInfo.siteId})</h2>
            <p className="text-xs text-slate-500">{refInfo.siteName}</p>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="지역 · 유형" value={`${refInfo.region} · ${refInfo.projectType}`} />
              <Row label="계약금액" value={`${fmtMoney(refInfo.contractAmount)}백만원`} />
              <Row label="계약상 준공일(예정일)" value={refInfo.contractEndDate} />
              <Row
                label="공정 편차 추이"
                value={
                  refPrev
                    ? `${fmtPp(milliToTenths(refPrev.actualProgress - refPrev.plannedProgress))} → ${fmtPp(milliToTenths(refNow.actualProgress - refNow.plannedProgress))}`
                    : "전월 자료 없음"
                }
              />
            </dl>
            <p className="mt-3 text-xs text-slate-500">계약상 준공일은 예정일이며 실제 완료일이 아닙니다.</p>
          </aside>
        )}
      </div>

      <form
        className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSend) send(text);
        }}
      >
        <label htmlFor="ask-input" className="text-sm font-semibold text-slate-800">현장 공정·기성 질문하기</label>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            id="ask-input"
            data-testid="ask-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="분석을 원하는 현장명이나 공정 현황 질문을 입력하세요 (예: D현장 8월 대비 변동)"
            className="h-10 min-w-0 flex-1 rounded border border-slate-300 px-3 text-sm"
          />
          <button
            type="submit"
            disabled={!canSend}
            data-testid="ask-submit"
            className="h-10 rounded bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            질문하기
          </button>
          <button
            type="button"
            onClick={clearAi}
            className="h-10 rounded border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
          >
            대화 초기화
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {tooLong ? (
            <span className="text-red-700" data-testid="too-long">500자 이내로 입력해 주세요. (지금 {text.trim().length}자)</span>
          ) : (
            <>질문할 때 계산된 숫자와 기록 원문이 함께 전달됩니다. 대시보드와 CSV는 AI 연결 상태와 상관없이 이용할 수 있습니다.</>
          )}
        </p>
      </form>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="num text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}
