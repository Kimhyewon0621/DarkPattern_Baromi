import Link from "next/link";
import { ScanProgress } from "./scan-progress";
import "../new/scan.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "쇼핑몰 탐색 진행 현황 | 바로미",
  robots: { index: false, follow: false },
};

export default async function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="scan-page">
      <header className="scan-topbar">
        <div className="clean-wrap">
          <div className="scan-topbar-inner">
            <Link className="cs-brand" href="/" aria-label="바로미 홈" style={{ display: "inline-flex", alignItems: "center" }}>
              <img
                src="/brand/baromi-logo.png"
                alt="바로미"
                height={28}
                style={{ height: 28, width: "auto", objectFit: "contain", display: "block" }}
              />
            </Link>
            <Link className="cs-btn-secondary" href="/">
              메인으로
            </Link>
          </div>
        </div>
      </header>

      <main className="scan-layout">
        <div className="scan-heading" style={{ textAlign: "center", marginBottom: 32 }}>
          <span className="scan-heading-tag">LIVE AUDIT RUNNING</span>
          <h1>실시간 구매 여정 탐색 중</h1>
          <p>Playwright 가상 브라우저가 격리된 세션에서 상품 상세부터 주문서까지 안전하게 탐색하고 있습니다.</p>
        </div>

        <ScanProgress id={id} />
      </main>
    </div>
  );
}
