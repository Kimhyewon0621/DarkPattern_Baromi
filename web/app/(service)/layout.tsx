import Link from "next/link";
import type { ReactNode } from "react";
import { SideNav } from "@/components/shell/SideNav";
import { Logo } from "@/components/ui/Logo";
import { isDemo } from "@/lib/api";

export default function ServiceLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a href="#main" className="skip-link">본문으로 건너뛰기</a>
      <div className="app">
        <aside className="side">
          <Link href="/" className="side__brand" aria-label="바로미 홈">
            <Logo height={28} />
          </Link>
          <SideNav />
          <div className="side__foot">
            <span style={{ fontSize: 13, fontWeight: 600 }}>{isDemo ? "예시 데이터로 보는 중" : "무료 진단"}</span>
            <span className="faint" style={{ fontSize: 13 }}>{isDemo ? "실제 쇼핑몰을 검사하지 않아요" : "기본 엔진 결과를 제공해요"}</span>
          </div>
        </aside>
        <main id="main" className="main">{children}</main>
      </div>
    </>
  );
}
