import Link from "next/link";
import { ScanForm } from "./scan-form";
import "./scan.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "새 쇼핑몰 진단 신청 | 바로미",
  robots: { index: false, follow: false },
};

export default function NewScanPage() {
  return (
    <div className="scan-page">
      {/* Topbar */}
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
              서비스 소개로 돌아가기
            </Link>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <main className="scan-layout">
        <div className="scan-heading">
          <span className="scan-heading-tag">NEW AUDIT SESSION</span>
          <h1>내 쇼핑몰 사전 점검 신청</h1>
          <p>고객이 마주하는 상품 노출부터 주문서까지의 결제 흐름을 안전하게 실측합니다.</p>
        </div>

        <div className="scan-columns">
          {/* Left Panel: The Clean Form */}
          <section className="scan-panel">
            <h2>점검 환경 및 옵션 설정</h2>
            <ScanForm />
          </section>

          {/* Right Aside: Inspection Scope Guide */}
          <aside className="scan-aside">
            <div className="scan-aside-head">
              <span>바로미 사전 점검 원칙</span>
            </div>

            <div className="scan-aside-item">
              <span className="scan-aside-num">CHECK 01</span>
              <div className="scan-aside-title">기본 선택 유료 옵션</div>
              <p className="scan-aside-desc">소비자의 의도와 무관하게 장바구니에 몰래 체크된 유료 부가상품을 찾아냅니다.</p>
            </div>

            <div className="scan-aside-item">
              <span className="scan-aside-num">CHECK 02</span>
              <div className="scan-aside-title">순차공개 가격 차이</div>
              <p className="scan-aside-desc">첫 상품 화면에서 숨겨져 있다가 결제 직전에 갑자기 붙는 필수 비용을 기록합니다.</p>
            </div>

            <div className="scan-aside-item">
              <span className="scan-aside-num">CHECK 03</span>
              <div className="scan-aside-title">100% 결제 실행 차단</div>
              <p className="scan-aside-desc">실제 주문 확정과 결제 승인은 원천적으로 클릭하지 않으므로 안심하고 점검할 수 있습니다.</p>
            </div>

            <div className="scan-aside-note">
              본 진단 결과는 법률 위반 확정이 아닌 공정거래위원회 심사지침 기준의 사전 점검 위험 신호입니다.
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
