import { legalRules } from "./legal-rules";
import type { Finding, Snapshot } from "./rules";
import type { SurfaceObservation } from "./purchase-journey";
import type { ReviewCandidate } from "./review-candidates";
import { ruleDecisionCriteria, ruleDecisionModes, type RuleDecisionMode } from "./rule-strategy";
import { assessMisdirectedHierarchy } from "./detectors/misdirected-hierarchy";
import { assessCancellationObstruction } from "./detectors/cancellation-obstruction";
import type { CrawledSitePage } from "./site-crawler";
import { isPreAuthConsentPage } from "./detectors/preselection";
import { assessPriceComparison } from "./detectors/price-comparison";
import { assessDripPricing } from "./detectors/drip-pricing";
import { assessBaitSelling } from "./detectors/bait-selling";
import type { FirstPriceExposure } from "./price-ledger";

export type RuleCoverageStatus = "SUSPECTED" | "REVIEW_NEEDED" | "NOT_OBSERVED" | "NOT_TESTED";
export type RuleCoverageResult = {
  status: RuleCoverageStatus;
  decisionMode: RuleDecisionMode;
  decisionCriteria: string;
  reason: string;
  evidenceIds: string[];
};
export type RuleCoverage = Record<keyof typeof legalRules, RuleCoverageResult>;
export type RuleCoverageSummary = { suspected: number; reviewNeeded: number; notObserved: number; notTested: number };

/** Keep detail endpoints and the 16-rule verdict table on the same final status. */
export function findingsForRuleCoverage<T extends { type: string; status: string }>(findings: T[], coverage: RuleCoverage) {
  return findings.flatMap((finding) => {
    const status = coverage[finding.type as keyof RuleCoverage]?.status;
    return status === "SUSPECTED" || status === "REVIEW_NEEDED" ? [{ ...finding, status }] : [];
  });
}

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
  siteCrawlPages?: CrawledSitePage[];
  siteCrawl?: { pages?: CrawledSitePage[]; complete?: boolean };
  siteCrawlComplete?: boolean;
  reviewCandidates?: ReviewCandidate[];
  authContext?: "ANONYMOUS" | "TEST_ACCOUNT" | "UNKNOWN";
  priceLedger?: { firstPriceExposure?: FirstPriceExposure | { status: "NOT_VERIFIED" } };
  firstPriceExposure?: FirstPriceExposure;
};

const ids = (snapshots: Snapshot[]) => snapshots.map((item) => item.evidenceId ?? `evidence:${item.stage}`);

export function buildRuleCoverage({ findings, snapshots, surfaceObservations = [], siteCrawlPages = [], siteCrawl, siteCrawlComplete = false, reviewCandidates = [], authContext = "UNKNOWN", firstPriceExposure, priceLedger }: Input): RuleCoverage {
  const crawledPages = siteCrawlPages.length ? siteCrawlPages : siteCrawl?.pages ?? [];
  const crawlComplete = siteCrawlComplete || siteCrawl?.complete === true;
  const preAuthPages = crawledPages.filter(isPreAuthConsentPage);
  const preAuthControlsComplete = preAuthPages.length > 0
    && preAuthPages.every((page) => page.interactiveInventoryComplete === true);
  const findingByType = new Map<keyof typeof legalRules, Finding[]>();
  for (const finding of findings) findingByType.set(finding.type, [...(findingByType.get(finding.type) ?? []), finding]);
  const stages = new Set(snapshots.map(({ stage }) => stage));
  const observedSurfaces = new Set(surfaceObservations.filter(({ outcome }) => outcome === "OBSERVED").map(({ kind }) => kind));
  const allEvidenceIds = [...ids(snapshots), ...surfaceObservations.filter(({ outcome }) => outcome === "OBSERVED").map(({ evidenceId }) => evidenceId)];
  const observedSurface = (kind: SurfaceObservation["kind"]) => surfaceObservations.filter((item) => item.kind === kind && item.outcome === "OBSERVED");
  const covered = (requiredStages: Snapshot["stage"][], requiredSurfaces: SurfaceObservation["kind"][] = [], controlStages: Snapshot["stage"][] = []) =>
    requiredStages.every((stage) => stages.has(stage)) && requiredSurfaces.every((kind) => observedSurfaces.has(kind))
    && controlStages.every((stage) => snapshots.some((snapshot) => snapshot.stage === stage && snapshot.decisionControls !== undefined));
  const missing = (requiredStages: Snapshot["stage"][], requiredSurfaces: SurfaceObservation["kind"][] = [], controlStages: Snapshot["stage"][] = []) => [
    ...requiredStages.filter((stage) => !stages.has(stage)).map((stage) => `${stage} 화면`),
    ...requiredSurfaces.filter((kind) => !observedSurfaces.has(kind)).map((kind) => crawlComplete ? `${kind} 영역의 검사 가능한 화면` : `${kind} 별도 영역`),
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
    // This pattern can be evidenced in account/navigation surfaces without
    // reaching checkout; the crawl candidate itself carries the peer comparison.
    MISDIRECTED_HIERARCHY: { stages: [] },
    CANCELLATION_OBSTRUCTION: { stages: [], surfaces: ["SUBSCRIPTION", "CANCELLATION"] },
    PRICE_COMPARISON_OBSTRUCTION: { stages: ["product", "checkout"] },
  };
  const evidenceFor = (type: keyof typeof legalRules) => {
    const requirement = requirements[type];
    const stageIds = snapshots.filter(({ stage }) => requirement.stages.includes(stage)).map((item) => item.evidenceId ?? `evidence:${item.stage}`);
    const surfaceIds = surfaceObservations.filter((item) => item.outcome === "OBSERVED" && requirement.surfaces?.includes(item.kind)).map(({ evidenceId }) => evidenceId);
    const controlIds = snapshots.filter((snapshot) => requirement.controlStages?.includes(snapshot.stage) && snapshot.decisionControls !== undefined)
      .map((item) => item.evidenceId ?? `evidence:${item.stage}`);
    const hierarchyIds = type === "MISDIRECTED_HIERARCHY" ? snapshots.filter(({ stage }) => stage === "checkout")
      .map((item) => item.evidenceId ?? `evidence:${item.stage}`) : [];
    const authIds = type === "PRESELECTION" ? preAuthPages.map(({ evidenceId }) => evidenceId) : [];
    return [...new Set([...stageIds, ...surfaceIds, ...controlIds, ...hierarchyIds, ...authIds])].slice(0, 20);
  };

  const results = Object.fromEntries((Object.keys(legalRules) as (keyof typeof legalRules)[]).map((type) => {
    const typeFindings = findingByType.get(type);
    if (typeFindings?.length) {
      const suspected = typeFindings.some((finding) => finding.status === "SUSPECTED");
      const status = suspected ? "SUSPECTED" as const
        : ruleDecisionModes[type] === "AI_CONTEXT" ? "REVIEW_NEEDED" as const : "NOT_OBSERVED" as const;
      return [type, {
        status,
        reason: status === "NOT_OBSERVED"
          ? `관찰된 신호가 바로미의 엄격한 ${legalRules[type].title} 기준을 충족하지 않았습니다. ${[...new Set(typeFindings.map((finding) => finding.reason))].join(" · ")}`
          : [...new Set(typeFindings.map((finding) => finding.reason))].join(" · "),
        evidenceIds: [...new Set(typeFindings.flatMap((finding) => finding.evidenceIds ?? ids(finding.evidence)))],
      }];
    }
    const reviewCandidate = reviewCandidates.find((candidate) => candidate.ruleType === type);
    if (type === "CANCELLATION_OBSTRUCTION") {
      const assessment = assessCancellationObstruction(surfaceObservations, crawledPages);
      if (assessment) return [type, assessment];
      const subscription = observedSurface("SUBSCRIPTION");
      const cancellation = observedSurface("CANCELLATION");
      if (subscription.length && cancellation.length) return [type, {
        status: "NOT_TESTED" as const,
        reason: "구독과 해지 화면은 찾았지만 같은 서비스의 온라인 가입 화면·해지 선택지·단계 수를 함께 확인하지 못했습니다.",
        evidenceIds: [...subscription, ...cancellation].map(({ evidenceId }) => evidenceId),
      }];
    }
    if (type === "BAIT_SELLING") {
      const exposure = firstPriceExposure ?? (priceLedger?.firstPriceExposure?.status === "OBSERVED" ? priceLedger.firstPriceExposure as FirstPriceExposure : undefined);
      const assessment = assessBaitSelling(exposure, snapshots);
      if (assessment) return [type, assessment];
    }
    const requirement = requirements[type];
    const cartSnapshot = snapshots.find(({ stage }) => stage === "cart");
    if (type === "SNEAKY_CART_ADD" && cartSnapshot?.inspection && cartSnapshot.cartContentsVerified !== true) return [type, {
      status: "NOT_TESTED" as const,
      reason: cartSnapshot.cartLinesComplete !== true
        ? "장바구니의 실제 상품 행에서 안정적인 식별자를 모두 읽지 못해 무단 추가 여부를 판정하지 않았습니다."
        : cartSnapshot.cartCountBeforeAdd !== 0
          ? "담기 전 장바구니가 비어 있음을 확인하지 못해 기존 상품과 새로 추가된 상품을 분리하지 못했습니다."
          : cartSnapshot.requestedProductIdentity !== cartSnapshot.cartLineIdentities?.[0]
            ? "담기 전후 수량과 상품 행은 수집했지만 요청한 상품 식별자가 장바구니 행과 일치하지 않아 판정을 보류했습니다."
            : "담기 전후 장바구니 수량 또는 선택 수량을 함께 확인하지 못해 무단 추가 여부를 판정하지 않았습니다.",
      evidenceIds: evidenceFor(type),
    }];
    if (type === "SNEAKY_CART_ADD" && cartSnapshot?.inspection && (
      cartSnapshot.cartCountBeforeAdd === undefined || cartSnapshot.cartItemCount === undefined || cartSnapshot.requestedQuantity === undefined
    )) return [type, {
      status: "NOT_TESTED" as const,
      reason: "담기 전후 장바구니 수량 또는 사용자가 요청한 선택 수량을 함께 확인하지 못해 무단 추가 여부를 판정하지 못했습니다.",
      evidenceIds: evidenceFor(type),
    }];
    if (type === "SNEAKY_CART_ADD" && cartSnapshot?.cartItemCount === undefined) {
      return [type, { status: "NOT_TESTED" as const, reason: "장바구니의 품목 수를 확정할 수 없어 자동 추가 여부를 검사하지 못했습니다.", evidenceIds: evidenceFor(type) }];
    }
    if (type === "HIDDEN_SUBSCRIPTION" && crawlComplete && !observedSurface("SUBSCRIPTION").length && !reviewCandidate) {
      const checkout = snapshots.find((snapshot) => snapshot.stage === "checkout");
      if (checkout?.inspection?.visibleText === "COMPLETE") return [type, {
        status: "NOT_OBSERVED" as const,
        reason: "주문서 문구와 완료된 공개·로그인 화면 탐색에서 체험형 구독이나 자동 갱신 조건을 관찰하지 못했습니다.",
        evidenceIds: [checkout.evidenceId ?? "evidence:checkout", ...crawledPages.filter((page) => page.outcome === "OBSERVED").map((page) => page.evidenceId)].slice(0, 20),
      }];
    }
    // A typed rule signal takes precedence over missing coverage elsewhere.
    // Contextual rules remain REVIEW_NEEDED; deterministic rules must satisfy
    // their own threshold or resolve as NOT_OBSERVED.
    if (reviewCandidate) {
      const status = reviewCandidate.findingStatus ?? (ruleDecisionModes[type] === "AI_CONTEXT" ? "REVIEW_NEEDED" as const : "NOT_OBSERVED" as const);
      return [type, {
      status, reason: status === "NOT_OBSERVED"
        ? `관찰된 신호가 바로미의 엄격한 ${legalRules[type].title} 기준을 충족하지 않았습니다. ${reviewCandidate.reason}`
        : reviewCandidate.reason,
      evidenceIds: reviewCandidate.evidenceIds,
      }];
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
    if (type === "URGENCY_SCARCITY") {
      const product = snapshots.find((snapshot) => snapshot.stage === "product");
      if (product?.inspection?.visibleText === "COMPLETE" && crawlComplete) return [type, {
        status: "NOT_OBSERVED" as const,
        reason: "상품 상세의 문구와 완료된 공개 화면 탐색에서 긴급성·희소성 신호를 관찰하지 못했습니다.",
        evidenceIds: [...new Set([product.evidenceId ?? "evidence:product", ...crawledPages.filter((page) => page.outcome === "OBSERVED").map((page) => page.evidenceId)])].slice(0, 20),
      }];
      return [type, {
        status: "NOT_TESTED" as const,
        reason: "상품 상세 문구 수집 또는 공개 화면 탐색이 완료되지 않아 긴급성·희소성 신호의 부재를 판단하지 않았습니다.",
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
    if (type === "MISDIRECTED_HIERARCHY") {
      const assessments = snapshots.filter((snapshot) => snapshot.stage === "checkout").flatMap((snapshot) => {
        const result = assessMisdirectedHierarchy(snapshot);
        return result ? [result] : [];
      });
      if (assessments.length && assessments.every(({ status }) => status === "NOT_OBSERVED")) return [type, {
        status: "NOT_OBSERVED" as const,
        reason: assessments.map(({ reason }) => reason).join(" · "),
        evidenceIds: [...new Set(assessments.flatMap(({ evidenceIds }) => evidenceIds))],
      }];
      return [type, {
        status: "NOT_TESTED" as const,
        reason: "같은 결정의 수락·거절 선택지 또는 계정 종료 동작을 비교할 화면 증거를 확보하지 못했습니다.",
        evidenceIds: evidenceFor(type),
      }];
    }
    if (type === "PRICE_COMPARISON_OBSTRUCTION") {
      const assessment = assessPriceComparison(snapshots);
      if (assessment) return [type, assessment];
      return [type, {
        status: "NOT_TESTED" as const,
        reason: "동일 상품의 단위·수량·옵션·필수 비용과 상품 화면 및 주문서의 총액을 같은 조건으로 대조할 증거가 부족합니다.",
        evidenceIds: evidenceFor(type),
      }];
    }
    if (type === "PRESELECTION") {
      const inspected = ["product", "checkout"].map((stage) => snapshots.find((item) => item.stage === stage));
      if (inspected.every((snapshot) => snapshot?.inspection?.choiceControls === "COMPLETE" && snapshot.choiceControls !== undefined)
        && preAuthControlsComplete) return [type, {
        status: "NOT_OBSERVED" as const,
        reason: "인증 전 로그인·가입 화면과 상품·주문서 화면에서 선택지의 초기 상태와 라벨을 확인했으며 사전 선택 신호가 없었습니다.",
        evidenceIds: evidenceFor(type),
      }];
      return [type, {
        status: "NOT_TESTED" as const,
        reason: preAuthPages.length === 0
          ? "상품·주문서 선택지는 확인했더라도 인증 전 로그인·가입 화면의 동의 선택지를 확보하지 못해 사전 선택 여부를 완전히 판정하지 않았습니다."
          : !preAuthControlsComplete
            ? "인증 전 로그인·가입 화면의 선택지 추출이 불완전해 사전 선택 여부를 판정하지 않았습니다."
            : "상품과 주문서 양쪽에서 초기 선택 상태와 라벨을 모두 읽지 못해 사전 선택 여부를 판단하지 않았습니다.",
        evidenceIds: evidenceFor(type),
      }];
    }
    if (type === "DRIP_PRICING") {
      const assessment = assessDripPricing(snapshots);
      if (assessment) return [type, assessment];
      const product = snapshots.find((item) => item.stage === "product");
      const checkout = snapshots.find((item) => item.stage === "checkout");
      return [type, {
        status: "NOT_TESTED" as const,
        reason: product?.inspection?.prices === "COMPLETE" && product.inspection.feeRows === "COMPLETE"
          && checkout?.inspection?.prices === "COMPLETE" && checkout.inspection.feeRows === "COMPLETE"
          ? "가격과 비용 문구는 추출했지만 상품가·이전 가격·배송 조건과 주문서 결제 금액의 역할을 구분해 같은 조건의 총액으로 연결하지 못했습니다."
          : "상품 화면과 주문서 양쪽의 가격·필수 비용 행을 모두 수집하지 못해 순차공개 가격을 판정하지 않았습니다.",
        evidenceIds: evidenceFor(type),
      }];
    }
    if (type === "SNEAKY_CART_ADD") {
      const cart = cartSnapshot;
      const noUnexpectedIncrease = cart?.cartCountBeforeAdd !== undefined && cart.cartItemCount !== undefined
        && cart.requestedQuantity !== undefined
        && cart.cartItemCount - cart.cartCountBeforeAdd === cart.requestedQuantity;
      if (cart?.inspection?.cartCount === "OBSERVED" && cart.cartContentsVerified === true && noUnexpectedIncrease) return [type, {
        status: "NOT_OBSERVED" as const,
        reason: `담기 전후 장바구니 수량을 비교했고, 증가량이 요청한 선택 수량(${cart.requestedQuantity}개)과 일치했습니다.`,
        evidenceIds: evidenceFor(type),
      }];
    }
    if (type === "BAIT_SELLING") {
      const exposure = firstPriceExposure ?? (priceLedger?.firstPriceExposure?.status === "OBSERVED" ? priceLedger.firstPriceExposure as FirstPriceExposure : undefined);
      const product = snapshots.find((item) => item.stage === "product");
      const cart = cartSnapshot;
      const checkout = snapshots.find((item) => item.stage === "checkout");
      const pathReached = Boolean(exposure && product && checkout && cart);
      return [type, {
        status: "NOT_TESTED" as const,
        reason: pathReached && cart?.cartContentsVerified !== true
          ? "목록에서 선택한 상품의 상세·주문서까지 도달했지만, 장바구니 실제 상품 행과 선택한 상품의 동일성을 검증하지 못해 유인 판매가 없다고 판정하지 않았습니다."
          : "목록에서 선택한 상품과 상세 화면의 구매 가능 여부를 같은 상품으로 연결할 증거가 부족합니다.",
        evidenceIds: evidenceFor(type),
      }];
    }
    if (ruleDecisionModes[type] === "AI_CONTEXT") return [type, {
      status: "NOT_TESTED" as const,
      reason: "필요 화면은 확보했지만 유형이 지정된 AI 검토 후보가 없어 맥락 검토를 요청하지 못했습니다.",
      evidenceIds: evidenceFor(type),
    }];
    // Reaching a required page is not proof that the rule's decision criteria
    // were inspected. Only rule-specific assessments above may emit
    // NOT_OBSERVED; unimplemented or incomplete inspections stay explicit.
    return [type, {
      status: "NOT_TESTED" as const,
      reason: "필요 화면은 확보했지만 이 유형의 필수 판정 조건을 확인했다는 구조화 증거가 없습니다.",
      evidenceIds: evidenceFor(type),
    }];
  })) as Record<keyof typeof legalRules, Omit<RuleCoverageResult, "decisionMode" | "decisionCriteria">>;
  const observedCrawlEvidence = crawledPages
    .filter((page) => page.outcome === "OBSERVED")
    .map((page) => page.evidenceId)
    .filter((evidenceId): evidenceId is string => Boolean(evidenceId));
  const crawlHasObservedEvidence = crawlComplete && observedCrawlEvidence.length > 0;

  return Object.fromEntries((Object.keys(legalRules) as (keyof typeof legalRules)[]).map((type) => {
    const result = results[type];
    // Our strict baseline is signal-led: only a rule-specific positive signal
    // becomes a finding/review. Once the crawl actually completed and read
    // pages, absence of that signal is NOT_OBSERVED instead of a generic
    // "insufficient evidence" result. Keep NOT_TESTED for scans that did not
    // finish reading any pages, where absence cannot be established at all.
    // A completed site crawl does not replace rule-specific evidence. In
    // particular, preselection needs a complete inventory of the pre-auth
    // choice controls; hierarchy needs comparable controls; and surface rules
    // need their corresponding surface. Keep those explicit coverage gaps as
    // NOT_TESTED instead of letting unrelated pages erase them.
    const hasRuleSpecificCoverage = covered(requirements[type].stages, requirements[type].surfaces ?? [], requirements[type].controlStages ?? [])
      && (type !== "PRESELECTION" || preAuthControlsComplete)
      && (type !== "MISDIRECTED_HIERARCHY" || snapshots.some((snapshot) => snapshot.decisionControls !== undefined)
        || crawledPages.some((page) => page.interactiveInventoryComplete === true && page.domText?.some((entry) => entry.region)));
    const resolved = result.status === "NOT_TESTED" && crawlHasObservedEvidence && hasRuleSpecificCoverage
      ? {
        ...result,
        status: "NOT_OBSERVED" as const,
        reason: "완료된 크롤링과 구매 화면에서 해당 유형의 엄격한 판정 기준에 해당하는 신호를 발견하지 못했습니다.",
        evidenceIds: [...new Set([...result.evidenceIds, ...observedCrawlEvidence])].slice(0, 20),
      }
      : result;
    return [type, {
      ...resolved,
      decisionMode: ruleDecisionModes[type],
      decisionCriteria: ruleDecisionCriteria[type],
    }];
  })) as RuleCoverage;
}
