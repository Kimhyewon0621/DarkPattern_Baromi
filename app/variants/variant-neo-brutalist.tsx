"use client";

import Link from "next/link";
import { useState } from "react";

export default function VariantNeoBrutalist() {
  const [optGift, setOptGift] = useState(true);
  const [optFee, setOptFee] = useState(true);

  const basePrice = 19900;
  const giftPrice = optGift ? 2500 : 0;
  const feePrice = optFee ? 3000 : 0;
  const totalPrice = basePrice + giftPrice + feePrice;

  return (
    <div className="v-brutal">
      {/* Header */}
      <header className="v-brutal-header">
        <div className="v-brutal-wrap">
          <div className="v-brutal-header-inner">
            <Link href="/" className="v-brutal-brand">
              <span className="v-brutal-brand-mark">✓</span>
              바로미.kr
            </Link>

            <nav className="v-brutal-nav">
              <Link href="/about">서비스 소개</Link>
              <Link href="/method">분석 방법</Link>
              <Link href="/criteria">공정위 기준</Link>
              <Link href="/principles">안전 원칙</Link>
            </nav>

            <Link href="/scan/new" className="v-brutal-header-cta">
              무료 진단하기 ⚡
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="v-brutal-hero">
        <div className="v-brutal-wrap">
          <div className="v-brutal-hero-grid">
            {/* Left Column */}
            <div>
              <div className="v-brutal-stickers">
                <span className="v-brutal-sticker s1">⚠️ 2026 공정위 지침 대비</span>
                <span className="v-brutal-sticker s2">🛡️ 실제 결제는 절대 안 눌러요!</span>
              </div>

              <h1 className="v-brutal-h1">
                쇼핑몰 속 <em>함정 버튼</em>,<br />
                바로미가 먼저<br />
                눌러 볼게요.
              </h1>

              <p className="v-brutal-lede">
                URL만 넣으면 <strong>[상품 → 장바구니 → 주문서]</strong>를 실제 손님처럼 따라가며,
                소비자 몰래 미리 체크된 추가 옵션과 뒤늦게 튀어나오는 필수 비용을
                증거 스크린샷과 함께 낱낱이 잡아냅니다.
              </p>

              <form className="v-brutal-urlbar" action="/scan/new" method="get">
                <input
                  type="text"
                  name="url"
                  placeholder="https://내쇼핑몰주소.com"
                  defaultValue="https://clean-shop.co.kr/item/1"
                  aria-label="쇼핑몰 URL 입력"
                />
                <button type="submit">진단 시작 →</button>
              </form>
            </div>

            {/* Right Column: Interactive Thermal Receipt Strip */}
            <div className="v-brutal-receipt-wrap">
              <div className="v-brutal-receipt">
                <div className="v-brutal-receipt-badge">실시간 인터랙티브 데모</div>

                <div className="v-brutal-receipt-title">
                  <span>RECEIPT #BAROMI-AUDIT</span>
                  <span>KRW (₩)</span>
                </div>

                <div className="v-brutal-step-list">
                  {/* Step 1 */}
                  <div className="v-brutal-step-item">
                    <div className="v-brutal-step-label">
                      <span>STEP 01. 상품 상세 표시가</span>
                      <b>₩19,900</b>
                    </div>
                    <div className="v-brutal-step-sub">고객이 처음 본 깨끗한 가격</div>
                  </div>

                  {/* Step 2: Trap 1 */}
                  <div className={`v-brutal-step-item ${optGift ? "alert-step" : ""}`}>
                    <div className="v-brutal-step-label">
                      <span>
                        <input
                          type="checkbox"
                          checked={optGift}
                          onChange={(e) => setOptGift(e.target.checked)}
                          id="chk-gift"
                          style={{ marginRight: 6, transform: "scale(1.2)" }}
                        />
                        <label htmlFor="chk-gift" style={{ cursor: "pointer" }}>
                          STEP 02. 선물 포장 옵션
                        </label>
                      </span>
                      <b style={{ color: optGift ? "#ff4343" : "#111" }}>
                        {optGift ? "+₩2,500" : "해제됨 (₩0)"}
                      </b>
                    </div>
                    <div className="v-brutal-step-sub">
                      {optGift ? "고객 동의 없이 장바구니에 미리 선택되어 있음!" : "정상: 고객이 직접 원할 때만 선택"}
                    </div>
                    {optGift && <span className="v-brutal-stamp">특정옵션 사전선택</span>}
                  </div>

                  {/* Step 3: Trap 2 */}
                  <div className={`v-brutal-step-item ${optFee ? "alert-step" : ""}`}>
                    <div className="v-brutal-step-label">
                      <span>
                        <input
                          type="checkbox"
                          checked={optFee}
                          onChange={(e) => setOptFee(e.target.checked)}
                          id="chk-fee"
                          style={{ marginRight: 6, transform: "scale(1.2)" }}
                        />
                        <label htmlFor="chk-fee" style={{ cursor: "pointer" }}>
                          STEP 03. 주문 처리 부가비용
                        </label>
                      </span>
                      <b style={{ color: optFee ? "#ff4343" : "#111" }}>
                        {optFee ? "+₩3,000" : "제거됨 (₩0)"}
                      </b>
                    </div>
                    <div className="v-brutal-step-sub">
                      {optFee ? "첫 화면에선 꽁꽁 숨기다가 결제 직전에 쓱 추가!" : "정상: 최초 판매가에 명시됨"}
                    </div>
                    {optFee && <span className="v-brutal-stamp">순차공개 가격책정</span>}
                  </div>
                </div>

                <div className="v-brutal-receipt-footer">
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>최종 주문 결제액</div>
                    <div style={{ fontSize: 11, color: "#666" }}>
                      {optGift || optFee ? "⚠️ 다크패턴으로 불어난 금액 포함" : "✓ 투명하고 정직한 결제 금액"}
                    </div>
                  </div>
                  <div className="v-brutal-receipt-total">
                    ₩{totalPrice.toLocaleString()}
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
