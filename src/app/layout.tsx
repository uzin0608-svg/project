import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { DashboardProvider } from "@/state/DashboardProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "현장별 공정·기성 대시보드",
  description: "교육용 가상 자료로 현장별 공정·기성 현황을 보고 점검이 필요한 현장을 찾습니다.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <DashboardProvider>
          <AppHeader />
          <main className="mx-auto w-full max-w-[1440px] px-4 pb-10 md:px-7">{children}</main>
          <footer className="mx-auto w-full max-w-[1440px] border-t border-slate-200 px-4 py-4 text-xs text-slate-500 md:px-7">
            교육용 가상 자료입니다. 현장명은 모두 가상이며 실제 회사의 계약·현장·실적을 나타내지 않습니다.
          </footer>
        </DashboardProvider>
      </body>
    </html>
  );
}
