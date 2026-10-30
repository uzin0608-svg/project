// 실제 Edge 브라우저로 화면 동작을 점검합니다. (개발계획 S1~S12의 확인 항목)
// 사용: 서버를 먼저 실행한 뒤  node scripts/e2e.mjs
//   BASE_URL (기본 http://localhost:3000), SHOT_DIR (화면 캡처 저장 폴더, 선택), REAL_AI=0 (실제 AI 호출 건너뜀)
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOT_DIR = process.env.SHOT_DIR;
const REAL_AI = process.env.REAL_AI !== "0";
const DATA = path.resolve(process.cwd(), "data");
const CSV = path.join(DATA, "현장공정기성.csv");
const JSON_FILE = path.join(DATA, "현장공정기성.json");
const ERR_FILES = ["오류_공정률101.csv", "오류_공정률빈값.csv", "오류_중복키.csv"].map((n) =>
  path.join(DATA, "검증용_오류데이터", n),
);
if (SHOT_DIR) mkdirSync(SHOT_DIR, { recursive: true });

const results = [];
let currentStory = "";
const norm = (s) => (s ?? "").replace(/\s+/g, " ").trim();

function check(name, ok, detail = "") {
  results.push({ story: currentStory, name, ok: Boolean(ok), detail });
  console.log(`${ok ? "  통과" : "  실패"} [${currentStory}] ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}

async function story(name, fn) {
  currentStory = name;
  console.log(`\n== ${name}`);
  try {
    await fn();
  } catch (e) {
    check("예외 없이 진행", false, String(e?.message ?? e).split("\n")[0]);
  }
}

const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await ctx.newPage();
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error" && !/Failed to load resource/.test(m.text())) consoleErrors.push(m.text());
});

const T = (id) => page.getByTestId(id);
// SVG 안의 글자도 읽을 수 있게 textContent를 씁니다(줄바꿈·공백은 정리).
const text = async (id) => norm(await T(id).evaluate((el) => el.innerText ?? el.textContent));
async function shot(name) {
  if (SHOT_DIR) await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: true });
}
const nav = (name) => page.getByRole("link", { name, exact: true }).first().click();
async function setMonth(m) { await page.selectOption("#filter-month", m); }
async function setRegion(r) { await page.selectOption("#filter-region", r); }
async function setType(t) { await page.selectOption("#filter-type", t); }
async function setSite(s) { await page.selectOption("#filter-site", s); }

// ───────── S1
await story("S1 자료 없음 안내와 메뉴 이동", async () => {
  await page.goto(BASE);
  check("위쪽 칩이 '자료 없음'", (await text("data-chip")).includes("자료 없음"));
  check("현황 요약에 '아직 가져온 자료가 없습니다'", (await text("no-data")).includes("아직 가져온 자료가 없습니다"));
  await nav("현장별 비교표");
  await T("no-data").waitFor();
  check("비교표 화면도 자료 없음 안내", (await text("no-data")).includes("자료 가져오기"));
  await nav("AI에게 묻기");
  await T("no-data").waitFor();
  check("AI 화면도 자료 없음 안내", (await text("no-data")).includes("아직 가져온 자료가 없습니다"));
  await nav("자료 가져오기");
  await T("drop-zone").waitFor();
  check("자료 가져오기에 파일 선택 영역", (await text("drop-zone")).includes("파일 직접 선택"));
  await shot("s1-import-empty");
});

// ───────── S2
await story("S2 CSV 검사·미리보기·취소·적용", async () => {
  await T("file-input").setInputFiles(CSV);
  await T("import-ok").waitFor();
  const t = await text("import-ok");
  check("144행·15열·2025-10~2026-09·12개 현장", t.includes("144행") && t.includes("15열") && t.includes("2025-10~2026-09") && t.includes("12개 현장"), t.slice(0, 200));
  check("CSV 단위 안내 문구", t.includes("CSV에는 단위 정보가 없어"));
  check("미리보기 5행", (await page.locator('[data-testid=preview-table] tbody tr').count()) === 5);
  check("2025-10 미리보기 행의 당월기성액은 '계산 불가'", (await text("preview-table")).includes("계산 불가"));
  await shot("s2-import-ok");
  await T("cancel-button").click();
  await T("drop-zone").waitFor();
  check("취소 후 자료는 그대로 '자료 없음'", (await text("data-chip")).includes("자료 없음"));
  await T("file-input").setInputFiles(CSV);
  await T("apply-button").click();
  await T("import-applied").waitFor();
  check("'144행으로 교체했습니다'", (await text("import-applied")).includes("144행으로 교체했습니다"));
  check("위쪽 칩 '12개 현장 · 144행'", (await text("data-chip")).includes("12개 현장 · 144행"));
  await page.getByRole("link", { name: "현황 요약 보기" }).click();
  await T("summary-page").waitFor();
});

// ───────── S3
await story("S3 오류 파일 거부·CSV 다음 JSON", async () => {
  await nav("자료 가져오기");
  const expected = [
    { file: ERR_FILES[0], loc: "134행", field: "actualProgress" },
    { file: ERR_FILES[1], loc: "134행", field: "actualProgress" },
    { file: ERR_FILES[2], loc: "146행", field: "" },
  ];
  for (const e of expected) {
    await T("file-input").setInputFiles(e.file);
    await T("import-errors").waitFor();
    const t = await text("import-errors");
    check(`${path.basename(e.file)} 거부 + 위치 ${e.loc}`, t.includes("거부") && t.includes(e.loc), t.slice(0, 160));
    check(`${path.basename(e.file)} '지금 자료는 그대로 유지됩니다'`, t.includes("지금 자료는 그대로 유지됩니다"));
    check(`${path.basename(e.file)} 적용 버튼 없음`, (await T("apply-button").count()) === 0);
    check(`${path.basename(e.file)} 칩 그대로`, (await text("data-chip")).includes("12개 현장 · 144행"));
    if (e === expected[0]) await shot("s3-import-error");
  }
  await nav("현황 요약");
  await T("kpi-earned-rate").waitFor();
  check("오류 파일 거부 뒤에도 9월 기성률 67.2%", (await text("kpi-earned-rate")) === "67.2%");
  await nav("자료 가져오기");
  await T("file-input").setInputFiles(JSON_FILE);
  await T("import-ok").waitFor();
  check("JSON 검사 통과(144행)", (await text("import-ok")).includes("144행"));
  await T("apply-button").click();
  await T("import-applied").waitFor();
  check("JSON 적용 후에도 '12개 현장 · 144행'(288행 아님)", (await text("data-chip")).includes("12개 현장 · 144행"));
  await page.getByRole("link", { name: "현황 요약 보기" }).click();
});

// ───────── S4
await story("S4 필터와 큰 숫자", async () => {
  await T("kpi-earned-rate").waitFor();
  check("기성률 67.2%", (await text("kpi-earned-rate")) === "67.2%");
  check("계획 73.2%", (await text("kpi-planned")) === "73.2%");
  check("실제 71.2%", (await text("kpi-actual")) === "71.2%");
  check("공정차이 -2.0pp", (await text("kpi-gap")) === "-2.0pp");
  const kpi = await text("kpi-cards");
  check("총 계약금액 630,700.0 · 누적기성액 424,063.4", kpi.includes("630,700.0") && kpi.includes("424,063.4"));
  const counts = await text("status-counts");
  check("정상 6곳·주의 3곳·점검 3곳", counts.includes("정상 6곳") && counts.includes("주의 3곳") && counts.includes("점검 3곳"), counts);
  check("당월기성액 칩 28,878.7", (await text("monthly-chip")).includes("28,878.7"));
  await shot("s4-summary");

  await setMonth("2026-08");
  check("8월 기성률 62.7%", (await text("kpi-earned-rate")) === "62.7%");
  await setMonth("2025-10");
  check("2025-10 당월기성액 칩 '계산 불가'", (await text("monthly-chip")).includes("계산 불가"));
  check("2025-10에도 누적 지표는 표시(기성률 16.7%)", (await text("kpi-earned-rate")) === "16.7%");
  await setMonth("2026-09");

  await setRegion("인천");
  await setType("공동주택");
  check("인천·공동주택 기성률 61.2%", (await text("kpi-earned-rate")) === "61.2%");
  check("현장 목록 = 전체 + A·G", (await page.locator("#filter-site option").count()) === 3);
  check("범위 글 '(2개 현장)'", (await text("filter-bar")).includes("전체 2개 현장 집계"));

  await page.getByRole("button", { name: "필터 초기화" }).click();
  check("필터 초기화 → 67.2%", (await text("kpi-earned-rate")) === "67.2%");

  await setSite("D");
  check("현장 D 고르면 기성률 69.4%", (await text("kpi-earned-rate")) === "69.4%");
  await setRegion("인천");
  await T("filter-notice").waitFor();
  check("현장이 빠지면 안내 '전체로 바꿨습니다'", (await text("filter-notice")).includes("전체로 바꿨습니다"));
  check("현장 선택이 전체로 복귀", (await page.locator("#filter-site").inputValue()) === "ALL");

  await setType("생산시설");
  const empty = [await text("kpi-earned-rate"), await text("kpi-planned"), await text("kpi-actual"), await text("kpi-gap")];
  check("인천·생산시설: 모든 큰 숫자 '계산 불가'", empty.every((v) => v === "계산 불가"), empty.join(" / "));
  check("0%로 표시하지 않음", !(await text("kpi-cards")).includes("0.0%"));
  check("'선택한 범위에 자료가 없습니다' 안내", (await text("empty-range")).includes("자료가 없습니다"));
  check("CSV 버튼 비활성", await page.getByRole("button", { name: /CSV 내보내기/ }).isDisabled());
  await page.getByRole("button", { name: "필터 초기화" }).click();
});

// ───────── S5
await story("S5 추이 차트와 월별 기성 막대", async () => {
  const sum = await text("trend-summary");
  check("추이 12개월", (sum.match(/계획/g) ?? []).length === 12, sum.slice(0, 80));
  const tip = await text("trend-tooltip");
  check("기본 툴팁: 계획 73.2% · 실제 71.2% · 간격 -2.0pp", tip.includes("계획 73.2%") && tip.includes("실제 71.2%") && tip.includes("간격 -2.0pp"), tip);
  await T("trend-chart").locator('svg[role="img"]').hover({ position: { x: 60, y: 120 } });
  const tip0 = await text("trend-tooltip");
  check("첫 점에 올리면 2025-10 값", tip0.includes("2025-10") && tip0.includes("계획 19.4%") && tip0.includes("실제 19.6%"), tip0);
  const f = await text("monthly-formula");
  check("계산식: 28,878.7 = 424,063.4(9월 누적) − 395,184.7(8월 누적)", f.includes("28,878.7") && f.includes("424,063.4") && f.includes("9월 누적") && f.includes("395,184.7") && f.includes("8월 누적"), f);
  await shot("s5-charts");

  await setMonth("2026-03");
  check("2026-03은 6개월만", ((await text("trend-summary")).match(/계획/g) ?? []).length === 6);
  await setMonth("2025-10");
  const f10 = await text("monthly-formula");
  check("2025-10 '계산 불가'와 '전월 자료가 없어 계산할 수 없습니다'", f10.includes("계산 불가") && f10.includes("전월") && f10.includes("계산할 수 없습니다"), f10);
  check("막대 영역에 '계산 불가*'", (await text("monthly-bars")).includes("계산 불가*"));
  await setMonth("2026-09");
});

// ───────── S6
await story("S6 점검 순위", async () => {
  const order = await page.locator('[data-testid^="rank-row-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid").replace("rank-row-", "")));
  check("순서 D → I → K", order.join(",") === "D,I,K", order.join(","));
  const d = await text("rank-row-D");
  check("D 줄: 86.5% · 75.8% · 69.4% · -10.7pp · 점검", ["86.5%", "75.8%", "69.4%", "-10.7pp", "점검"].every((x) => d.includes(x)), d);
  const rk = await text("ranking-table");
  check("I(-7.6pp)·K(-5.4pp)", rk.includes("-7.6pp") && rk.includes("-5.4pp"));
  await setRegion("인천");
  const no = await text("no-inspection");
  check("인천: 점검 대상 없음 + 정상 2곳 · 주의 0곳", no.includes("점검 대상 없음") && no.includes("정상 2곳") && no.includes("주의 0곳"), no);
  await page.getByRole("button", { name: "필터 초기화" }).click();
});

// ───────── S7
await story("S7 현장별 비교표", async () => {
  await nav("현장별 비교표");
  await T("compare-table").waitFor();
  const ids = await page.locator('[data-testid^="compare-row-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid").replace("compare-row-", "")));
  check("12개 현장 A~L", ids.join("") === "ABCDEFGHIJKL", ids.join(""));
  const head = await text("compare-table");
  check("열: 지역·공사 유형·당월 주요 공종·계약금액·누적기성액·당월기성액", ["지역", "공사 유형", "당월 주요 공종", "계약금액", "누적기성액", "당월기성액"].every((x) => head.includes(x)));
  const foot = await text("compare-footer");
  check("아래 요약: 정상 6곳 · 주의 3곳 · 점검 3곳 + 총 기성률 67.2%", foot.includes("정상 6곳") && foot.includes("주의 3곳") && foot.includes("점검 3곳") && foot.includes("67.2%"), foot);
  const d = await text("compare-row-D");
  check("D 줄: 경기 · 공동주택 · 외장·내부마감 · 69.4% · 점검", ["경기", "공동주택", "외장·내부마감", "69.4%", "점검", "3,339.6"].every((x) => d.includes(x)), d);
  await shot("s7-compare");
  await setRegion("경기");
  check("경기만 → 4행", (await page.locator('[data-testid^="compare-row-"]').count()) === 4);
  await page.getByRole("button", { name: "필터 초기화" }).click();
});

// ───────── S8
await story("S8 행 펼침·순위에서 이동", async () => {
  await T("toggle-J").click();
  const j = await text("detail-J");
  check("J 펼침: 공사기간 2024-02-05 ~ 2026-12-31", j.includes("2024-02-05") && j.includes("2026-12-31"), j);
  check("J 펼침: 기록된 상황·계획된 대응·기성 확인", j.includes("기록된 상황") && j.includes("계획된 대응") && j.includes("기성 확인"));
  check("J 펼침: 계약상 준공일은 예정일 안내", j.includes("실제 완료일이 아닙니다"));
  await T("toggle-J").click();
  check("다시 누르면 접힘", (await T("detail-J").count()) === 0);
  await T("toggle-J").click(); // 열어 둔 채 이동해서 '다른 줄은 접힘'을 확인
  await nav("현황 요약");
  await T("rank-row-D").click();
  await T("compare-table").waitFor();
  await T("detail-D").waitFor();
  check("D 줄 클릭 → 비교표로 이동", page.url().endsWith("/compare"));
  check("D 줄 강조", (await T("compare-row-D").getAttribute("data-focused")) === "true");
  check("D 기록 펼침(공급 정상화)", (await text("detail-D")).includes("공급 정상화"));
  check("다른 줄(J)은 접힘", (await T("detail-J").count()) === 0);
  await shot("s8-compare-focus-D");
});

// ───────── S9
await story("S9 CSV 내보내기", async () => {
  async function exportNow() {
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /CSV 내보내기/ }).click()]);
    const buf = readFileSync(await dl.path());
    return { buf, name: dl.suggestedFilename(), str: buf.toString("utf8") };
  }
  await setSite("D");
  let r = await exportNow();
  let lines = r.str.replace(/^﻿/, "").split("\r\n").filter(Boolean);
  check("D: UTF-8 BOM", r.buf[0] === 0xef && r.buf[1] === 0xbb && r.buf[2] === 0xbf);
  check("D: 데이터 1행 / 19개 열", lines.length === 2 && lines[0].split(",").length === 19, `${lines.length}줄`);
  check("D: 값 69.4 · -10.7 · 점검 · 3339.6", lines[1].endsWith(",69.4,-10.7,점검,3339.6"), lines[1].slice(-40));
  check("D: '1행을 내보냈습니다'", (await text("export-message")).includes("1행을 내보냈습니다"));
  check("D: 파일 이름", r.name === "현장공정기성_2026-09_D.csv", r.name);

  await setRegion("인천");
  await setType("공동주택");
  r = await exportNow();
  lines = r.str.replace(/^﻿/, "").split("\r\n").filter(Boolean);
  check("인천·공동주택: 데이터 2행(A·G)", lines.length === 3 && lines[1].split(",")[1] === "A" && lines[2].split(",")[1] === "G");

  await page.getByRole("button", { name: "필터 초기화" }).click();
  await setMonth("2025-10");
  r = await exportNow();
  lines = r.str.replace(/^﻿/, "").split("\r\n").filter(Boolean);
  check("2025-10 전체: 12행, 당월기성액 칸 '계산 불가'", lines.length === 13 && lines.slice(1).every((l) => l.endsWith(",계산 불가")));
  await setMonth("2026-09");
  await setSite("D");
  await exportNow();
  await setMonth("2026-08");
  check("필터를 바꾸면 이전 내보내기 안내가 사라짐", (await T("export-message").count()) === 0);
  await page.getByRole("button", { name: "필터 초기화" }).click();
});

// ───────── S10
await story("S10 AI 화면 범위·예시 질문", async () => {
  await nav("AI에게 묻기");
  await T("ask-page").waitFor();
  check("현재 분석 범위 글", (await text("ask-scope")).includes("2026년 9월 · 전체 지역 · 전체 공사유형 (12개 현장)"), await text("ask-scope"));
  for (let i = 1; i <= 5; i++) check(`예시 질문 ${i}`, (await T(`example-${i}`).count()) === 1);
  check("빈 입력은 보낼 수 없음", await T("ask-submit").isDisabled());
  await T("ask-input").fill("가".repeat(501));
  check("501자는 '500자 이내로 입력해 주세요'", (await text("too-long")).includes("500자 이내") && (await T("ask-submit").isDisabled()));
  await T("ask-input").fill("");
  await shot("s10-ask-empty");
});

// ───────── S12 (가짜 응답으로 대기·실패·범위 변경 확인)
await story("S12 AI 대기·실패·필터 변경", async () => {
  const okBody = { ok: true, answer: "[시험용 답변] 기록에 따르면 지연이 남아 있습니다.", citedSites: [{ siteId: "D", month: "2026-09", fields: ["issueSummary"] }], notInData: false };
  // (a) 늦게 도착하는 응답
  await page.route("**/api/ask", async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(okBody) }).catch(() => {});
  });
  await T("example-1").click();
  await T("ai-pending").waitFor();
  check("'기다리는 중' 표시", (await text("ai-pending")).includes("기다리는 중"));
  check("대기 중에는 질문 버튼이 막힘", await T("example-2").isDisabled());
  await nav("현황 요약");
  await setMonth("2026-08"); // 질문한 범위(9월)에서 벗어남
  await nav("AI에게 묻기");
  await T("ask-page").waitFor();
  check("월을 바꾸고 돌아오면 이전 질문·답변이 사라짐", (await T("ai-item").count()) === 0 && (await T("ai-empty").count()) === 1);
  await page.waitForTimeout(3500);
  check("늦게 도착한 응답이 새 범위에 나타나지 않음", (await T("ai-item").count()) === 0);
  await page.unroute("**/api/ask");

  // (b) 연결 실패 안내
  for (const [code, status, word] of [["RATE_LIMIT", 429, "한도"], ["TIMEOUT", 504, "시간 초과"], ["NO_KEY", 503, "키"], ["UPSTREAM", 502, "연결 문제"]]) {
    await page.route("**/api/ask", (route) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ ok: false, code }) }));
    await T("example-1").click();
    await T("ai-error").waitFor();
    const t = await text("ai-error");
    check(`실패(${code}): 원인 안내 + '대시보드와 CSV는 계속 쓸 수 있습니다'`, t.includes(word) && t.includes("대시보드와 CSV는 계속 쓸 수 있습니다"), t);
    await page.unroute("**/api/ask");
    await T("ask-input").fill("");
    await page.getByRole("button", { name: "대화 초기화" }).click();
  }
  // 실패해도 다른 기능 동작
  await page.route("**/api/ask", (route) => route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ ok: false, code: "UPSTREAM" }) }));
  await T("example-1").click();
  await T("ai-error").waitFor();
  await nav("현황 요약");
  check("AI 실패 뒤에도 현황 숫자 표시(8월 62.7%)", (await text("kpi-earned-rate")) === "62.7%");
  await page.getByRole("button", { name: "필터 초기화" }).click();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /CSV 내보내기/ }).click()]);
  check("AI 실패 뒤에도 CSV 내보내기 동작", (await dl.suggestedFilename()).endsWith(".csv"));
  await page.unroute("**/api/ask");
  await shot("s12-after-fail");
});

// ───────── S11 (실제 Gemini 호출)
if (REAL_AI) {
  await story("S11 실제 AI 질문 (Gemini)", async () => {
    await setSite("D");
    await nav("AI에게 묻기");
    await T("example-1").click();
    await T("ai-answer").or(T("ai-error")).waitFor({ timeout: 60000 });
    if ((await T("ai-error").count()) > 0) {
      check("실제 AI 호출 성공", false, await text("ai-error"));
    } else {
      const a = await text("ai-answer");
      check("실제 AI: 답변이 왔다(모의 응답 표시 없음)", (await T("mock-badge").count()) === 0 && a.length > 20, a.slice(0, 120));
      const ev = (await T("evidence").count()) > 0 ? await text("evidence") : "";
      check("근거: 기준 월 2026-09 · 현장 D · 86.5% · 75.8% · -10.7pp · 69.4%", ["2026-09", "현장 D", "86.5%", "75.8%", "-10.7pp", "69.4%"].every((x) => ev.includes(x)), ev.slice(0, 200));
      console.log("  (참고) 답변 앞부분:", norm(await T("ai-answer-text").innerText()).slice(0, 220));
      await shot("s11-ai-answer-D");
    }
    await T("example-5").click();
    await page.locator('[data-testid="ai-item"]').nth(1).locator('[data-testid="ai-answer"], [data-testid="ai-error"]').waitFor({ timeout: 60000 });
    const second = page.locator('[data-testid="ai-item"]').nth(1);
    if ((await second.locator('[data-testid="ai-error"]').count()) > 0) {
      check("실제 AI(준공일·미수금) 성공", false, norm(await second.innerText()).slice(0, 160));
    } else {
      const t = norm(await second.innerText());
      check("실제 AI: '자료에 없음' 표시와 계약상 준공일 안내", t.includes("자료에 없음") && t.includes("계약상 준공일"), t.slice(0, 200));
      console.log("  (참고) 두 번째 답변 앞부분:", t.slice(0, 260));
      await shot("s11-ai-answer-notindata");
    }
  });
}

check("브라우저 콘솔·페이지 오류 없음", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n=== 화면 점검 결과: ${results.length - failed.length}/${results.length} 통과 ===`);
for (const f of failed) console.log(`  실패: [${f.story}] ${f.name} — ${f.detail}`);
process.exit(failed.length > 0 ? 1 : 0);
