"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboard } from "@/state/DashboardProvider";

const NAV = [
  { href: "/", label: "현황 요약" },
  { href: "/compare", label: "현장별 비교표" },
  { href: "/ask", label: "AI에게 묻기" },
];

export function AppHeader() {
  const pathname = usePathname();
  const { state } = useDashboard();
  const { dataset } = state;
  const importActive = pathname === "/import";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 md:px-7">
        <Link href="/" className="text-lg font-bold text-slate-900">
          현장별 공정·기성 대시보드
        </Link>
        <nav className="flex flex-wrap items-center gap-1" aria-label="주요 화면">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded px-3 py-1.5 text-sm font-medium ${
                  active ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <span
            data-testid="data-chip"
            className="inline-flex items-center gap-1.5 rounded bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
          >
            <span className={`inline-block h-2 w-2 rounded-full ${dataset ? "bg-emerald-600" : "bg-slate-400"}`} />
            {dataset ? `${dataset.sites.length}개 현장 · ${dataset.records.length}행` : "자료 없음"}
          </span>
          <Link
            href="/import"
            aria-current={importActive ? "page" : undefined}
            className={`rounded border px-3 py-1.5 text-sm font-medium ${
              importActive
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            자료 가져오기
          </Link>
        </div>
      </div>
    </header>
  );
}
