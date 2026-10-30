import Link from "next/link";

/** 자료를 가져오기 전에 현황·비교표·AI 화면에 보여 주는 안내 */
export function NoDataState() {
  return (
    <section
      data-testid="no-data"
      className="mx-auto mt-16 max-w-xl rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm"
    >
      <h1 className="text-xl font-semibold text-slate-900">아직 가져온 자료가 없습니다</h1>
      <p className="mt-3 text-slate-600">
        자료 가져오기에서 CSV 또는 JSON 파일을 가져와 주세요. 새로고침하면 자료가 사라지므로 그때는 파일을 다시
        가져옵니다.
      </p>
      <Link
        href="/import"
        className="mt-6 inline-block rounded bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        자료 가져오기
      </Link>
    </section>
  );
}
