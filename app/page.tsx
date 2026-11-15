"use client";

import Link from "next/link";
import { AccountControl } from "./account-control";
import { useState } from "react";

// Clean SVG Icons (Zero Emoji, Precision 1.5px / 2px Stroke)
function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconAlertTriangle() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function IconShoppingBag() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function IconBarChart() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export default function Home() {
  const [activeStage, setActiveStage] = useState<number>(2); // 1: Product, 2: Cart, 3: Order
  
  // Interactive Toggle States inside Mockup
  const [optGift, setOptGift] = useState<boolean>(true);
  const [optFee, setOptFee] = useState<boolean>(true);

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const basePrice = 19900;
  const giftPrice = optGift ? 2500 : 0;
  const feePrice = optFee ? 3000 : 0;
  const currentTotal = activeStage === 1 ? basePrice : activeStage === 2 ? basePrice + giftPrice : basePrice + giftPrice + feePrice;

  return (
    <div style={{ background: "#ffffff", minHeight: "100vh" }}>
      {/* ── Global Header: Clean Service-wide Navigation ── */}
      <header className="cs-header">
        <div className="clean-wrap" style={{ width: "100%" }}>
          <div className="cs-header-inner">
            <Link href="/" className="cs-brand" style={{ display: "inline-flex", alignItems: "center" }}>
              <img
                src="/brand/baromi-logo.png"
                alt="바로미 - 쇼핑몰을 더 바르게"
                height={30}
                style={{ height: 30, width: "auto", objectFit: "contain", display: "block" }}
              />
            </Link>

            {/* 전역 페이지 네비게이션 (스크롤 시 중복되지 않는 핵심 서비스 메뉴) */}
            <nav className="cs-nav">
              <Link href="/about">서비스 소개</Link>
              <Link href="/method">분석 방법</Link>
              <Link href="/criteria">탐지 기준</Link>
              <Link href="/principles">안전 원칙</Link>
              <Link href="/shop/m.cafe24-sample.shop">상점 진단 이력</Link>
            </nav>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <AccountControl />
              <Link href="/report/sample" className="cs-btn-secondary">
                샘플 리포트
              </Link>
              <Link href="/scan/new" className="cs-btn-primary">
                무료 진단 시작
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ── Hero Showcase Section: Ambient Radial Glow & Interactive Simulation ── */}
      <section className="cs-hero">
        <div className="clean-wrap">
          <div className="cs-pill">
            <span className="cs-pill-badge">B2B SaaS</span>
            쇼핑몰을 더 바르게 · 2026 공정위 다크패턴 심사지침 사전 예방
          </div>

          <h1 className="cs-hero-title">
            쇼핑몰 배포 전, <span className="gradient-text">다크패턴 위험 신호</span>를<br />
            3분 만에 객관적 근거와 함께 사전 점검
          </h1>

          <p className="cs-hero-desc">
            유료 옵션 기본 체크, 주문서 단계의 숨은 비용처럼 손님이 구매하는 과정에서 발생하는
            다크패턴 신호를 실제 브라우저로 안전하게 탐색하고, 관리자 개선 가이드를 제공합니다.
          </p>

          <div className="cs-hero-actions">
            <Link href="/scan/new" className="cs-btn-primary" style={{ padding: "12px 24px", fontSize: 14.5 }}>
              지금 무료로 진단 시작하기
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <Link href="/report/sample" className="cs-btn-secondary" style={{ padding: "12px 20px", fontSize: 14.5 }}>
              실제 진단 리포트 미리보기
            </Link>
          </div>

          {/* 6개 주요 이커머스 호환 뱃지 */}
          <div className="cs-platforms-strip">
            <span style={{ color: "var(--text-sub)", fontSize: 12 }}>표준 호환 지원:</span>
            <span className="cs-platform-pill">카페24 (Cafe24)</span>
            <span className="cs-platform-pill">네이버 스마트스토어</span>
            <span className="cs-platform-pill">고도몰 (GodoMall)</span>
            <span className="cs-platform-pill">메이크샵 (MakeShop)</span>
            <span className="cs-platform-pill">아임웹 (Imweb)</span>
            <span className="cs-platform-pill">Shopify</span>
          </div>

          {/* ── Live Interactive Inspector Window (Zero Emoji, Precision UI) ── */}
          <div className="cs-showcase-card">
            {/* Window Titlebar */}
            <div className="cs-showcase-bar">
              <div className="cs-showcase-dots">
                <div className="cs-showcase-dot" style={{ background: "#f87171" }} />
                <div className="cs-showcase-dot" style={{ background: "#fbbf24" }} />
                <div className="cs-showcase-dot" style={{ background: "#34d399" }} />
              </div>
              <div className="cs-showcase-url">
                https://m.your-shop.co.kr/products/signature-tee
              </div>
              <div className="cs-showcase-engine">
                Playwright 샌드박스 안전 점검 모드 가동 중
              </div>
            </div>

            {/* Stage Step Tabs */}
            <div className="cs-stage-tabs">
              <button
                type="button"
                className={`cs-stage-tab ${activeStage === 1 ? "active" : ""}`}
                onClick={() => setActiveStage(1)}
              >
                <span className="cs-stage-idx" style={{ color: "var(--emerald)" }}>
                  STAGE 01 · 정상 관측
                </span>
                <div className="cs-stage-heading">
                  <span>상품 상세 보기</span>
                  <span className="tabular" style={{ color: "var(--text-main)" }}>19,900원</span>
                </div>
              </button>

              <button
                type="button"
                className={`cs-stage-tab ${activeStage === 2 ? "active" : ""}`}
                onClick={() => setActiveStage(2)}
              >
                <span className="cs-stage-idx" style={{ color: optGift ? "var(--rose)" : "var(--emerald)" }}>
                  STAGE 02 · {optGift ? "위험 의심" : "정상"}
                </span>
                <div className="cs-stage-heading">
                  <span>장바구니 담기</span>
                  <span className="tabular" style={{ color: optGift ? "var(--rose)" : "var(--emerald)" }}>
                    {optGift ? "22,400원 (+2,500원)" : "19,900원 (정상)"}
                  </span>
                </div>
              </button>

              <button
                type="button"
                className={`cs-stage-tab ${activeStage === 3 ? "active" : ""}`}
                onClick={() => setActiveStage(3)}
              >
                <span className="cs-stage-idx" style={{ color: optFee ? "var(--rose)" : "var(--emerald)" }}>
                  STAGE 03 · {optFee ? "위험 의심" : "정상"}
                </span>
                <div className="cs-stage-heading">
                  <span>주문서 작성</span>
                  <span className="tabular" style={{ color: optFee ? "var(--rose)" : "var(--emerald)" }}>
                    {optFee ? "25,400원 (+3,000원)" : "22,400원 (정상)"}
                  </span>
                </div>
              </button>
            </div>

            {/* Showcase Body */}
            <div className="cs-showcase-body">
              {/* Left Column: Viewport State */}
              <div className="cs-showcase-viewport">
                <div className="cs-item-card">
                  <span className="cs-item-tag">SAMPLE PRODUCT 01</span>
                  <div className="cs-item-title">시그니처 코튼 오버핏 반팔 티셔츠 (Black / L)</div>
                  <div className="cs-item-sub">손님이 처음 고른 기본 규격 단품</div>
                  <div className="cs-item-price tabular">기본 판매가: 19,900원</div>
                </div>

                {activeStage === 1 && (
                  <div style={{ padding: "32px 18px", color: "var(--text-muted)", fontSize: 13.5, textAlign: "center", background: "#fff", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                    상품 화면 정상: 표시 판매가 19,900원과 기본 선택 상태가 일치합니다.
                  </div>
                )}

                {activeStage === 2 && (
                  <div className={`cs-alert-box ${!optGift ? "cleared" : ""}`}>
                    <span className={`cs-alert-badge ${!optGift ? "cleared" : ""}`}>
                      {optGift ? <IconAlertTriangle /> : <IconCheck />}
                      {optGift ? "공정위 점검 권고 신호" : "안심 (체크 해제됨)"}
                    </span>
                    <div className="cs-alert-row">
                      <span>
                        친환경 선물 포장 박스
                        <button
                          type="button"
                          className="cs-toggle-btn"
                          onClick={() => setOptGift(!optGift)}
                        >
                          {optGift ? "옵션 해제해보기" : "옵션 다시 켜기"}
                        </button>
                      </span>
                      <strong className="tabular" style={{ color: optGift ? "var(--rose)" : "var(--emerald)" }}>
                        {optGift ? "+2,500원" : "0원"}
                      </strong>
                    </div>
                    <div className="cs-alert-code">
                      {optGift ? (
                        <><strong>점검 사유:</strong> 손님이 직접 선택하지 않았음에도 장바구니에 유료 옵션이 기본 체크되어 결제 금액이 증가합니다.</>
                      ) : (
                        <><strong>개선 완료:</strong> 손님이 직접 원할 때만 체크하도록 변경하여 다크패턴 위험을 제거했습니다.</>
                      )}
                    </div>
                  </div>
                )}

                {activeStage === 3 && (
                  <div className={`cs-alert-box ${!optFee ? "cleared" : ""}`}>
                    <span className={`cs-alert-badge ${!optFee ? "cleared" : ""}`}>
                      {optFee ? <IconAlertTriangle /> : <IconCheck />}
                      {optFee ? "공정위 점검 권고 신호" : "안심 (사전 고지 완료)"}
                    </span>
                    <div className="cs-alert-row">
                      <span>
                        결제 시스템 처리 수수료
                        <button
                          type="button"
                          className="cs-toggle-btn"
                          onClick={() => setOptFee(!optFee)}
                        >
                          {optFee ? "첫 화면 사전고지 적용해보기" : "사전고지 해제"}
                        </button>
                      </span>
                      <strong className="tabular" style={{ color: optFee ? "var(--rose)" : "var(--emerald)" }}>
                        {optFee ? "+3,000원" : "0원 (포함 고지)"}
                      </strong>
                    </div>
                    <div className="cs-alert-code">
                      {optFee ? (
                        <><strong>점검 사유:</strong> 첫 상품 화면에서는 안내되지 않던 필수 비용이 주문서 단계에서 추가되어 순차공개 가격책정 위험이 발생합니다.</>
                      ) : (
                        <><strong>개선 완료:</strong> 상품 상세 첫 화면에 해당 비용을 명시하여 순차공개 위험을 방어했습니다.</>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Ledger Diff & Guide */}
              <div className="cs-showcase-ledger">
                <div className="cs-ledger-caption">
                  <span>손님 결제 예정 금액 대조</span>
                  <span style={{ color: "var(--emerald)", fontSize: 11.5, fontWeight: 600 }}>금액 실측 완료</span>
                </div>

                <div className="cs-diff-table">
                  <div className="cs-diff-row">
                    <span>첫 상품 화면 표시가</span>
                    <span className="tabular">19,900원</span>
                  </div>
                  {activeStage >= 2 && (
                    <div className={`cs-diff-row ${optGift ? "warn" : "cleared-row"}`}>
                      <span>{optGift ? "기본 선택된 유료 옵션" : "체크 해제된 옵션"}</span>
                      <span className="tabular">{optGift ? "+2,500원" : "0원"}</span>
                    </div>
                  )}
                  {activeStage === 3 && (
                    <div className={`cs-diff-row ${optFee ? "warn" : "cleared-row"}`}>
                      <span>{optFee ? "주문서 단계 추가 비용" : "사전 고지된 비용"}</span>
                      <span className="tabular">{optFee ? "+3,000원" : "0원"}</span>
                    </div>
                  )}
                  <div className="cs-diff-row sum">
                    <span>최종 결제 예상 금액</span>
                    <span className="tabular" style={{ color: (activeStage === 2 && optGift) || (activeStage === 3 && optFee) ? "var(--rose)" : "var(--emerald)" }}>
                      {currentTotal.toLocaleString()}원
                    </span>
                  </div>
                </div>

                <div className="cs-guide-box">
                  <div className="cs-guide-head">
                    <IconInfo /> 권장 조치 가이드
                  </div>
                  <div className="cs-guide-text">
                    {activeStage === 1 && "현재 상품 페이지의 가격 노출 방식은 공정위 지침에 부합합니다."}
                    {activeStage === 2 && (
                      optGift
                        ? "쇼핑몰 관리자 페이지에서 해당 유료 옵션의 '기본 선택' 설정을 끄고, 소비자가 직접 선택할 때만 요금이 발생하도록 수정하세요."
                        : "설정 변경 완료: 손님이 직접 체크할 때만 추가 요금이 반영되도록 올바르게 구성되었습니다."
                    )}
                    {activeStage === 3 && (
                      optFee
                        ? "주문에 반드시 수반되는 비용이라면, 상품 상세 첫 노출 시점에 총비용을 함께 고지해야 안전합니다."
                        : "설정 변경 완료: 필수 비용이 최초 노출 단계에 투명하게 명시되었습니다."
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section Chapter Anchor Bar (NOT STICKY: 스크롤 시 화면 겹침 완전 방지) ── */}
      <nav className="cs-index-bar" aria-label="본문 바로가기">
        <div className="clean-wrap">
          <div className="cs-index-nav">
            <a href="#why" className="cs-index-link">01. 서비스 가치</a>
            <a href="#engine" className="cs-index-link">02. 점검 방식</a>
            <a href="#ledger" className="cs-index-link">03. 금액 비교 원장</a>
            <a href="#standards" className="cs-index-link">04. 공정위 기준 안내</a>
            <a href="#compare" className="cs-index-link">05. 수동 점검 비교</a>
            <a href="#faq" className="cs-index-link">06. 자주 묻는 질문</a>
            <a href="#safety" className="cs-index-link">07. 안심 원칙</a>
          </div>
        </div>
      </nav>

      {/* ── Section 01: Why Baromi ── */}
      <section id="why" className="cs-section">
        <div className="clean-wrap">
          <div className="cs-section-header">
            <span className="tag">01. Why Baromi</span>
            <h2>바쁜 운영자가 직접 챙기기 어려운 결제 흐름</h2>
            <p>다크패턴 문제는 첫 화면이 아니라, 손님이 장바구니를 거쳐 주문서로 넘어가는 단계 사이에서 발생합니다.</p>
          </div>

          <div className="cs-bento-3">
            <div className="cs-bento-card">
              <div className="cs-bento-icon icon-indigo">
                <IconShoppingBag />
              </div>
              <h3>장바구니와 주문서 사이의 사각지대</h3>
              <p>상품 목록만 봐서는 유료 옵션이 강제로 체크되어 있는지, 숨겨진 배송비나 수수료가 붙는지 알 수 없습니다.</p>
              <div className="cs-micro-pipeline">
                <span>상품 상세</span>
                <span>→</span>
                <span style={{ color: "var(--rose)", fontWeight: 700 }}>장바구니 (변동)</span>
                <span>→</span>
                <span>주문서</span>
              </div>
            </div>

            <div className="cs-bento-card">
              <div className="cs-bento-icon icon-cyan">
                <IconBarChart />
              </div>
              <h3>반복 수동 점검의 한계 극복</h3>
              <p>상품 하나 바꿀 때마다 모바일과 PC를 번갈아가며 실제 장바구니에 담아보고 주문서를 확인하기는 현실적으로 어렵습니다.</p>
              <div className="cs-micro-pipeline">
                <span className="cs-node-pill">수동 25분</span>
                <span>vs</span>
                <span className="cs-node-pill active">바로미 3분 자동화</span>
              </div>
            </div>

            <div className="cs-bento-card">
              <div className="cs-bento-icon icon-violet">
                <IconCamera />
              </div>
              <h3>주관적 판단이 아닌 100% 화면 증거</h3>
              <p>“문제 있어 보입니다” 식의 애매한 지적이 아닌, 실제 캡처된 스크린샷과 요소의 좌표(x, y)를 객관적 근거로 남깁니다.</p>
              <div className="cs-micro-pipeline">
                <span>실제 캡처 스냅샷</span>
                <span>+</span>
                <span>공정위 심사 조항</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 02: Engine ── */}
      <section id="engine" className="cs-section cs-section-alt">
        <div className="clean-wrap">
          <div className="cs-section-header">
            <span className="tag">02. Inspection Engine</span>
            <h2>사람의 시선으로 보되, 오차 없이 기록합니다</h2>
            <p>실제 브라우저 환경에서 쇼핑몰의 공개 상품을 열고, 주문 직전까지의 동적 여정을 따라갑니다.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {[
              { step: "01", title: "안전 점검 시작", desc: "공개 HTTPS 주소 검증 및 내부망/비공개 주소 접근 차단" },
              { step: "02", title: "동적 화면 렌더링", desc: "한국어/서울 시간대/표준 모바일 해상도의 격리 세션 생성" },
              { step: "03", title: "옵션 & 금액 원장 추출", desc: "페이지별 표시가, 선택된 옵션의 추가금, 배송비 일렬 추출" },
              { step: "04", title: "결정론적 규칙 판정", desc: "공정위 심사지침 기준 위반 여부를 100% 코드로 정밀 판정" },
            ].map((s) => (
              <div key={s.step} style={{ background: "#ffffff", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: 22 }}>
                <span className="tabular" style={{ fontSize: 13, fontWeight: 800, color: "var(--primary)", fontFamily: "var(--font-mono)" }}>
                  STEP {s.step}
                </span>
                <h4 style={{ fontSize: 15, fontWeight: 700, margin: "8px 0 6px", color: "var(--text-main)" }}>
                  {s.title}
                </h4>
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, lineHeight: 1.6 }}>
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 03: Ledger ── */}
      <section id="ledger" className="cs-section">
        <div className="clean-wrap">
          <div className="cs-section-header">
            <span className="tag">03. Price Ledger</span>
            <h2>첫 화면 가격과 마지막 결제 금액의 연속성 검증</h2>
            <p>손님이 처음 본 가격과 결제 직전의 금액이 왜 달라졌는지, 원장(Ledger) 형태로 투명하게 대조합니다.</p>
          </div>

          <div className="cs-ledger-split">
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-main)", margin: "0 0 14px" }}>
                다크패턴은 단계 사이의 불일치에서 발생합니다
              </h3>
              <p style={{ fontSize: 14.5, color: "var(--text-muted)", lineHeight: 1.7, margin: "0 0 16px" }}>
                단일 페이지만 검사하는 도구는 장바구니에서 유료 옵션이 몰래 체크되거나, 주문서에서 필수 수수료가 새로 생기는 문제를 잡아낼 수 없습니다.
              </p>
              <p style={{ fontSize: 14.5, color: "var(--text-muted)", lineHeight: 1.7, margin: "0 0 24px" }}>
                바로미는 단계마다 결제 예상 금액을 한 줄로 이어서 기록하므로, 소비자가 알아채기 힘든 숨겨진 가격 인상을 1원 단위로 식별합니다.
              </p>
              <Link href="/scan/new" className="cs-btn-primary">
                내 쇼핑몰 금액 원장 점검하기 →
              </Link>
            </div>

            <div className="cs-receipt-card">
              <div className="cs-receipt-head">
                <span>단계별 가격 변동 실측 원장</span>
                <span style={{ color: "var(--rose)", fontSize: 12, fontWeight: 600 }}>순차공개 위험 관측</span>
              </div>
              <div style={{ padding: "16px 0", fontSize: 13.5 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-light)" }}>
                  <span style={{ color: "var(--text-muted)" }}>1. 상품 상세 표시가</span>
                  <span className="tabular" style={{ fontWeight: 600 }}>19,900원</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-light)", color: "var(--rose)" }}>
                  <span>2. 기본 체크된 포장 옵션</span>
                  <span className="tabular" style={{ fontWeight: 700 }}>+2,500원</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-light)", color: "var(--rose)" }}>
                  <span>3. 주문서 미고지 처리 수수료</span>
                  <span className="tabular" style={{ fontWeight: 700 }}>+3,000원</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 14, fontSize: 15, fontWeight: 800, color: "var(--text-main)" }}>
                  <span>최종 청구 금액</span>
                  <span className="tabular" style={{ color: "var(--rose)" }}>25,400원 (+5,500원 증가)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 04: Standards ── */}
      <section id="standards" className="cs-section cs-section-alt">
        <div className="clean-wrap">
          <div className="cs-section-header">
            <span className="tag">04. Legal Criteria</span>
            <h2>공정위 심사지침 기준의 4가지 상태 체계</h2>
            <p>모호한 흑백 논리를 배제하고, 객관적으로 측정된 사실에 따라 명확히 구분합니다.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {[
              {
                title: "위험 신호 (Suspected)",
                color: "var(--rose)",
                bg: "var(--rose-light)",
                border: "var(--rose-border)",
                desc: "공정위 심사지침 금지 규칙 조건을 객관적 화면 증거로 충족한 상태",
              },
              {
                title: "검토 필요 (Review)",
                color: "var(--amber)",
                bg: "var(--amber-light)",
                border: "var(--amber-border)",
                desc: "조건부 할인이나 규격 차이 등 운영자의 맥락 확인이 필요한 상태",
              },
              {
                title: "미검사 (Untested)",
                color: "var(--text-muted)",
                bg: "var(--bg-subtle-2)",
                border: "var(--border-subtle)",
                desc: "로그인 필요나 캡차 등으로 인해 해당 단계에 도달하지 못한 상태",
              },
              {
                title: "관측 없음 (Safe)",
                color: "var(--emerald)",
                bg: "var(--emerald-light)",
                border: "var(--emerald-border)",
                desc: "검사 범위 내에서 해당 규칙의 위험 조건이 관측되지 않은 상태",
              },
            ].map((item) => (
              <div key={item.title} style={{ background: "#ffffff", border: `1px solid ${item.border}`, borderRadius: 12, padding: 22 }}>
                <span style={{ display: "inline-block", fontSize: 12, fontWeight: 700, color: item.color, background: item.bg, padding: "2px 8px", borderRadius: 4, marginBottom: 10 }}>
                  {item.title}
                </span>
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, lineHeight: 1.6 }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 05: Comparison ── */}
      <section id="compare" className="cs-section">
        <div className="clean-wrap">
          <div className="cs-section-header">
            <span className="tag">05. Comparison</span>
            <h2>수동 점검 vs 바로미 자동 사전 점검</h2>
            <p>시간 소모와 인적 실수를 줄이고, 재현 가능한 원장 리포트를 확보하세요.</p>
          </div>

          <table className="cs-compare-table">
            <thead>
              <tr>
                <th style={{ width: "25%" }}>비교 항목</th>
                <th style={{ width: "37.5%" }}>기존 수동 점검 (엑셀 / 수기)</th>
                <th className="highlight-col" style={{ width: "37.5%" }}>바로미 자동 사전 점검</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>점검 소요 시간</td>
                <td><span className="cs-badge-bad">상품당 25분 이상 소요</span></td>
                <td className="highlight-col"><span className="cs-badge-good">전체 흐름 3분 내 자동 완료</span></td>
              </tr>
              <tr>
                <td>점검 환경 일관성</td>
                <td><span className="cs-badge-bad">담당자 기기 및 쿠키 상태에 따라 다름</span></td>
                <td className="highlight-col"><span className="cs-badge-good">초기화된 클린 세션에서 표준 해상도로 일관 측정</span></td>
              </tr>
              <tr>
                <td>증거 확보 방식</td>
                <td><span className="cs-badge-bad">수기 캡처 및 주관적 코멘트</span></td>
                <td className="highlight-col"><span className="cs-badge-good">요소 픽셀 좌표(x, y) + 스냅샷 + 증거 ID 부여</span></td>
              </tr>
              <tr>
                <td>수정 후 재검사</td>
                <td><span className="cs-badge-bad">처음부터 다시 모든 단계 수동 반복</span></td>
                <td className="highlight-col"><span className="cs-badge-good">[즉시 재검사] 1클릭으로 신규/해결 Diff 자동 대조</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Section 06: FAQ ── */}
      <section id="faq" className="cs-section cs-section-alt">
        <div className="clean-wrap">
          <div className="cs-section-header">
            <span className="tag">06. FAQ</span>
            <h2>쇼핑몰 사장님들이 자주 묻는 질문</h2>
            <p>궁금한 점을 미리 확인하고 안심하고 이용하세요.</p>
          </div>

          <div className="cs-faq-grid">
            {[
              {
                q: "진단 중 실제로 주문이나 결제가 발생하나요?",
                a: "절대 발생하지 않습니다. 바로미의 자동화 엔진은 최종 주문 확정, 결제 승인, 회원 탈퇴 등의 확정 버튼을 감지하여 실행 전에 원천 차단합니다. 사장님의 실제 매출이나 재고 변동이 일어나지 않습니다.",
              },
              {
                q: "법률 위반 여부를 확정 판정해 주는 건가요?",
                a: "아닙니다. 바로미의 결과는 공정거래위원회 심사지침 기준의 ‘위험 신호’입니다. 법률 자문이나 법적 무결성을 보증하지 않으므로, 최종 법률 판단이 필요한 사안은 전문가의 검토를 권장합니다.",
              },
              {
                q: "어떤 쇼핑몰 솔루션에서 사용할 수 있나요?",
                a: "카페24, 스마트스토어, 고도몰, 메이크샵, 아임웹, 쇼피파이 등 공개된 HTTPS 웹사이트 주소를 가진 모든 이커머스에서 점검할 수 있습니다.",
              },
              {
                q: "재검사 시 이전 결과와 무엇이 달라졌는지 알 수 있나요?",
                a: "네, 동일한 조건으로 재검사를 진행하면 이전에 관측된 위험 항목이 해소되었는지(해결됨), 여전히 남아있는지(반복됨), 새로운 위험이 생겼는지(신규)를 회차별 원장으로 비교해 드립니다.",
              },
            ].map((faq, idx) => (
              <div
                key={faq.q}
                className="cs-faq-item"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
              >
                <div className="cs-faq-q">
                  <span>{faq.q}</span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ transform: openFaq === idx ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
                {openFaq === idx && <div className="cs-faq-a">{faq.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 07: Safety Principles ── */}
      <section id="safety" className="cs-section">
        <div className="clean-wrap">
          <div className="cs-section-header">
            <span className="tag">07. Safety Principles</span>
            <h2>바로미의 4대 안심 원칙</h2>
            <p>안심하고 진단받으실 수 있도록 기본 원칙을 엄격하게 준수합니다.</p>
          </div>

          <div className="cs-safety-grid">
            <div className="cs-safety-box">
              <span className="cs-safety-num">PRINCIPLE 01</span>
              <h4>실제 결제 원천 차단</h4>
              <p>최종 결제 승인 및 주문 확정 버튼은 감지 즉시 안전 차단되어 실결제가 일어나지 않습니다.</p>
            </div>
            <div className="cs-safety-box">
              <span className="cs-safety-num">PRINCIPLE 02</span>
              <h4>비침습적 탐색</h4>
              <p>일반 손님이 방문하는 공개 화면만 접근하며 사이트 내부 데이터를 변경하거나 훼손하지 않습니다.</p>
            </div>
            <div className="cs-safety-box">
              <span className="cs-safety-num">PRINCIPLE 03</span>
              <h4>세션 데이터 즉시 파기</h4>
              <p>진단 수행 중 생성된 임시 쿠키와 브라우저 세션은 분석 완료 즉시 영구 삭제됩니다.</p>
            </div>
            <div className="cs-safety-box">
              <span className="cs-safety-num">PRINCIPLE 04</span>
              <h4>미검사 상태 솔직 공개</h4>
              <p>로그인 제한 등으로 도달하지 못한 단계는 숨기지 않고 ‘미검사’로 투명하게 표시합니다.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="cs-final-cta">
        <div className="clean-wrap">
          <h2>배포하기 전에, 한 번만 먼저 점검하세요</h2>
          <p>공정거래위원회 다크패턴 심사지침에 저촉될 위험이 있는지 3분 안에 무료로 진단할 수 있습니다.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <Link href="/scan/new" className="cs-btn-primary" style={{ padding: "12px 28px", fontSize: 14.5 }}>
              내 쇼핑몰 무료 진단하기
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <Link href="/report/sample" className="cs-btn-secondary" style={{ padding: "12px 22px", fontSize: 14.5 }}>
              결과 리포트 샘플 보기
            </Link>
          </div>
        </div>
      </section>

      {/* ── Global Footer ── */}
      <footer className="cs-footer">
        <div className="clean-wrap">
          <div className="cs-footer-inner">
            <div>
              <Link href="/" className="cs-brand" style={{ marginBottom: 12, display: "inline-flex", alignItems: "center" }}>
                <img
                  src="/brand/baromi-logo.png"
                  alt="바로미"
                  height={26}
                  style={{ height: 26, width: "auto", objectFit: "contain", display: "block" }}
                />
              </Link>
              <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 13, maxWidth: 440, lineHeight: 1.6 }}>
                <strong>쇼핑몰을 더 바르게.</strong><br />
                소상공인을 위한 다크패턴 위험 자동 사전 진단·예방 솔루션입니다.
              </p>
            </div>
            <div className="cs-footer-links">
              <Link href="/about">서비스 소개</Link>
              <Link href="/method">분석 방법</Link>
              <Link href="/criteria">탐지 기준</Link>
              <Link href="/principles">안전 원칙</Link>
              <Link href="/login">로그인</Link>
              <Link href="/scan/new">진단 시작</Link>
            </div>
          </div>
          <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-sub)", lineHeight: 1.5 }}>
              바로미의 진단 결과는 법률 판정이 아닌 공정거래위원회 심사지침 기준의 위험 신호입니다. 실제 결제는 절대 일어나지 않습니다.
            </p>
            <span className="tabular" style={{ fontSize: 12, color: "var(--text-sub)" }}>
              © 2026 Baromi Labs. All rights reserved.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
