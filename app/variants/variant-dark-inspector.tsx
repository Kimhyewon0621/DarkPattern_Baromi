"use client";

import Link from "next/link";
import { useState } from "react";

export default function VariantDarkInspector() {
  const [activeStep, setActiveStep] = useState<number>(2); // 1: Product, 2: Cart, 3: Order
  const [urlInput, setUrlInput] = useState("https://sample-mall.co.kr/product/204");

  return (
    <div className="v-dark">
      {/* Header */}
      <header className="v-dark-header">
        <div className="v-dark-wrap">
          <div className="v-dark-header-inner">
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Link href="/" className="v-dark-brand">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="2" width="20" height="20" rx="6" fill="#a3e635" />
                  <path d="M7 12l3 3 7-7" stroke="#07090e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                BAROMI
              </Link>
              <span className="v-dark-badge">PLAYWRIGHT ENGINE 1.65 // ONLINE</span>
            </div>

            <nav className="v-dark-nav">
              <Link href="/about">Architecture</Link>
              <Link href="/method">Audit Protocol</Link>
              <Link href="/criteria">FTC Standard</Link>
              <Link href="/principles">Safety Guard</Link>
            </nav>

            <Link href="/scan/new" className="v-dark-btn-audit">
              Run Audit <span>→</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="v-dark-hero">
        <div className="v-dark-wrap">
          <div className="v-dark-hero-top">
            <div className="v-dark-pill">
              <span>● FTC 2026 GUIDELINE</span> Automated E-Commerce Risk Inspector
            </div>

            <h1 className="v-dark-title">
              <span className="v-dark-title-glow">구매 여정 속 숨은 다크패턴,</span>
              <br />
              <span className="v-dark-title-highlight">코드로 정밀 관측하고 방어합니다</span>
            </h1>

            <p className="v-dark-sub">
              단순 정적 화면 분석이 아닙니다. 실제 Playwright 헤드리스 브라우저가
              <strong> [상품 → 장바구니 → 주문서]</strong> 단계별 DOM 변화와 가격 원장을
              완전 격리 환경에서 추적해 재현 가능한 증거를 추출합니다.
            </p>

            <form className="v-dark-input-bar" action="/scan/new" method="get">
              <span className="v-dark-prompt-sym">baromi audit $</span>
              <input
                type="text"
                name="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://your-shopping-mall.co.kr"
                aria-label="Audit Target URL"
              />
              <button type="submit">
                Execute Scan <span>↵</span>
              </button>
            </form>
          </div>

          {/* Interactive Inspector HUD */}
          <div className="v-dark-inspector">
            <div className="v-dark-inspector-bar">
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div className="v-dark-dots">
                  <div className="v-dark-dot" />
                  <div className="v-dark-dot" />
                  <div className="v-dark-dot" />
                </div>
                <span>SESSION #463ea0f // HEADLESS CHROMIUM ACTIVE</span>
              </div>
              <div>COORDINATE INSPECTOR: 1280x800 @ko-KR</div>
            </div>

            <div className="v-dark-inspector-grid">
              {/* Left Pane: Journey Pipeline */}
              <div className="v-dark-pane-pipeline">
                <h4>Purchase Journey Stages</h4>

                <div
                  className={`v-dark-step-card ${activeStep === 1 ? "active" : ""}`}
                  onClick={() => setActiveStep(1)}
                >
                  <div className="step-head">
                    <span>STAGE 01</span>
                    <span>200 OK</span>
                  </div>
                  <div className="step-name">
                    <span>상품 상세</span>
                    <span className="step-price">₩19,900</span>
                  </div>
                </div>

                <div
                  className={`v-dark-step-card ${activeStep === 2 ? "active" : ""}`}
                  onClick={() => setActiveStep(2)}
                >
                  <div className="step-head">
                    <span>STAGE 02</span>
                    <span>MUTATION</span>
                  </div>
                  <div className="step-name">
                    <span>장바구니</span>
                    <span className="step-price">₩22,400</span>
                  </div>
                  <span className="step-tag">⚠️ PRE-SELECTED (+₩2,500)</span>
                </div>

                <div
                  className={`v-dark-step-card ${activeStep === 3 ? "active" : ""}`}
                  onClick={() => setActiveStep(3)}
                >
                  <div className="step-head">
                    <span>STAGE 03</span>
                    <span>ORDER FORM</span>
                  </div>
                  <div className="step-name">
                    <span>주문서 작성</span>
                    <span className="step-price">₩25,400</span>
                  </div>
                  <span className="step-tag">⚠️ DRIP PRICING (+₩3,000)</span>
                </div>
              </div>

              {/* Center Pane: Virtual Viewport Screen */}
              <div className="v-dark-pane-viewport">
                <div className="v-dark-viewport-screen">
                  <div className="v-dark-screen-header">
                    <span>VIEWPORT: {activeStep === 1 ? "/product/204" : activeStep === 2 ? "/cart" : "/order"}</span>
                    <span>FPS: 60 // DOM LISTENERS: ATTACHED</span>
                  </div>

                  <div className="v-dark-mock-shop">
                    <div className="v-dark-mock-row">
                      <span>[기본 상품] 프리미엄 코튼 오버핏 티셔츠 (Black / L)</span>
                      <strong>₩19,900</strong>
                    </div>

                    {activeStep >= 2 && (
                      <div className="v-dark-target-box">
                        <span className="v-dark-target-label">DETECTED: PRE-SELECTED OPTION</span>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ color: "#fbbf24", fontWeight: 600 }}>
                            ☑ 선물용 친환경 패키지 포장 (사전선택됨)
                          </span>
                          <strong style={{ color: "#fbbf24" }}>+₩2,500</strong>
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, fontFamily: "ui-monospace, monospace" }}>
                          Selector: input#opt_eco_pack[data-auto-check="true"]
                        </div>
                      </div>
                    )}

                    {activeStep === 3 && (
                      <div className="v-dark-target-box" style={{ borderColor: "#ef4444" }}>
                        <span className="v-dark-target-label" style={{ background: "#ef4444" }}>DETECTED: DRIP PRICING</span>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ color: "#f87171", fontWeight: 600 }}>
                            ⚠ 결제 시스템 처리 수수료 (최초 단계 미고지)
                          </span>
                          <strong style={{ color: "#f87171" }}>+₩3,000</strong>
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, fontFamily: "ui-monospace, monospace" }}>
                          Origin: API /api/v1/order/fees (Hidden in Stage 01)
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Pane: Ledger Diff Matrix */}
              <div className="v-dark-pane-ledger">
                <div className="v-dark-ledger-head">
                  <h4>Price Ledger Diff</h4>
                  <span style={{ fontSize: 11, color: "#a3e635", fontFamily: "ui-monospace, monospace" }}>SYNCHRONIZED</span>
                </div>

                <div className="v-dark-ledger-diff-box">
                  <div className="v-dark-diff-row">
                    <span>Base Display Price:</span>
                    <span>₩19,900</span>
                  </div>
                  <div className="v-dark-diff-row warn">
                    <span>Auto-selected Option:</span>
                    <span>+₩2,500</span>
                  </div>
                  {activeStep === 3 && (
                    <div className="v-dark-diff-row err">
                      <span>Late Disclosed Fee:</span>
                      <span>+₩3,000</span>
                    </div>
                  )}
                  <div style={{ height: 1, background: "rgba(255,255,255,0.1)", margin: "10px 0" }} />
                  <div className="v-dark-diff-row" style={{ color: "#fff", fontWeight: 700 }}>
                    <span>Observed Checkout:</span>
                    <span>₩{activeStep === 1 ? "19,900" : activeStep === 2 ? "22,400" : "25,400"}</span>
                  </div>
                </div>

                <div className="v-dark-verdict-card">
                  <div className="v-dark-verdict-title">AUDIT STATUS // ACTION REQUIRED</div>
                  <div className="v-dark-verdict-desc">
                    공정거래위원회 심사지침 기준 2건의 위험 신호가 포착되었습니다.
                    해당 옵션의 기본 체크 해제 및 최초 상품 화면의 가격 고지가 필요합니다.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
