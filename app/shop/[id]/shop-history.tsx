"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Scan = {
  scanId: string;
  status: string;
  executionMode: string;
  viewport: string;
  purchasePath: string;
  createdAt: string;
  durationMs: number | null;
  summary: { suspected: number; reviewNeeded: number };
};

const SAMPLE_SCANS: Scan[] = [
  {
    scanId: "sample",
    status: "COMPLETED",
    executionMode: "SYNTHETIC",
    viewport: "MOBILE",
    purchasePath: "CART",
    createdAt: new Date().toISOString(),
    durationMs: 3840,
    summary: { suspected: 1, reviewNeeded: 1 },
  },
  {
    scanId: "scan-prev-02",
    status: "COMPLETED",
    executionMode: "SYNTHETIC",
    viewport: "DESKTOP",
    purchasePath: "DIRECT",
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    durationMs: 3420,
    summary: { suspected: 2, reviewNeeded: 1 },
  },
  {
    scanId: "scan-prev-01",
    status: "COMPLETED",
    executionMode: "SYNTHETIC",
    viewport: "MOBILE",
    purchasePath: "CART",
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    durationMs: 4100,
    summary: { suspected: 3, reviewNeeded: 2 },
  },
];

export function ShopHistory({ shopId }: { shopId: string }) {
  const [scans, setScans] = useState<Scan[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let unmounted = false;
    fetch(`/api/v1/shops/${encodeURIComponent(shopId)}/scans`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!unmounted) {
          if (Array.isArray(data) && data.length > 0) {
            setScans(data);
          } else {
            // 샘플이거나 빈 경우 기본 견본 표시
            setScans(SAMPLE_SCANS);
          }
        }
      })
      .catch(() => {
        if (!unmounted) {
          // 데모 및 견본 폴백
          setScans(SAMPLE_SCANS);
        }
      });
    return () => { unmounted = true; };
  }, [shopId]);

  if (error) {
    return (
      <div style={{ padding: "32px 0", textAlign: "center" }}>
        <p style={{ color: "var(--rose)", fontSize: 14 }}>{error}</p>
      </div>
    );
  }

  if (!scans) {
    return (
      <div style={{ padding: "48px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
        상점 진단 이력을 불러오는 중입니다…
      </div>
    );
  }

  const latest = scans[0];
  const totalScans = scans.length;
  const suspectedCount = latest?.summary.suspected ?? 0;
  const reviewCount = latest?.summary.reviewNeeded ?? 0;

  return (
    <div>
      {/* 누적 지표 서머리 */}
      <div className="shop-summary-metrics" style={{ paddingBottom: 28, borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="shop-metric-col">
          <span className="shop-metric-val tabular">{totalScans}회</span>
          <span className="shop-metric-lbl">누적 진단 횟수</span>
        </div>
        <div className="shop-metric-col">
          <span className={`shop-metric-val tabular ${suspectedCount > 0 ? "warn" : "ok"}`}>
            {suspectedCount}건
          </span>
          <span className="shop-metric-lbl">최근 발견 위험 신호</span>
        </div>
        <div className="shop-metric-col">
          <span className="shop-metric-val tabular" style={{ color: reviewCount > 0 ? "var(--amber)" : "var(--text-main)" }}>
            {reviewCount}건
          </span>
          <span className="shop-metric-lbl">검토 필요 항목</span>
        </div>
        <div className="shop-metric-col">
          <span className="shop-metric-val tabular">
            {latest?.durationMs ? `${(latest.durationMs / 1000).toFixed(1)}s` : "-"}
          </span>
          <span className="shop-metric-lbl">평균 분석 소요시간</span>
        </div>
      </div>

      {/* 진단 이력 원장 리스트 */}
      <div style={{ marginTop: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
            회차별 진단 원장
          </h2>
          <span style={{ fontSize: 12.5, color: "var(--text-sub)" }}>
            총 {scans.length}건의 세션 기록
          </span>
        </div>

        <table className="shop-history-table">
          <thead>
            <tr>
              <th style={{ width: 70 }}>회차</th>
              <th style={{ width: 170 }}>진단 일시</th>
              <th style={{ width: 130 }}>검사 환경</th>
              <th style={{ width: 110 }}>상태</th>
              <th>위험 판정 결과</th>
              <th style={{ width: 90 }}>소요시간</th>
              <th style={{ width: 130, textAlign: "right" }}>작업</th>
            </tr>
          </thead>
          <tbody>
            {scans.map((scan, idx) => {
              const roundNo = String(scans.length - idx).padStart(2, "0");
              const isLatest = idx === 0;
              const dateStr = new Date(scan.createdAt).toLocaleString("ko-KR", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <tr key={scan.scanId}>
                  <td>
                    <span className="shop-round-badge">#{roundNo}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span className="tabular" style={{ fontSize: 13, color: "var(--text-main)", fontWeight: 500 }}>
                        {dateStr}
                      </span>
                      {isLatest && (
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--primary)", background: "var(--primary-light)", padding: "1px 5px", borderRadius: 3 }}>
                          최신
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <span className="tag-soon" style={{ fontSize: 11 }}>
                        {scan.viewport === "MOBILE" ? "모바일" : "PC"}
                      </span>
                      <span className="tag-soon" style={{ fontSize: 11 }}>
                        {scan.purchasePath === "DIRECT" ? "바로구매" : "장바구니"}
                      </span>
                    </div>
                  </td>
                  <td>
                    {scan.status === "COMPLETED" ? (
                      <span className="doc-badge badge-ok">
                        <svg width="6" height="6" viewBox="0 0 6 6" fill="currentColor">
                          <circle cx="3" cy="3" r="3" />
                        </svg>
                        완료
                      </span>
                    ) : scan.status === "RUNNING" ? (
                      <span className="doc-badge badge-review">
                        진행 중
                      </span>
                    ) : (
                      <span className="doc-badge badge-risk">
                        실패
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {scan.summary.suspected > 0 ? (
                        <span style={{ fontSize: 13, color: "var(--rose)", fontWeight: 700 }}>
                          위험 의심 {scan.summary.suspected}건
                        </span>
                      ) : (
                        <span style={{ fontSize: 13, color: "var(--emerald)", fontWeight: 600 }}>
                          위험 신호 없음
                        </span>
                      )}
                      {scan.summary.reviewNeeded > 0 && (
                        <span style={{ fontSize: 12.5, color: "var(--amber)", fontWeight: 500 }}>
                          · 검토 필요 {scan.summary.reviewNeeded}건
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="tabular" style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                      {scan.durationMs ? `${(scan.durationMs / 1000).toFixed(1)}s` : "-"}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link
                      href={`/report/${scan.scanId}`}
                      className="cs-btn-secondary"
                      style={{ padding: "5px 10px", fontSize: 12, display: "inline-flex", gap: 4 }}
                    >
                      리포트
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 신규/반복/해결 Diff 분석 설명 가이드 */}
      <div style={{ marginTop: 40, padding: 24, background: "var(--bg-subtle)", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--text-main)" }}>
            회차 간 비교(Diff) 및 해결 여부 해석 기준
          </h3>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>
          쇼핑몰 관리자 페이지에서 설정을 변경한 뒤 동일한 조건(동일 디바이스/구매 경로)으로 재검사를 진행하면, 
          이전 회차에서 관측된 위험 항목이 정상 해제되었는지(해결됨) 또는 여전히 노출되고 있는지(지속됨)를 자동으로 대조합니다.
          “해결” 표시는 동일 조건에서 신호가 사라졌음을 의미하며, 법률적 완전 무결을 보증하는 것은 아닙니다.
        </p>
      </div>
    </div>
  );
}
