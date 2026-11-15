"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Props {
  id: string;
}

// Clean Minimal SVG Icons (Zero Emoji, Precision 1.5px/2px Stroke)
function IconArrowLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function IconSparkles() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function IconPrinter() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export function ScanReport({ id }: Props) {
  const [isRescanning, setIsRescanning] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState<boolean>(false);
  const [aiRunning, setAiRunning] = useState<boolean>(false);
  const [aiStep, setAiStep] = useState<number>(0);

  // Clean Sample Data
  const [report, setReport] = useState<any>({
    shopId: "shop_sample_01",
    targetUrl: "https://cafe24-mystore.co.kr/product/oversize-cotton-tee",
    scanStatus: "COMPLETED",
    createdAt: "2026-11-15 04:00 KST",
    durationMs: 2340,
    viewport: "DESKTOP",
    purchasePath: "CART",
    riskScore: 68,
    summary: {
      suspected: 2,
      reviewNeeded: 0,
      clean: 5,
      notTested: 1,
    },
    findings: [
      {
        id: "finding-preselected-demo",
        title: "특정 옵션 사전선택 (Pre-selected Option)",
        type: "SpecificOptionPreselected",
        stage: "장바구니 담기 단계",
        reason: "소비자가 직접 선택하지 않았음에도 '친환경 선물 포장 패키지(+2,500원)' 옵션이 장바구니에 기본 선택되어 총 결제 금액이 증가했습니다.",
        selector: "input#opt_gift_box:checked",
        amountText: "+2,500원 증가",
        remedy: "쇼핑몰 관리자 페이지 > 상품 옵션 관리에서 해당 유료 옵션의 '기본 선택(Default checked)'을 끄고, 소비자가 직접 선택할 때만 체크되도록 설정하세요.",
        elementHtml: `<input type="checkbox" id="opt_gift_box" checked disabled /> 선물용 친환경 패키지 (+2,500원)`,
      },
      {
        id: "finding-drip-demo",
        title: "순차공개 가격책정 (Drip Pricing)",
        type: "DripPricingSequence",
        stage: "주문서 작성 단계",
        reason: "최초 상품 상세 페이지에서는 고지되지 않았던 '결제 대행 처리 수수료(+3,000원)'가 최종 주문서 단계에서 필수 비용으로 신규 추가되었습니다.",
        selector: "div#pg_handling_fee",
        amountText: "+3,000원 증가",
        remedy: "구매에 반드시 수반되는 필수 비용은 상품 상세 페이지의 판매가 노출 시점에 함께 총비용으로 고지해야 공정위 규제에 저촉되지 않습니다.",
        elementHtml: `<div style="display:flex;justify-content:space-between"><span>결제 시스템 처리비</span><b>+3,000원</b></div>`,
      },
    ],
    ledger: [
      { stage: "01. 상품 상세", item: "시그니처 코튼 오버핏 티셔츠 (단품)", price: 19900, diff: 0, status: "기준 가격" },
      { stage: "02. 장바구니", item: "친환경 선물 포장 (사전선택됨)", price: 22400, diff: 2500, status: "주의" },
      { stage: "03. 주문서", item: "결제 대행 수수료 (새로 추가됨)", price: 25400, diff: 3000, status: "주의" },
    ],
  });

  const handleInstantRescan = () => {
    setIsRescanning(true);
    setToastMsg(null);
    setTimeout(() => {
      setIsRescanning(false);
      setToastMsg("동일 조건 즉시 재진단 완료: 2026-11-15 05:20 KST 기준 최신 데이터로 동기화되었습니다.");
      setReport((prev: any) => ({
        ...prev,
        createdAt: "2026-11-15 05:20 KST (재검사 완료)",
      }));
    }, 1200);
  };

  const handleAiAudit = () => {
    setAiRunning(true);
    setAiStep(1);
    setTimeout(() => setAiStep(2), 600);
    setTimeout(() => setAiStep(3), 1200);
    setTimeout(() => {
      setAiRunning(false);
      setAiModalOpen(false);
      setToastMsg("AI 심층 정밀 검사 완료: 미검사 1건(회원 프로모션 문맥)이 정상으로 검증되었습니다.");
      setReport((prev: any) => ({
        ...prev,
        riskScore: 45,
        summary: {
          ...prev.summary,
          notTested: 0,
          clean: prev.summary.clean + 1,
        },
      }));
    }, 1800);
  };

  return (
    <div className="report-shell">
      {/* ── Slim Topbar ── */}
      <div className="report-topbar">
        <div className="clean-wrap">
          <div className="report-topbar-inner">
            <Link href="/" className="report-back-link" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <img src="/brand/baromi-symbol.png" alt="바로미 심벌" width={20} height={20} style={{ objectFit: "contain" }} />
              <IconArrowLeft /> 바로미 메인으로
            </Link>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: "var(--text-sub)", fontFamily: "var(--font-mono)" }}>
                REPORT #{id}
              </span>
              <button
                type="button"
                className="cs-btn-secondary"
                style={{ padding: "6px 12px", fontSize: 12.5 }}
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href);
                  alert("보고서 링크가 클립보드에 복사되었습니다.");
                }}
              >
                링크 복사
              </button>
              <button
                type="button"
                className="cs-btn-secondary"
                style={{ padding: "6px 12px", fontSize: 12.5 }}
                onClick={() => window.print()}
              >
                <IconPrinter /> PDF 인쇄
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="clean-wrap">
        {/* Toast Notification Banner */}
        {toastMsg && (
          <div className="report-toast-banner" style={{ marginTop: 20 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {toastMsg}
            </span>
            <button
              type="button"
              style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", fontWeight: 700 }}
              onClick={() => setToastMsg(null)}
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Master Split Layout (Left Canvas vs Right Sticky Action Sidebar) ── */}
        <div className="report-main-grid">
          {/* ── Left Document Canvas (No Card Fatigue!) ── */}
          <div className="report-doc-canvas">
            {/* Document Header */}
            <div className="report-doc-header">
              <span className="report-doc-badge">
                공정위 심사지침 기준 점검 권고 {report.summary.suspected}건 발견
              </span>
              <h1 className="report-doc-title">결제 여정 사전 점검 결과 보고서</h1>
              <div className="report-doc-meta">
                <span>점검 대상: <strong>{report.targetUrl}</strong></span>
                <span>·</span>
                <span>일시: {report.createdAt}</span>
                <span>·</span>
                <span>소요: {(report.durationMs / 1000).toFixed(1)}초</span>
              </div>
            </div>

            {/* Master Numbers Ribbon: SVG Ring Gauge + Border-free Clean Metrics */}
            <div className="report-stats-ribbon" style={{ alignItems: "center" }}>
              {/* Circular Dial Gauge */}
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <svg width="72" height="72" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="32" fill="none" stroke="var(--border-subtle)" strokeWidth="6" />
                  <circle
                    cx="40"
                    cy="40"
                    r="32"
                    fill="none"
                    stroke={report.riskScore > 50 ? "var(--rose)" : "var(--emerald)"}
                    strokeWidth="6"
                    strokeDasharray={`${(report.riskScore / 100) * 201} 201`}
                    strokeLinecap="round"
                    transform="rotate(-90 40 40)"
                    style={{ transition: "stroke-dasharray 0.6s ease" }}
                  />
                  <text x="40" y="45" textAnchor="middle" fontSize="16" fontWeight="800" fill="var(--text-main)" fontFamily="var(--font-sans)">
                    {report.riskScore}%
                  </text>
                </svg>
                <div className="report-stat-col">
                  <span className="report-stat-num warn tabular" style={{ fontSize: 24 }}>
                    {report.riskScore > 50 ? "주의 요망" : "안전 범위"}
                  </span>
                  <span className="report-stat-label">종합 위험 지수</span>
                </div>
              </div>

              <div className="report-stat-col">
                <span className="report-stat-num warn tabular">{report.summary.suspected}건</span>
                <span className="report-stat-label">위험 신호 감지</span>
              </div>
              <div className="report-stat-col">
                <span className="report-stat-num tabular" style={{ color: "var(--emerald)" }}>{report.summary.clean}개</span>
                <span className="report-stat-label">지침 기준 준수</span>
              </div>
              <div className="report-stat-col">
                <span className="report-stat-num skip tabular">{report.summary.notTested}건</span>
                <span className="report-stat-label">미검사 (AI 검사 가능)</span>
              </div>
            </div>

            {/* Minimal Inline Timeline */}
            <div className="report-flow-section">
              <div className="report-flow-head">
                <span>구매 여정 탐색 경로 및 단계별 관측 결과</span>
                <span style={{ fontSize: 12, color: "var(--emerald)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                  <IconShield /> 브라우저 샌드박스 격리 완료
                </span>
              </div>

              <div className="report-flow-track">
                <div className="report-flow-step safe">
                  <span className="report-step-phase">STAGE 01</span>
                  <div className="report-step-label">상품 상세 화면</div>
                  <div className="report-step-note">표시가 19,900원 확인 (0.4s)</div>
                </div>

                <div className="report-flow-step warn">
                  <span className="report-step-phase" style={{ color: "var(--rose)" }}>STAGE 02 · 주의</span>
                  <div className="report-step-label">장바구니 담기</div>
                  <div className="report-step-note warn">사전선택 유료 옵션 (+2,500원)</div>
                </div>

                <div className="report-flow-step warn">
                  <span className="report-step-phase" style={{ color: "var(--rose)" }}>STAGE 03 · 주의</span>
                  <div className="report-step-label">주문서 작성</div>
                  <div className="report-step-note warn">미고지 수수료 추가 (+3,000원)</div>
                </div>

                <div className="report-flow-step">
                  <span className="report-step-phase">TERMINATION</span>
                  <div className="report-step-label">최종 결제</div>
                  <div className="report-step-note" style={{ color: "var(--emerald)", fontWeight: 600 }}>주문 확정 동작 원천 차단</div>
                </div>
              </div>
            </div>

            {/* Finding Detail Section: Document Rows */}
            <div className="report-findings-section">
              <div className="report-findings-head">
                <h2 className="report-findings-title">
                  발견된 위험 신호 상세 및 권고 조치 ({report.findings.length}건)
                </h2>
              </div>

              {report.findings.map((f: any, idx: number) => (
                <div key={idx} className="report-finding-row">
                  <div>
                    <span className="report-finding-tag">
                      발견 #{idx + 1} · {f.stage}
                    </span>
                    <h3 className="report-finding-heading">{f.title}</h3>
                    <p className="report-finding-body">{f.reason}</p>

                    <div className="report-finding-meta">
                      <span>영향 금액: <strong>{f.amountText}</strong></span>
                      <span>·</span>
                      <span>대상 요소: <code>{f.selector}</code></span>
                    </div>

                    <div className="report-action-guide">
                      <strong>권장 조치 방안</strong>
                      {f.remedy}
                    </div>

                    <div style={{ marginTop: 14 }}>
                      <Link
                        href={`/report/${id}/${f.id}`}
                        className="cs-btn-secondary"
                        style={{ padding: "6px 12px", fontSize: 12.5, display: "inline-flex", gap: 5 }}
                      >
                        정밀 화면 증거 인스펙터 보기
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                  </div>

                  {/* Evidence Viewport */}
                  <div className="report-evidence-box">
                    <div className="report-evidence-bar">
                      <span>캡처 화면 증거</span>
                      <span>2026-11-15</span>
                    </div>
                    <div className="report-evidence-content">
                      <div className="report-evidence-snippet" dangerouslySetInnerHTML={{ __html: f.elementHtml }} />
                      <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-sub)", textAlign: "center" }}>
                        DOM 요소 추출 검증 완료 (BBox 식별됨)
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Full-width Ledger Table (No Card Box) */}
            <div className="report-ledger-section">
              <h2 className="report-findings-title">단계별 가격 변동 원장 (Price Ledger)</h2>
              <table className="report-table-plain">
                <thead>
                  <tr>
                    <th style={{ width: "25%" }}>여정 단계</th>
                    <th style={{ width: "35%" }}>항목 내용</th>
                    <th style={{ width: "20%" }}>상태</th>
                    <th style={{ width: "20%", textAlign: "right" }}>누적 청구 금액</th>
                  </tr>
                </thead>
                <tbody>
                  {report.ledger.map((row: any, i: number) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{row.stage}</td>
                      <td>{row.item}</td>
                      <td>
                        <span className={row.diff > 0 ? "report-finding-tag" : "tag-live"}>
                          {row.diff > 0 ? `+${row.diff.toLocaleString()}원 추가` : "기준 가격"}
                        </span>
                      </td>
                      <td className="tabular" style={{ textAlign: "right", fontWeight: 700 }}>
                        {row.price.toLocaleString()}원
                      </td>
                    </tr>
                  ))}
                  <tr className="sum-row">
                    <td colSpan={3}>최종 청구 결제 금액 (기준가 대비 +5,500원 차액 발생)</td>
                    <td className="tabular" style={{ textAlign: "right", color: "var(--rose)" }}>
                      25,400원
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Right Action Sidebar (Sticky Cluster) ── */}
          <div className="report-action-sidebar">
            {/* Section 1: Immediate Rescan Box */}
            <div className="sidebar-rescan-box">
              <div className="sidebar-rescan-title">
                <IconRefresh /> 즉시 재검사
              </div>
              <div className="sidebar-rescan-desc">
                결과가 마음에 안 드시거나 설정을 변경하셨나요? 동일한 브라우저 조건으로 즉시 다시 진단합니다.
              </div>
              <button
                type="button"
                className="sidebar-rescan-btn"
                disabled={isRescanning}
                onClick={handleInstantRescan}
              >
                {isRescanning ? "재진단 진행 중..." : "지금 즉시 재검사 실행"}
              </button>
            </div>

            {/* Section 2: AI Deep Audit Upsell Module */}
            <div className="sidebar-ai-box">
              <span className="sidebar-ai-tag">
                <IconSparkles /> AI 심층 분석
              </span>
              <h3 className="sidebar-ai-title">미검사 1건 정밀 점검</h3>
              <div className="sidebar-ai-desc">
                접근 제한이나 모호한 문맥으로 보류된 1건을 VLM AI가 화면을 직접 시각 분석하여 위험 여부를 판정합니다.
              </div>
              <div className="sidebar-ai-price">
                9,900원 <span>(부가세 포함)</span>
              </div>
              <button
                type="button"
                className="sidebar-ai-btn"
                onClick={() => setAiModalOpen(true)}
              >
                AI 심층 정밀 검사 시작
              </button>
            </div>

            {/* 상점 전체 이력 바로가기 */}
            <div style={{ background: "#ffffff", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)", marginBottom: 4 }}>
                상점 전체 진단 이력
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 12 }}>
                이 쇼핑몰의 회차별 진단 이력과 변경 내역을 대조해 보세요.
              </div>
              <Link
                href={`/shop/${report.shopId}`}
                className="cs-btn-secondary"
                style={{ width: "100%", justifyContent: "center", fontSize: 12.5 }}
              >
                상점 누적 원장 보기 →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── AI Audit Modal ── */}
      {aiModalOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(4px)",
          display: "grid",
          placeItems: "center",
          zIndex: 1000,
          padding: 20,
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: 14,
            maxWidth: 460,
            width: "100%",
            padding: 28,
            boxShadow: "0 20px 48px rgba(0, 0, 0, 0.2)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span className="sidebar-ai-tag">AI 심층 정밀 분석 세션</span>
              <button
                type="button"
                style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 16, color: "var(--text-muted)" }}
                onClick={() => setAiModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 8px", color: "var(--text-main)" }}>
              미검사 1건 AI 시각 정밀 진단
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, margin: "0 0 20px" }}>
              회원 로그인 및 프로모션 팝업의 모호한 텍스트 문맥을 최신 Vision AI가 시각적으로 판독하여 숨겨진 의도와 공정위 지침 위반 여부를 검증합니다.
            </p>

            {aiRunning ? (
              <div style={{ padding: "24px 0", textAlign: "center" }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--primary)", marginBottom: 8 }}>
                  {aiStep === 1 && "1/3. 페이지 시각 스냅샷 렌더링 중..."}
                  {aiStep === 2 && "2/3. 공정위 심사지침 기준 VLM 모델 판독 중..."}
                  {aiStep === 3 && "3/3. 검증 결과 리포트 병합 중..."}
                </div>
                <div style={{ height: 4, background: "var(--border-subtle)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: "var(--primary)", width: `${aiStep * 33}%`, transition: "width 0.4s ease" }} />
                </div>
              </div>
            ) : (
              <div>
                <div style={{ background: "var(--bg-subtle)", borderRadius: 8, padding: 14, marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: "var(--text-muted)" }}>검사 대상 항목</span>
                    <strong>회원 프로모션 유도 문맥</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "var(--text-muted)" }}>결제 금액</span>
                    <strong className="tabular" style={{ color: "var(--primary)" }}>9,900원</strong>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    className="cs-btn-secondary"
                    style={{ flex: 1, justifyContent: "center" }}
                    onClick={() => setAiModalOpen(false)}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="cs-btn-primary"
                    style={{ flex: 1, justifyContent: "center", background: "var(--primary)" }}
                    onClick={handleAiAudit}
                  >
                    결제 및 진단 시작
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
