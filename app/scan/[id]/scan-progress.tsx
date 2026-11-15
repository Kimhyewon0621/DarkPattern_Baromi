"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { stages, stageLabels, type Stage } from "../../../src/demo";
import { post, scanRequest } from "../../scan-request";
import { legalRules } from "../../../src/legal-rules";
import { diagnosticSurfaceKinds, diagnosticSurfaceLabels, type DiagnosticSurfaceKind, type DiagnosticSurfaceStatus } from "../../../src/diagnostic-surfaces";
import type { RuleCoverage } from "../../../src/rule-coverage";
import type { ScanPhaseResults } from "../../../src/scan-phases";

type Status = "QUEUED" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED" | "CANCELLED";
type ScanState = {
  shopId: string;
  scenario?: string;
  executionMode?: "DEMO" | "STATIC" | "DYNAMIC";
  viewport: "DESKTOP" | "MOBILE";
  purchasePath: "CART" | "DIRECT";
  status: Status;
  hasReport?: boolean;
  cancelRequested: boolean;
  progress: number;
  currentStage?: string | null;
  coverage: Record<Stage, "COVERED" | "BLOCKED" | "PENDING" | "SKIPPED">;
  surfaceCoverage: Record<DiagnosticSurfaceKind, DiagnosticSurfaceStatus>;
  summary?: { suspected: number; reviewNeeded: number; notObserved: number; notTested: number };
  ruleCoverage?: RuleCoverage | null;
  phaseResults?: ScanPhaseResults;
};

const labels = {
  QUEUED: "대기 중", RUNNING: "진단 중", COMPLETED: "진단 완료",
  PARTIAL: "검증 범위 제한", FAILED: "진단 실패", CANCELLED: "진단 중단",
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
  }, [id]);

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

  if (!scan) return error ? <p role="alert">{error}</p> : <p role="status">진단 상태 확인 중…</p>;
  const active = scan.status === "QUEUED" || scan.status === "RUNNING";
  const reportReady = scan.status === "COMPLETED" || scan.status === "PARTIAL" || (scan.status === "FAILED" && scan.hasReport === true);
  const activePhase = Object.entries(scan.phaseResults ?? {}).find(([, phase]) => phase?.status === "RUNNING")?.[0];
  const activePhaseLabel = activePhase?.startsWith("surface:")
    ? diagnosticSurfaceLabels[activePhase.slice("surface:".length) as DiagnosticSurfaceKind]
    : activePhase === "site-crawl" ? "발견된 내부 경로와 화면 상태 순회"
    : activePhase ? stageLabels[activePhase as Stage] : scan.currentStage?.split(":")[0] ? stageLabels[scan.currentStage.split(":")[0] as Stage] : null;
  return (
    <section>
      <div className="progress-status"><span className={`status-dot ${active ? "active" : ""}`} /> <strong>{scan.cancelRequested && active ? "중단 요청 처리 중" : labels[scan.status]}</strong><span className="progress-hint">보통 수초~1분 · 사이트에 따라 달라짐</span></div>
      {active && <><progress aria-label="진단 진행률" value={scan.progress} max={100} />{activePhaseLabel && <p className="current-stage">지금 확인 중 · <strong>{activePhaseLabel}</strong></p>}{activePhase === "site-crawl" && scan.phaseResults?.["site-crawl"]?.reason && <p className="current-stage">{scan.phaseResults["site-crawl"].reason}</p>}<p className="safe-note">결제·주문 확정·외부 사이트 이동은 실행하지 않습니다.</p></>}
      <div className="stage-list">{stages.map((stage) => { const phase = scan.phaseResults?.[stage]; return <div className={`stage-row ${(phase?.status ?? scan.coverage[stage]).toLowerCase()}`} key={stage}><span className="stage-mark" /> <strong>{stageLabels[stage]}</strong><span>{
        phase?.status === "COVERED" || scan.coverage[stage] === "COVERED" ? (scan.executionMode === "STATIC" ? "초기 HTML 확인 · 동적 화면 미검사" : "검사 완료") : phase?.status === "RUNNING" ? "검사 중" : phase?.status === "SKIPPED" || scan.coverage[stage] === "SKIPPED" ? "선택 경로에 없음" : phase?.status === "BLOCKED" || scan.coverage[stage] === "BLOCKED" ? "접근 제한" : phase?.status === "NOT_FOUND" ? "경로 미발견" : phase?.status === "FAILED" ? "검사 실패" : "대기"
      }</span></div>; })}</div>
      <section className="rule-summary" aria-label="별도 탐색 영역">
        <div className="rule-summary-head"><strong>별도 탐색 영역</strong><span>{diagnosticSurfaceKinds.length}개 영역</span></div>
        <p>구매 3단계 밖에서 나타나는 다크패턴을 확인하기 위해 다음 화면도 별도로 찾습니다.</p>
        <div className="stage-list">{diagnosticSurfaceKinds.map((kind) => {
          const phase = scan.phaseResults?.[`surface:${kind}`];
          const status = phase?.status ?? scan.surfaceCoverage?.[kind] ?? (active ? "PENDING" : "NOT_FOUND");
          return <div className={`stage-row ${status.toLowerCase()}`} key={kind}><span className="stage-mark"/><strong>{diagnosticSurfaceLabels[kind]}</strong><span>{
            status === "COVERED" ? "검사 완료" : status === "RUNNING" ? "검사 중" : status === "DISCOVERED" ? "후보 발견·상세 미검사" : status === "BLOCKED" ? "접근 실패" : status === "FAILED" ? "검사 실패" : status === "NOT_FOUND" ? "경로 미발견" : status === "SKIPPED" ? "동적 진단에서 확인" : "탐색 대기"
          }</span></div>;
        })}</div>
      </section>
      <section className="rule-summary" aria-label="발견된 내부 경로와 화면 상태 크롤링">
        <div className="rule-summary-head"><strong>발견된 내부 경로와 화면 상태</strong><span>안전한 범위에서 탐색</span></div>
        <p>{scan.phaseResults?.["site-crawl"]?.reason ?? (active ? "내부 경로 순회 대기" : "크롤링 결과 미기록")}</p>
        <p>화면 상태 수와 고유 URL 수는 다를 수 있습니다. 발견 목록이 끝난 상태가 사이트의 모든 숨은 페이지까지 발견했다는 뜻은 아닙니다.</p>
        <div className={`stage-row ${(scan.phaseResults?.["site-crawl"]?.status ?? "PENDING").toLowerCase()}`}><span className="stage-mark"/><strong>사이트맵·내부 링크·화면 조작</strong><span>{scan.phaseResults?.["site-crawl"]?.status === "COVERED" ? "발견된 경로 순회 완료" : scan.phaseResults?.["site-crawl"]?.status === "RUNNING" ? "순회 중" : scan.phaseResults?.["site-crawl"]?.status === "BLOCKED" ? "미완료 경로 있음" : scan.phaseResults?.["site-crawl"]?.status === "FAILED" ? "크롤링 실패" : scan.phaseResults?.["site-crawl"]?.status === "SKIPPED" ? "동적 진단에서 실행" : "대기"}</span></div>
      </section>
      {scan.summary && <div className="scan-mini-summary"><span>위험 신호 <b>{scan.summary.suspected}</b></span><span>검토 필요 <b>{scan.summary.reviewNeeded}</b></span><span>미발견 <b>{scan.summary.notObserved}</b></span><span>미검사 <b>{scan.summary.notTested}</b></span></div>}
      <section className="rule-summary" aria-label="진단 항목"><div className="rule-summary-head"><strong>진단 항목</strong><span>총 {Object.keys(legalRules).length}개 유형</span></div><p>각 유형은 위험 의심·검토 필요·미발견·미검사 중 하나로 표시합니다. 증거가 부족한 항목을 정상으로 표시하지 않습니다.</p><div className="stage-list">{Object.entries(legalRules).map(([key, rule]) => { const result = scan.ruleCoverage?.[key as keyof typeof legalRules]; return <div className="stage-row" key={key}><span className="stage-mark"/><strong>{rule.title}</strong><span>{!result ? (active ? "검사 대기" : "상태 미기록") : result.status === "SUSPECTED" ? "위험 의심" : result.status === "REVIEW_NEEDED" ? "검토 필요" : result.status === "NOT_OBSERVED" ? "검사 범위에서 미발견" : "미검사"}</span></div>; })}</div></section>
      {active && <button className="action secondary" disabled={pending || scan.cancelRequested} onClick={() => act("cancel")}>진단 중단</button>}
      {reportReady && <Link className="action" href={"/report/" + id}>진단 결과 보기</Link>}
      {!active && !reportReady && <button className="action" disabled={pending} onClick={() => act("retry")}>같은 조건으로 재진단</button>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
