"use client";

import Link from "next/link";
import { useState } from "react";

export default function VariantSwissEnterprise() {
  const [urlInput, setUrlInput] = useState("https://brand-mall.co.kr");

  return (
    <div className="v-swiss">
      {/* Header */}
      <header className="v-swiss-header">
        <div className="v-swiss-wrap">
          <div className="v-swiss-header-inner">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Link href="/" className="v-swiss-brand">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" fill="#2563eb" />
                  <path d="M10 12.5l2 2 4-4" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Baromi Enterprise
              </Link>
              <span className="v-swiss-brand-badge">FTC Compliance Suite</span>
            </div>

            <nav className="v-swiss-nav">
              <Link href="/about">플랫폼 아키텍처</Link>
              <Link href="/method">구매 여정 감사 규약</Link>
              <Link href="/criteria">공정위 심사지침</Link>
              <Link href="/principles">보안 및 개인정보 원칙</Link>
            </nav>

            <Link href="/scan/new" className="v-swiss-cta">
              사전 감사 시작
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="v-swiss-hero">
        <div className="v-swiss-wrap">
          <div className="v-swiss-hero-top">
            <div className="v-swiss-pill">
              <b>2026 공정위 전자상거래법 지침</b> 이커머스 다크패턴 자동 감사 솔루션
            </div>

            <h1 className="v-swiss-title">
              쇼핑몰 결제 여정의 규제 리스크,<br />
              <em>데이터와 객관적 증거</em>로 사전에 점검합니다
            </h1>

            <p className="v-swiss-sub">
              소비자 노출 상품부터 장바구니, 최종 주문서까지 브라우저 세션을 완벽히 격리하여 자동 탐색합니다.
              선택 상태, 가격 변동 원장, DOM 좌표를 수집하여 신뢰할 수 있는 감사 보고서를 제공합니다.
            </p>

            <form className="v-swiss-form" action="/scan/new" method="get">
              <input
                type="text"
                name="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="점검할 쇼핑몰 도메인 또는 상품 URL을 입력하세요"
                aria-label="쇼핑몰 URL 입력"
              />
              <button type="submit">감사 리포트 생성</button>
            </form>
          </div>

          {/* Executive Compliance Dashboard */}
          <div className="v-swiss-dashboard">
            <div className="v-swiss-dash-header">
              <div className="v-swiss-dash-title">
                <h3>전자상거래 구매 여정 사전 감사 리포트 (Sample)</h3>
                <p>대상: cafe24-standard-store.co.kr // 감사 버전: FTC-2026-R1</p>
              </div>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                최종 감사 일시: 2026-11-15 03:20 KST
              </div>
            </div>

            <div className="v-swiss-dash-grid">
              {/* Sidebar Metrics */}
              <div className="v-swiss-dash-sidebar">
                <div className="v-swiss-score-box">
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    종합 규제 리스크 등급
                  </div>
                  <div className="v-swiss-score-val">A-</div>
                  <span className="v-swiss-score-badge">주의 신호 2건 감지됨</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>여정 도달률:</span>
                    <strong style={{ color: "#0f172a" }}>3/3 단계 완료 (100%)</strong>
                  </div>
                  <div style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>가격 원장 일치율:</span>
                    <strong style={{ color: "#16a34a" }}>정상 대조 완료</strong>
                  </div>
                  <div style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>결제 안전성:</span>
                    <strong style={{ color: "#2563eb" }}>주문 버튼 차단 (안전)</strong>
                  </div>
                </div>
              </div>

              {/* Main Findings Table */}
              <div className="v-swiss-dash-main">
                <table className="v-swiss-table">
                  <thead>
                    <tr>
                      <th>감사 항목</th>
                      <th>발견 단계</th>
                      <th>상태 판정</th>
                      <th>금액 영향</th>
                      <th>권고 조치</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <strong>특정 옵션 사전선택</strong>
                        <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>친환경 포장재 옵션 (ID: #eco-wrap)</div>
                      </td>
                      <td>장바구니</td>
                      <td>
                        <span className="v-swiss-status-pill warning">● 위험 신호</span>
                      </td>
                      <td style={{ color: "#dc2626", fontWeight: 600 }}>+₩2,500</td>
                      <td>기본 체크 해제 (소비자 직접 선택 유도)</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>순차공개 가격책정</strong>
                        <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>결제 대행 처리 수수료 (ID: #pg-handling)</div>
                      </td>
                      <td>주문서</td>
                      <td>
                        <span className="v-swiss-status-pill warning">● 위험 신호</span>
                      </td>
                      <td style={{ color: "#dc2626", fontWeight: 600 }}>+₩3,000</td>
                      <td>최초 상품 상세 페이지에 총 결제비용 고지</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>숨겨진 갱신 / 정기결제</strong>
                        <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>반복 과금 조건 유무 점검</div>
                      </td>
                      <td>전 단계</td>
                      <td>
                        <span className="v-swiss-status-pill ok">✓ 미발견 (적합)</span>
                      </td>
                      <td>₩0</td>
                      <td>규제 기준 준수 확인됨</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
