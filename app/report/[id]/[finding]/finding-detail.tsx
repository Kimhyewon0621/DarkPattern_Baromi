"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { stageLabels } from "../../../../src/demo";
import { legalRules } from "../../../../src/legal-rules";
import type { Finding } from "../../../../src/rules";

// 견본 데이터 폴백 (API 실패 또는 데모 열람 시)
const FALLBACK_FINDING: Finding = {
  type: "PRESELECTION",
  status: "SUSPECTED",
  ruleVersion: "1",
  stage: "product",
  reason: "소비자가 직접 선택하지 않은 유료 포장 옵션(+2,500원)이 초기 화면에서 기본으로 체크되어 있어 총 결제 예상 금액이 부당하게 증가했습니다.",
  elementBounds: { x: 38, y: 142, width: 280, height: 38 },
  evidenceIds: ["ev-sample-prod-01", "ev-sample-prod-02"],
  evidence: [
    {
      stage: "product",
      url: "https://sample.shop/products/1",
      screenshot: "sample-prod-screenshot.png",
      options: [],
      fees: [],
      screenshotArea: { x: 0, y: 0, width: 360, height: 480 },
      priceLines: [
        "기본 상품가: 19,900원",
        "[선택옵션] 프리미엄 선물포장 (+2,500원) [기본 선택됨]",
        "현재 계산된 합계: 22,400원",
      ],
    },
  ],
};

export function FindingDetail({ id, finding }: { id: string; finding: string }) {
  const [detail, setDetail] = useState<Finding | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v1/findings/" + encodeURIComponent(finding), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const result = await response.json();
        setDetail(result);
        setLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          // 데모 또는 샘플 폴백
          setDetail(FALLBACK_FINDING);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [id, finding]);

  if (loading) {
    return (
      <div style={{ padding: "64px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
        정밀 화면 증거와 규칙 분석을 불러오는 중입니다…
      </div>
    );
  }

  const currentFinding = detail || FALLBACK_FINDING;
  const rule = legalRules[currentFinding.type] || {
    title: "특정 옵션 사전선택",
    recommendation: "유료 부가옵션은 기본 선택값을 반드시 '선택 안 함'으로 설정하고, 소비자가 자발적으로 체크했을 때만 금액이 합산되도록 변경하세요.",
    reference: "전자상거래법 제21조 제1항 제1호 (거짓 또는 과장된 사실을 알리거나 기만적 방법을 사용하여 소비자를 유인하는 행위)",
    source: "https://www.ftc.go.kr",
  };

  return (
    <div>
      {/* 상단 브레드크럼 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Link
          href={`/report/${id}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-muted)",
            textDecoration: "none",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          리포트 요약으로 돌아가기
        </Link>
        <span style={{ color: "var(--text-sub)", fontSize: 12 }}>/</span>
        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>발견 상세 인스펙터</span>
      </div>

      {/* 헤더 타이틀 */}
      <div className="finding-head">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="doc-badge badge-risk">
            <svg width="6" height="6" viewBox="0 0 6 6" fill="currentColor">
              <circle cx="3" cy="3" r="3" />
            </svg>
            위험 의심 · 운영자 검토 권고
          </span>
          <span style={{ fontSize: 12.5, color: "var(--text-sub)" }}>
            발견 ID: {finding}
          </span>
        </div>
        <h1 className="finding-title">{rule.title}</h1>
        <div className="finding-meta">
          <span>진단 대상 세션: <strong>{id}</strong></span>
          <span>·</span>
          <span>관측 단계: <strong>{stageLabels[currentFinding.stage] || currentFinding.stage}</strong></span>
          {currentFinding.evidenceIds?.length ? (
            <>
              <span>·</span>
              <span>증거 수집 레코드: {currentFinding.evidenceIds.join(", ")}</span>
            </>
          ) : null}
        </div>
      </div>

      {/* 2열 스플릿 인스펙터 */}
      <div className="finding-split-grid">
        {/* 좌측: 관측 정황 및 스크린샷 뷰어 */}
        <div className="finding-evidence-viewer">
          {/* 정황 요약 */}
          <div style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px", color: "var(--text-main)" }}>
              관측된 위반 정황
            </h2>
            <p style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--text-body)", margin: 0 }}>
              {currentFinding.reason}
            </p>
          </div>

          {/* 화면 증거 뷰어 */}
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 12px", color: "var(--text-main)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>정밀 캡처 증거 및 요소 좌표</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--rose)" }}>
                빨간색 박스: 다크패턴 의심 요소
              </span>
            </h2>

            {currentFinding.evidence.map((snapshot) => {
              const area = snapshot.screenshotArea;
              const element = snapshot.stage === currentFinding.stage ? currentFinding.elementBounds : undefined;
              const left = area && element ? Math.max(0, element.x - area.x) : 0;
              const top = area && element ? Math.max(0, element.y - area.y) : 0;
              const right = area && element ? Math.min(area.width, element.x + element.width - area.x) : 0;
              const bottom = area && element ? Math.min(area.height, element.y + element.height - area.y) : 0;

              return (
                <figure key={snapshot.stage} className="finding-figure">
                  <figcaption className="finding-figcaption">
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                        <line x1="8" y1="21" x2="16" y2="21" />
                        <line x1="12" y1="17" x2="12" y2="21" />
                      </svg>
                      {stageLabels[snapshot.stage] || snapshot.stage} 렌더링 화면
                    </div>
                    {element && (
                      <span className="tabular" style={{ fontSize: 11, color: "var(--text-sub)", fontFamily: "var(--font-mono)" }}>
                        x: {element.x}px, y: {element.y}px, w: {element.width}px, h: {element.height}px
                      </span>
                    )}
                  </figcaption>

                  <div className="finding-img-wrapper">
                    <img
                      src={"/api/v1/evidences/" + id + "-" + snapshot.stage}
                      onError={(e) => {
                        // 데모 이미지 폴백
                        (e.currentTarget as HTMLImageElement).src =
                          "data:image/svg+xml;charset=utf-8," +
                          encodeURIComponent(
                            `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="420" viewBox="0 0 360 420" fill="#f8fafc">
                              <rect width="360" height="420" fill="#f8fafc"/>
                              <rect x="20" y="24" width="320" height="200" rx="8" fill="#e2e8f0"/>
                              <text x="180" y="130" font-family="sans-serif" font-size="14" font-weight="bold" fill="#64748b" text-anchor="middle">상품 대표 이미지 영역</text>
                              <rect x="20" y="240" width="180" height="18" rx="4" fill="#cbd5e1"/>
                              <rect x="20" y="268" width="120" height="24" rx="4" fill="#94a3b8"/>
                              <rect x="20" y="306" width="320" height="44" rx="6" fill="#fee2e2" stroke="#f87171" stroke-width="1.5"/>
                              <text x="32" y="333" font-family="sans-serif" font-size="12" font-weight="bold" fill="#b91c1c">[V] 유료 선물포장 (+2,500원)</text>
                              <rect x="20" y="362" width="320" height="40" rx="6" fill="#0f172a"/>
                              <text x="180" y="387" font-family="sans-serif" font-size="13" font-weight="bold" fill="#ffffff" text-anchor="middle">22,400원 바로구매</text>
                            </svg>`
                          );
                      }}
                      alt={stageLabels[snapshot.stage] + " 진단 화면"}
                    />
                    {area && right > left && bottom > top && (
                      <span
                        className="finding-bbox"
                        style={{
                          left: (left / area.width) * 100 + "%",
                          top: (top / area.height) * 100 + "%",
                          width: ((right - left) / area.width) * 100 + "%",
                          height: ((bottom - top) / area.height) * 100 + "%",
                        }}
                        title="의심 영역 바운딩 박스"
                      />
                    )}
                  </div>

                  {/* 추출된 가격 라인 원장 */}
                  {snapshot.priceLines && snapshot.priceLines.length > 0 && (
                    <div style={{ padding: 16, background: "#ffffff", borderTop: "1px solid var(--border-light)" }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-sub)", textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.05em" }}>
                        화면 추출 텍스트 라인
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "var(--text-body)", lineHeight: 1.6 }}>
                        {snapshot.priceLines.map((line, index) => (
                          <li key={index} className="tabular">{line}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </figure>
              );
            })}
          </div>
        </div>

        {/* 우측: 스티키 솔루션 & 개선 조치 가이드 */}
        <div className="finding-sidebar-panel">
          {/* 가이드 카드 */}
          <div className="finding-guide-card">
            <h3>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--emerald)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              공정위 권고 개선 방법
            </h3>
            <p>{rule.recommendation}</p>
          </div>

          {/* 법적 기준 카드 */}
          <div className="finding-guide-card" style={{ background: "var(--bg-subtle)" }}>
            <h3>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-main)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              관련 법률 조항 및 심사지침
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
              {rule.reference}
            </p>
            <a
              href={rule.source}
              target="_blank"
              rel="noopener noreferrer"
              className="finding-legal-link"
            >
              공정거래위원회 원문 지침 열람하기
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
              </svg>
            </a>
          </div>

          {/* 액션 박스 */}
          <div style={{ background: "#ffffff", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)", marginBottom: 4 }}>
              수정 후 변경 사항 확인하기
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5, margin: "0 0 12px" }}>
              쇼핑몰 관리자 설정에서 해당 옵션을 해제한 후 재검사를 실행하면 즉시 위험 신호 해소 여부를 진단합니다.
            </p>
            <Link
              href={`/scan/new`}
              className="cs-btn-primary"
              style={{ width: "100%", justifyContent: "center", padding: "10px 14px", fontSize: 13 }}
            >
              수정 후 즉시 재검사 실행
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
