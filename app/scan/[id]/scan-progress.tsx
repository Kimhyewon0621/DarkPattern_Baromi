"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { stages, stageLabels, type Stage } from "../../../src/demo";
import { post, scanRequest } from "../../scan-request";
import { legalRules } from "../../../src/legal-rules";
import { diagnosticSurfaceKinds, diagnosticSurfaceLabels, type DiagnosticSurfaceKind, type DiagnosticSurfaceStatus } from "../../../src/diagnostic-surfaces";

type Status = "QUEUED" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED" | "CANCELLED";
type ScanState = {
  shopId: string;
  scenario?: string;
  executionMode?: "DEMO" | "STATIC" | "DYNAMIC";
  viewport: "DESKTOP" | "MOBILE";
  purchasePath: "CART" | "DIRECT";
  status: Status;
  cancelRequested: boolean;
  progress: number;
  currentStage?: Stage | null;
  coverage: Record<Stage, "COVERED" | "BLOCKED" | "PENDING" | "SKIPPED">;
  surfaceCoverage: Record<DiagnosticSurfaceKind, DiagnosticSurfaceStatus>;
  summary?: { suspected: number; reviewNeeded: number; notTested: number };
};

const labels: Record<Status, string> = {
  QUEUED: "대기 큐 진입",
  RUNNING: "브라우저 탐색 진행 중",
  COMPLETED: "사전 점검 완료",
  PARTIAL: "검증 범위 제한 완료",
  FAILED: "진단 실패",
  CANCELLED: "진단 중단됨",
};

export function ScanProgress({ id }: { id: string }) {
  const [scan, setScan] = useState<ScanState>();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const response = await fetch("/api/v1/scans/" + encodeURIComponent(id), { signal: controller.signal });
        if (!response.ok) throw new Error("진단 상태를 불러오지 못했습니다.");
        const next: ScanState = await response.json();
        setScan(next);
        if (next.status === "QUEUED" || next.status === "RUNNING") timer = setTimeout(refresh, 1000);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "조회에 실패했습니다.");
      }
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [id, router]);

  async function act(action: "cancel" | "retry") {
    if (!scan) return;
    setPending(true);
    setError("");
    try {
      if (action === "cancel") {
        await post("scans/" + id + "/cancel", {});
      } else {
        const result = await post("scans", scanRequest(scan.shopId, undefined, "CONTEST", scan.viewport, scan.purchasePath));
        router.push("/scan/" + result.scanId);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "요청에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }

  // Fallback demo state if scan state is not yet loaded
  const active = scan ? scan.status === "QUEUED" || scan.status === "RUNNING" : true;
  const reportReady = scan ? scan.status === "COMPLETED" || scan.status === "PARTIAL" : false;
  const progressVal = scan ? scan.progress : 45;

  return (
    <div className="progress-panel">
      {/* Progress Header */}
      <div className="progress-header">
        <div>
          <div className="progress-status-badge">
            <span className="progress-status-dot" />
            <span>{scan ? labels[scan.status] : "브라우저 탐색 세션 실행 중..."}</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            세션 ID: #{id} · 예상 소요 시간: 약 30초 내외
          </div>
        </div>

        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-main)", fontFamily: "var(--font-mono)" }}>
          {progressVal}%
        </div>
      </div>

      {/* Progress Bar */}
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progressVal}%` }} />
      </div>

      {/* Safe Guarantee Banner */}
      <div className="progress-safe-banner">
        <span>🛡️ 안전 보장:</span> 실제 주문 완료 및 결제 확정 버튼은 원천적으로 클릭되지 않습니다.
      </div>

      {/* Stage Inspection Status */}
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--text-main)" }}>
        구매 여정 단계별 관측 현황
      </div>

      <div className="progress-stages-list">
        <div className="progress-stage-item covered">
          <div>
            <strong>STAGE 01. 상품 상세 화면</strong>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>최초 판매가 및 기본 옵션 상태 관측 완료</div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--emerald)" }}>관측 완료</span>
        </div>

        <div className="progress-stage-item running">
          <div>
            <strong>STAGE 02. 장바구니 담기</strong>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>추가 유료 옵션의 자동 사전선택 여부 점검 중...</div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)" }}>탐색 중</span>
        </div>

        <div className="progress-stage-item">
          <div>
            <strong>STAGE 03. 주문서 작성</strong>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>최종 결제 금액 및 추가 비용 대기 중</div>
          </div>
          <span style={{ fontSize: 12, color: "var(--text-sub)" }}>대기 중</span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 16, borderTop: "1px solid var(--border-subtle)" }}>
        {active && (
          <button
            type="button"
            className="cs-btn-secondary"
            disabled={pending || (scan && scan.cancelRequested)}
            onClick={() => act("cancel")}
          >
            점검 중단 요청
          </button>
        )}

        {scan && (scan.status === "COMPLETED" || scan.status === "PARTIAL") && (
          <Link className="cs-btn-primary" href={`/report/${id}`}>
            진단 결과 보기
          </Link>
        )}
      </div>

      {error && (
        <p style={{ color: "var(--rose)", fontSize: 13, marginTop: 12, textAlign: "center" }}>
          {error}
        </p>
      )}
    </div>
  );
}
