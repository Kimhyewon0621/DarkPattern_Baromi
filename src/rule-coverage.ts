import { legalRules } from "./legal-rules";
import type { Finding, Snapshot } from "./rules";
import type { SurfaceObservation } from "./purchase-journey";
import type { ReviewCandidate } from "./review-candidates";

export type RuleCoverageStatus = "SUSPECTED" | "REVIEW_NEEDED" | "NOT_OBSERVED" | "NOT_TESTED";
export type RuleCoverage = Record<keyof typeof legalRules, {
  status: RuleCoverageStatus;
  reason: string;
  evidenceIds: string[];
}>;

type Input = {
  findings: Finding[];
  snapshots: Snapshot[];
  surfaceObservations?: SurfaceObservation[];
  reviewCandidates?: ReviewCandidate[];
};

const ids = (snapshots: Snapshot[]) => snapshots.map((item) => item.evidenceId ?? `evidence:${item.stage}`);

export function buildRuleCoverage({ findings, snapshots, surfaceObservations = [], reviewCandidates = [] }: Input): RuleCoverage {
  const findingByType = new Map(findings.map((finding) => [finding.type, finding]));
  const stages = new Set(snapshots.map(({ stage }) => stage));
  const observedSurfaces = new Set(surfaceObservations.filter(({ outcome }) => outcome === "OBSERVED").map(({ kind }) => kind));
  const allEvidenceIds = [...ids(snapshots), ...surfaceObservations.filter(({ outcome }) => outcome === "OBSERVED").map(({ evidenceId }) => evidenceId)];
  const observedSurface = (kind: SurfaceObservation["kind"]) => surfaceObservations.filter((item) => item.kind === kind && item.outcome === "OBSERVED");
  const surfaceSignals: Partial<Record<keyof typeof legalRules, { kind: SurfaceObservation["kind"]; pattern: RegExp; reason: string }>> = {
    DISGUISED_AD: { kind: "RECOMMENDATION", pattern: /광고|협찬|스폰서|sponsored|\bad\b/i, reason: "추천·콘텐츠 영역에서 광고성 표현을 확인했습니다. 실제 광고 표기와 일반 콘텐츠의 구분을 검토하세요." },
    FALSE_RECOMMENDATION: { kind: "RECOMMENDATION", pattern: /구매자?\s*추천|베스트\s*리뷰|인기\s*상품|추천\s*순위|최저가|실시간\s*인기/i, reason: "추천·인기·후기 표현을 확인했습니다. 추천 근거와 산정 기준을 추가 확인해야 합니다." },
    BAIT_SELLING: { kind: "CATALOG", pattern: /품절|재고\s*없음|판매\s*불가|구매\s*불가|sold\s*out|out\s*of\s*stock/i, reason: "목록·카테고리 영역에서 구매 불가 표현을 확인했습니다. 노출 상품의 실제 구매 가능 여부를 대조하세요." },
  };
  const covered = (requiredStages: Snapshot["stage"][], requiredSurfaces: SurfaceObservation["kind"][] = [], controlStages: Snapshot["stage"][] = []) =>
    requiredStages.every((stage) => stages.has(stage)) && requiredSurfaces.every((kind) => observedSurfaces.has(kind))
    && controlStages.every((stage) => snapshots.some((snapshot) => snapshot.stage === stage && snapshot.decisionControls !== undefined));
  const missing = (requiredStages: Snapshot["stage"][], requiredSurfaces: SurfaceObservation["kind"][] = [], controlStages: Snapshot["stage"][] = []) => [
    ...requiredStages.filter((stage) => !stages.has(stage)).map((stage) => `${stage} 화면`),
    ...requiredSurfaces.filter((kind) => !observedSurfaces.has(kind)).map((kind) => `${kind} 별도 영역`),
    ...controlStages.filter((stage) => !snapshots.some((snapshot) => snapshot.stage === stage && snapshot.decisionControls !== undefined)).map((stage) => `${stage} 선택지 구조`),
  ];
  const requirements: Record<keyof typeof legalRules, { stages: Snapshot["stage"][]; surfaces?: SurfaceObservation["kind"][]; controlStages?: Snapshot["stage"][] }> = {
    PRESELECTION: { stages: ["product", "checkout"] },
    DRIP_PRICING: { stages: ["product", "checkout"] },
    URGENCY_SCARCITY: { stages: ["product"] },
    HIDDEN_INFO: { stages: ["product"] },
    FALSE_DISCOUNT: { stages: ["product"] },
    DISGUISED_AD: { stages: [], surfaces: ["RECOMMENDATION"] },
    CONFIRM_SHAMING: { stages: ["checkout"], controlStages: ["checkout"] },
    FORCED_ACTION: { stages: ["checkout"] },
    HIDDEN_SUBSCRIPTION: { stages: ["checkout"], surfaces: ["SUBSCRIPTION"] },
    SNEAKY_CART_ADD: { stages: ["product", "cart"] },
    FALSE_RECOMMENDATION: { stages: [], surfaces: ["RECOMMENDATION"] },
    BAIT_SELLING: { stages: ["product"], surfaces: ["CATALOG"] },
    TRICK_QUESTION: { stages: ["checkout"], controlStages: ["checkout"] },
    MISDIRECTED_HIERARCHY: { stages: ["checkout"], controlStages: ["checkout"] },
    CANCELLATION_OBSTRUCTION: { stages: [], surfaces: ["SUBSCRIPTION", "CANCELLATION"] },
    PRICE_COMPARISON_OBSTRUCTION: { stages: ["product", "checkout"] },
  };

  return Object.fromEntries((Object.keys(legalRules) as (keyof typeof legalRules)[]).map((type) => {
    const finding = findingByType.get(type);
    // A finding cites one purchase-stage snapshot; crawled screens with the same
    // signal (for example a preselected login consent) stay linked as evidence.
    if (finding) return [type, {
      status: finding.status, reason: finding.reason,
      evidenceIds: [...new Set([...(finding.evidenceIds ?? ids(finding.evidence)),
        ...reviewCandidates.filter((candidate) => candidate.ruleType === type).flatMap((candidate) => candidate.evidenceIds)])],
    }];
    const reviewCandidate = reviewCandidates.find((candidate) => candidate.ruleType === type);
    if (reviewCandidate) return [type, {
      status: "REVIEW_NEEDED" as const, reason: reviewCandidate.reason,
      evidenceIds: reviewCandidate.evidenceIds,
    }];
    const signal = surfaceSignals[type];
    if (signal) {
      const matches = observedSurface(signal.kind).filter(({ text, title }) => signal.pattern.test(`${title} ${text}`));
      if (matches.length) return [type, {
        status: "REVIEW_NEEDED" as const, reason: signal.reason,
        evidenceIds: matches.map(({ evidenceId }) => evidenceId),
      }];
    }
    if (type === "CANCELLATION_OBSTRUCTION") {
      const subscription = observedSurface("SUBSCRIPTION");
      const cancellation = observedSurface("CANCELLATION");
      if (subscription.length && cancellation.length) return [type, {
        status: "REVIEW_NEEDED" as const,
        reason: "구독과 해지 화면은 찾았지만 실제 단계 수와 접근성을 비교하지 않았습니다. 두 경로를 직접 대조하세요.",
        evidenceIds: [...subscription, ...cancellation].map(({ evidenceId }) => evidenceId),
      }];
    }
    const requirement = requirements[type];
    if (type === "SNEAKY_CART_ADD" && snapshots.find(({ stage }) => stage === "cart")?.cartItemCount === undefined) {
      return [type, { status: "NOT_TESTED" as const, reason: "장바구니의 품목 수를 확정할 수 없어 자동 추가 여부를 검사하지 못했습니다.", evidenceIds: allEvidenceIds }];
    }
    const requiredSurfaces = requirement.surfaces ?? [];
    const requiredControls = requirement.controlStages ?? [];
    if (!covered(requirement.stages, requiredSurfaces, requiredControls)) {
      const gaps = missing(requirement.stages, requiredSurfaces, requiredControls);
      return [type, {
        status: "NOT_TESTED" as const,
        reason: `필요한 증거를 수집하지 못했습니다: ${gaps.join(", ")}.`,
        evidenceIds: allEvidenceIds,
      }];
    }
    return [type, {
      status: "NOT_OBSERVED" as const,
      reason: "검사한 범위에서 이 유형의 신호가 관찰되지 않았습니다.",
      evidenceIds: allEvidenceIds,
    }];
  })) as RuleCoverage;
}
