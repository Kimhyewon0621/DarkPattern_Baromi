import { legalRules } from "./legal-rules";
import type { Finding, Snapshot } from "./rules";
import type { SurfaceObservation } from "./purchase-journey";
import type { ReviewCandidate } from "./review-candidates";
import { ruleDecisionModes, type RuleDecisionMode } from "./rule-strategy";

const completeEngineRules = new Set<keyof typeof legalRules>(["PRESELECTION", "DRIP_PRICING", "SNEAKY_CART_ADD"]);

export type RuleCoverageStatus = "SUSPECTED" | "REVIEW_NEEDED" | "NOT_OBSERVED" | "NOT_TESTED";
export type RuleCoverageResult = {
  status: RuleCoverageStatus;
  decisionMode: RuleDecisionMode;
  reason: string;
  evidenceIds: string[];
};
export type RuleCoverage = Record<keyof typeof legalRules, RuleCoverageResult>;
export type RuleCoverageSummary = { suspected: number; reviewNeeded: number; notObserved: number; notTested: number };

export function summarizeRuleCoverage(coverage: RuleCoverage): RuleCoverageSummary {
  return Object.values(coverage).reduce<RuleCoverageSummary>((summary, result) => {
    if (result.status === "SUSPECTED") summary.suspected++;
    else if (result.status === "REVIEW_NEEDED") summary.reviewNeeded++;
    else if (result.status === "NOT_OBSERVED") summary.notObserved++;
    else summary.notTested++;
    return summary;
  }, { suspected: 0, reviewNeeded: 0, notObserved: 0, notTested: 0 });
}

type Input = {
  findings: Finding[];
  snapshots: Snapshot[];
  surfaceObservations?: SurfaceObservation[];
  siteCrawlComplete?: boolean;
  reviewCandidates?: ReviewCandidate[];
  authContext?: "ANONYMOUS" | "TEST_ACCOUNT" | "UNKNOWN";
};

const ids = (snapshots: Snapshot[]) => snapshots.map((item) => item.evidenceId ?? `evidence:${item.stage}`);

export function buildRuleCoverage({ findings, snapshots, surfaceObservations = [], siteCrawlComplete = false, reviewCandidates = [], authContext = "UNKNOWN" }: Input): RuleCoverage {
  const findingByType = new Map(findings.map((finding) => [finding.type, finding]));
  const stages = new Set(snapshots.map(({ stage }) => stage));
  const observedSurfaces = new Set(surfaceObservations.filter(({ outcome }) => outcome === "OBSERVED").map(({ kind }) => kind));
  const allEvidenceIds = [...ids(snapshots), ...surfaceObservations.filter(({ outcome }) => outcome === "OBSERVED").map(({ evidenceId }) => evidenceId)];
  const observedSurface = (kind: SurfaceObservation["kind"]) => surfaceObservations.filter((item) => item.kind === kind && item.outcome === "OBSERVED");
  const covered = (requiredStages: Snapshot["stage"][], requiredSurfaces: SurfaceObservation["kind"][] = [], controlStages: Snapshot["stage"][] = []) =>
    requiredStages.every((stage) => stages.has(stage)) && requiredSurfaces.every((kind) => observedSurfaces.has(kind))
    && controlStages.every((stage) => snapshots.some((snapshot) => snapshot.stage === stage && snapshot.decisionControls !== undefined));
  const missing = (requiredStages: Snapshot["stage"][], requiredSurfaces: SurfaceObservation["kind"][] = [], controlStages: Snapshot["stage"][] = []) => [
    ...requiredStages.filter((stage) => !stages.has(stage)).map((stage) => `${stage} 화면`),
    ...requiredSurfaces.filter((kind) => !observedSurfaces.has(kind)).map((kind) => siteCrawlComplete ? `${kind} 영역의 검사 가능한 화면` : `${kind} 별도 영역`),
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
  const evidenceFor = (type: keyof typeof legalRules) => {
    const requirement = requirements[type];
    const stageIds = snapshots.filter(({ stage }) => requirement.stages.includes(stage)).map((item) => item.evidenceId ?? `evidence:${item.stage}`);
    const surfaceIds = surfaceObservations.filter((item) => item.outcome === "OBSERVED" && requirement.surfaces?.includes(item.kind)).map(({ evidenceId }) => evidenceId);
    const controlIds = snapshots.filter((snapshot) => requirement.controlStages?.includes(snapshot.stage) && snapshot.decisionControls !== undefined)
      .map((item) => item.evidenceId ?? `evidence:${item.stage}`);
    return [...new Set([...stageIds, ...surfaceIds, ...controlIds])].slice(0, 20);
  };

  const results = Object.fromEntries((Object.keys(legalRules) as (keyof typeof legalRules)[]).map((type) => {
    const finding = findingByType.get(type);
    if (finding) return [type, {
      status: finding.status, reason: finding.reason,
      evidenceIds: finding.evidenceIds ?? ids(finding.evidence),
    }];
    const reviewCandidate = reviewCandidates.find((candidate) => candidate.ruleType === type);
    if (reviewCandidate) return [type, {
      status: "REVIEW_NEEDED" as const, reason: reviewCandidate.reason,
      evidenceIds: reviewCandidate.evidenceIds,
    }];
    if (type === "CANCELLATION_OBSTRUCTION") {
      const subscription = observedSurface("SUBSCRIPTION");
      const cancellation = observedSurface("CANCELLATION");
      if (subscription.length && cancellation.length) return [type, {
        status: "NOT_TESTED" as const,
        reason: "구독과 해지 화면은 찾았지만 실제 단계 수와 접근성을 비교할 판정기를 아직 연결하지 않았습니다.",
        evidenceIds: [...subscription, ...cancellation].map(({ evidenceId }) => evidenceId),
      }];
    }
    const requirement = requirements[type];
    if (type === "SNEAKY_CART_ADD" && snapshots.find(({ stage }) => stage === "cart")?.cartItemCount === undefined) {
      return [type, { status: "NOT_TESTED" as const, reason: "장바구니의 품목 수를 확정할 수 없어 자동 추가 여부를 검사하지 못했습니다.", evidenceIds: evidenceFor(type) }];
    }
    const requiredSurfaces = requirement.surfaces ?? [];
    const requiredControls = requirement.controlStages ?? [];
    if (!covered(requirement.stages, requiredSurfaces, requiredControls)) {
      const gaps = missing(requirement.stages, requiredSurfaces, requiredControls);
      return [type, {
        status: "NOT_TESTED" as const,
        reason: `필요한 증거를 수집하지 못했습니다: ${gaps.join(", ")}.`,
        evidenceIds: evidenceFor(type),
      }];
    }
    if (type === "FORCED_ACTION") {
      if (authContext === "ANONYMOUS") return [type, {
        status: "NOT_OBSERVED" as const,
        reason: "비회원 상태로 주문서 화면까지 도달했고 로그인·가입 차단이 관찰되지 않았습니다.",
        evidenceIds: evidenceFor(type),
      }];
      return [type, {
        status: "NOT_TESTED" as const,
        reason: authContext === "TEST_ACCOUNT"
          ? "테스트 계정으로 주문서에 도달해 비회원 구매에서 인증을 강제하는지는 확인하지 못했습니다."
          : "주문서 화면은 확보했지만 비회원 또는 테스트 계정 경로인지 확인할 수 없습니다.",
        evidenceIds: evidenceFor(type),
      }];
    }
    if (ruleDecisionModes[type] === "BASIC_ENGINE" && !completeEngineRules.has(type)) return [type, {
      status: "NOT_TESTED" as const,
      reason: "필요한 화면은 수집했지만 이 유형의 기본 엔진 판정기를 아직 연결하지 않았습니다.",
      evidenceIds: evidenceFor(type),
    }];
    if (ruleDecisionModes[type] === "AI_CONTEXT") return [type, {
      status: "NOT_TESTED" as const,
      reason: "필요 화면은 확보했지만 유형이 지정된 AI 검토 후보가 없어 맥락 검토를 요청하지 못했습니다.",
      evidenceIds: evidenceFor(type),
    }];
    return [type, {
      status: "NOT_OBSERVED" as const,
      reason: "검사한 범위에서 이 유형의 신호가 관찰되지 않았습니다.",
      evidenceIds: allEvidenceIds,
    }];
  })) as Record<keyof typeof legalRules, Omit<RuleCoverageResult, "decisionMode">>;
  return Object.fromEntries((Object.keys(legalRules) as (keyof typeof legalRules)[]).map((type) => [type, {
    ...results[type], decisionMode: ruleDecisionModes[type],
  }])) as RuleCoverage;
}
