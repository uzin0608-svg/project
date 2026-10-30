"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { siteMetrics } from "@/lib/calc";
import { buildDataset } from "@/lib/dataset";
import { milliToTenths } from "@/lib/decimal";
import { fmtMoney, fmtPct } from "@/lib/format";
import { MAX_FILE_BYTES } from "@/lib/types";
import { validateImport, type ImportResult } from "@/lib/validate";
import { useDashboard } from "@/state/DashboardProvider";

type Phase =
  | { kind: "idle" }
  | { kind: "reading"; name: string }
  | { kind: "result"; name: string; size: number; result: ImportResult }
  | { kind: "applied"; rows: number };

const MAX_ERRORS_SHOWN = 20;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export default function ImportPage() {
  const { state, loadDataset } = useDashboard();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [showAll, setShowAll] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setShowAll(false);
    setPhase({ kind: "reading", name: file.name });
    let text = "";
    if (file.size <= MAX_FILE_BYTES) {
      try {
        text = await file.text();
      } catch {
        setPhase({
          kind: "result",
          name: file.name,
          size: file.size,
          result: {
            ok: false,
            errors: [{ severity: "error", location: "파일", message: "파일을 읽을 수 없습니다. 다시 선택해 주세요." }],
            warnings: [],
            infos: [],
            records: [],
            summary: null,
          },
        });
        return;
      }
    }
    // 검사는 임시 사본에서만 합니다. 지금 자료는 "적용"을 누르기 전까지 바뀌지 않습니다.
    setPhase({ kind: "result", name: file.name, size: file.size, result: validateImport(file.name, file.size, text) });
  };

  const reset = () => {
    setPhase({ kind: "idle" });
    setShowAll(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const apply = (result: ImportResult) => {
    loadDataset(buildDataset(result.records));
    setPhase({ kind: "applied", rows: result.records.length });
    if (inputRef.current) inputRef.current.value = "";
  };

  const preview = useMemo(() => {
    if (phase.kind !== "result" || !phase.result.ok) return null;
    const ds = buildDataset(phase.result.records);
    return phase.result.records.map((r) => siteMetrics(ds, r));
  }, [phase]);

  return (
    <div className="space-y-6 pt-6" data-testid="import-page">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">공정·기성 데이터 가져오기 및 검사</h1>
        <p className="mt-1 text-sm text-slate-600">
          CSV 또는 JSON 파일을 검사하고 미리 본 뒤 전체를 바꿉니다. 오류가 있거나 취소하면 지금 자료를 그대로 둡니다.
          CSV를 가져온 뒤 같은 JSON을 가져와도 이어 붙이지 않고 144행으로 유지됩니다.
        </p>
        <p className="mt-1 text-xs text-slate-500" data-testid="current-data-note">
          {state.dataset
            ? `지금 불러온 자료: ${state.dataset.sites.length}개 현장 · ${state.dataset.records.length}행`
            : "지금 불러온 자료: 없음"}
        </p>
      </header>

      {phase.kind === "applied" ? (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-6" data-testid="import-applied">
          <h2 className="text-lg font-semibold text-emerald-900">{phase.rows}행으로 교체했습니다.</h2>
          <p className="mt-1 text-sm text-emerald-800">필터는 처음 상태(2026-09·전체)로 돌아갔고 이전 AI 답변은 지웠습니다.</p>
          <div className="mt-4 flex gap-2">
            <Link href="/" className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              현황 요약 보기
            </Link>
            <button type="button" onClick={reset} className="rounded border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50">
              다른 파일 가져오기
            </button>
          </div>
        </section>
      ) : (
        <section
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          className={`rounded-lg border-2 border-dashed bg-white p-8 text-center ${
            dragging ? "border-blue-500 bg-blue-50" : "border-slate-300"
          }`}
          data-testid="drop-zone"
        >
          <p className="text-lg font-semibold text-slate-900">CSV 또는 JSON 파일을 끌어다 놓으세요</p>
          <p className="mt-1 text-sm text-slate-600">
            12개 현장 × 12개월(144행) · 15개 필수 열 · 최대 25MB · 파일은 이 브라우저 안에서만 읽고 서버로 보내지 않습니다.
          </p>
          <label className="mt-4 inline-block cursor-pointer rounded bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800">
            파일 직접 선택
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.json,text/csv,application/json"
              className="sr-only"
              data-testid="file-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
          </label>
        </section>
      )}

      {phase.kind === "reading" && (
        <p className="text-sm text-slate-600" data-testid="import-reading">{phase.name} 검사 중입니다…</p>
      )}

      {phase.kind === "result" && !phase.result.ok && (
        <section className="rounded-lg border border-red-200 border-l-4 border-l-red-600 bg-white p-5" data-testid="import-errors">
          <h2 className="text-lg font-semibold text-red-700">가져오기를 거부했습니다</h2>
          <p className="mt-1 text-sm text-slate-700">
            <span className="font-medium">{phase.name}</span> ({formatSize(phase.size)}) — 지금 자료는 그대로 유지됩니다.
            {state.dataset && " (지금 화면의 숫자는 바뀌지 않았습니다.)"}
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {phase.result.errors.slice(0, MAX_ERRORS_SHOWN).map((e, i) => (
              <li key={i} className="rounded bg-red-50 px-3 py-1.5 text-red-900" data-testid="import-error-item">
                <span className="font-semibold">{e.location}</span>
                {e.field && <span className="font-mono"> {e.field}</span>}: {e.message}
              </li>
            ))}
          </ul>
          {phase.result.errors.length > MAX_ERRORS_SHOWN && (
            <p className="mt-2 text-sm text-slate-600">외 {phase.result.errors.length - MAX_ERRORS_SHOWN}건</p>
          )}
          <button type="button" onClick={reset} className="mt-4 rounded border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50">
            돌아가기
          </button>
        </section>
      )}

      {phase.kind === "result" && phase.result.ok && phase.result.summary && preview && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" data-testid="import-ok">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-900">검사 결과 · 미리보기</h2>
            <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">검증 완료</span>
            <span className="text-sm text-slate-600">{phase.name} ({formatSize(phase.size)})</span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="import-summary">
            <Stat label="총 데이터 행" value={`${phase.result.summary.rowCount}행`} />
            <Stat label="유효 열 수" value={`${phase.result.summary.columnCount}열`} />
            <Stat
              label="월 범위"
              value={phase.result.summary.monthRange ? `${phase.result.summary.monthRange[0]}~${phase.result.summary.monthRange[1]}` : "-"}
            />
            <Stat label="현장 수" value={`${phase.result.summary.siteCount}개 현장`} />
          </div>

          {phase.result.infos.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-slate-600">
              {phase.result.infos.map((m, i) => (
                <li key={i}>ⓘ {m.message}</li>
              ))}
            </ul>
          )}
          {phase.result.warnings.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-amber-800" data-testid="import-warnings">
              {phase.result.warnings.map((m, i) => (
                <li key={i}>⚠ {m.message}</li>
              ))}
            </ul>
          )}

          <div className="mt-5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">
              미리보기 ({showAll ? `전체 ${preview.length}행` : `${Math.min(5, preview.length)}행 / 총 ${preview.length}행`})
            </h3>
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="rounded border border-slate-300 bg-white px-3 py-1 text-xs hover:bg-slate-50"
            >
              {showAll ? "미리보기 접기" : `미리보기 전체 ${preview.length}행 펼치기`}
            </button>
          </div>
          <div className={`mt-2 overflow-auto rounded border border-slate-200 ${showAll ? "max-h-[420px]" : ""}`}>
            <table className="w-full min-w-[760px] text-left text-sm" data-testid="preview-table">
              <thead className="sticky top-0 bg-slate-50 text-[11px] font-semibold text-slate-500">
                <tr>
                  <th className="px-3 py-2">현장 코드</th>
                  <th className="px-3 py-2">현장명</th>
                  <th className="px-3 py-2">대상 월</th>
                  <th className="px-3 py-2 text-right">계획 공정률</th>
                  <th className="px-3 py-2 text-right">실제 공정률</th>
                  <th className="px-3 py-2 text-right">누적기성액(백만원)</th>
                  <th className="px-3 py-2 text-right">당월기성액(백만원)</th>
                </tr>
              </thead>
              <tbody>
                {(showAll ? preview : preview.slice(0, 5)).map((m) => (
                  <tr key={`${m.record.month}${m.record.siteId}`} className="border-t border-slate-100">
                    <td className="px-3 py-1.5 font-mono font-semibold">{m.record.siteId}</td>
                    <td className="px-3 py-1.5">{m.record.siteName}</td>
                    <td className="px-3 py-1.5">{m.record.month}</td>
                    <td className="num px-3 py-1.5 text-right">{fmtPct(milliToTenths(m.record.plannedProgress))}</td>
                    <td className="num px-3 py-1.5 text-right">{fmtPct(milliToTenths(m.record.actualProgress))}</td>
                    <td className="num px-3 py-1.5 text-right">{fmtMoney(m.record.cumulativeEarned)}</td>
                    <td className="num px-3 py-1.5 text-right">{fmtMoney(m.monthlyEarnedMilli)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => apply(phase.result)}
              data-testid="apply-button"
              className="rounded bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              데이터 적용 및 대시보드 반영
            </button>
            <button
              type="button"
              onClick={reset}
              data-testid="cancel-button"
              className="rounded border border-slate-300 bg-white px-5 py-2.5 text-sm hover:bg-slate-50"
            >
              취소하고 돌아가기
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="num mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
