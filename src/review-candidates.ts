import type { Finding, Snapshot } from "./rules";
import type { SurfaceObservation } from "./purchase-journey";
import type { CrawledSitePage } from "./site-crawler";
import { legalRules } from "./legal-rules";
import { contextualRuleTypes, type RuleType } from "./rule-strategy";

export type ReviewCandidate = {
  id: string;
  kind: "FEE_SEMANTICS" | "OPTION_SEMANTICS" | "SURFACE_FLOW" | "EXPLORATION_UNVERIFIED" | "VISUAL_ACCESSIBILITY" | "SEMANTIC_REVIEW";
  stage: Snapshot["stage"] | "surface";
  text: string;
  reason: string;
  evidenceIds: string[];
  ruleType?: Finding["type"];
};

/** Maps evidence to the rule questions it can inform without interpreting the
 * merchant's wording as proof of a violation. AI receives these as review
 * questions; it may return insufficient evidence and never overwrites facts. */
type EvidenceQuestion = {
  stages?: Snapshot["stage"][];
  surfaces?: SurfaceObservation["kind"][];
  crawl?: boolean;
  reason: string;
};

const evidenceQuestions = {
  URGENCY_SCARCITY: { stages: ["product"], crawl: true, reason: "긴급성·희소성 표현의 실제 근거와 표시 맥락을 확인해야 합니다." },
  HIDDEN_INFO: { stages: ["product", "cart", "checkout"], crawl: true, reason: "중요 조건의 표시 위치·가독성·누락 여부를 화면 맥락에서 검토해야 합니다." },
  FALSE_DISCOUNT: { stages: ["product"], crawl: true, reason: "표시된 할인 기준 가격의 실제 이력은 화면만으로 검증할 수 없습니다." },
  DISGUISED_AD: { surfaces: ["RECOMMENDATION"], crawl: true, reason: "추천·콘텐츠와 광고 표시의 관계를 화면 맥락에서 검토해야 합니다." },
  CONFIRM_SHAMING: { stages: ["checkout"], crawl: true, reason: "선택지 문구가 거부를 감정적으로 압박하는지 검토해야 합니다." },
  HIDDEN_SUBSCRIPTION: { stages: ["product", "checkout"], surfaces: ["SUBSCRIPTION"], crawl: true, reason: "체험·자동 갱신·청구 조건의 고지 맥락을 검토해야 합니다." },
  FALSE_RECOMMENDATION: { surfaces: ["RECOMMENDATION"], crawl: true, reason: "추천·인기·후기의 표시와 실제 산정 근거를 대조해야 합니다." },
  TRICK_QUESTION: { stages: ["checkout"], crawl: true, reason: "질문·동의 문구와 실제 선택 결과가 일치하는지 맥락을 검토해야 합니다." },
} satisfies Record<(typeof contextualRuleTypes)[number], EvidenceQuestion>;

const reviewReason = "관찰 내용은 수집했지만, 의미와 맥락을 자동으로 확정하지 않았습니다. 근거 화면을 검토해야 합니다.";

function boundedText(parts: Array<string | undefined>, maxLength = 1_000) {
  return [...new Set(parts.map((part) => part?.replace(/\s+/g, " ").trim()).filter((part): part is string => Boolean(part)))].join("\n").slice(0, maxLength);
}

/** Preserve observations for later semantic review without assigning a rule
 * from merchant-specific or phrase-specific keyword lists. */
export function collectReviewCandidates(snapshots: Snapshot[]): ReviewCandidate[] {
  return snapshots.flatMap((snapshot) => {
    const evidenceId = snapshot.evidenceId ?? `evidence:${snapshot.stage}`;
    const text = boundedText([
      ...(snapshot.textLines ?? []), ...(snapshot.priceLines ?? []),
      ...snapshot.options.map(({ label, won, selected }) => `${label} · ${won}원 · ${selected ? "선택됨" : "선택 안 됨"}`),
      ...snapshot.fees.map(({ label, won, required }) => `${label} · ${won}원 · ${required ? "필수" : "선택"}`),
      ...(snapshot.precheckedSignals ?? []).map(({ label }) => label),
      ...(snapshot.decisionControls ?? []).map(({ label, kind, selected }) => `${kind} · ${label}${selected === undefined ? "" : selected ? " · 선택됨" : " · 선택 안 됨"}`),
    ]);
    return text ? [{
      id: `review:snapshot:${evidenceId}`, kind: "SEMANTIC_REVIEW" as const, stage: snapshot.stage,
      text, reason: reviewReason, evidenceIds: [evidenceId],
    }] : [];
  }).slice(0, 40);
}

/** Keep each observed crawl page available for later review. Text collection
 * alone does not map a page to a dark-pattern type. */
export function collectCrawlRuleCandidates(pages: CrawledSitePage[]): ReviewCandidate[] {
  return pages.filter((page) => page.outcome === "OBSERVED").map((page) => {
    const text = boundedText([
      page.title, page.text,
      ...page.domText.filter((entry) => entry.visible).map((entry) => entry.text),
      ...page.interactives.filter((item) => item.visible).map((item) => item.label),
    ]);
    return {
      id: `review:crawl:${page.evidenceId}`, kind: "SEMANTIC_REVIEW" as const, stage: "surface" as const,
      text: text || "화면의 구조화된 요소를 수집했습니다.", reason: reviewReason, evidenceIds: [page.evidenceId],
    };
  }).slice(0, 40);
}

export function collectExplorationReviewCandidate(blocker: { stage: Snapshot["stage"]; action: string; code: string; candidateCount: number } | null): ReviewCandidate[] {
  if (!blocker) return [];
  const actionNames: Record<string, string> = {
    ADD_TO_CART: "장바구니 이동", DIRECT_BUY: "바로구매 이동", CHECKOUT: "주문서 이동",
  };
  const reasons: Record<string, string> = {
    ACTION_AMBIGUOUS: `동일 동작 후보 ${blocker.candidateCount}개 중 하나를 안전하게 선택하지 못했습니다.`,
    LOGIN_REQUIRED: "테스트 계정으로 확인할 수 없는 인증 단계에 도달했습니다.",
    ACTION_NOT_FOUND: "현재 화면에서 다음 구매 동작을 특정하지 못했습니다.",
  };
  return [{
    id: `review:exploration:${blocker.stage}:${blocker.action}`,
    kind: "EXPLORATION_UNVERIFIED", stage: blocker.stage,
    text: `${actionNames[blocker.action] ?? "다음 구매 단계"}를 검증하지 못했습니다.`,
    reason: reasons[blocker.code] ?? "화면 전환 또는 선택 상태 변화를 확인하지 못했습니다.",
    evidenceIds: [`evidence:${blocker.stage}`],
  }];
}

export function collectSurfaceReviewCandidates(observations: SurfaceObservation[]): ReviewCandidate[] {
  const candidates = observations.filter((item) => item.outcome === "OBSERVED").map((item, index) => ({
    id: `review:surface:${index}`, kind: "SEMANTIC_REVIEW" as const, stage: "surface" as const,
    text: boundedText([item.title, item.text]), reason: reviewReason, evidenceIds: [item.evidenceId],
  }));
  const subscription = observations.find((item) => item.kind === "SUBSCRIPTION" && item.outcome === "OBSERVED");
  const cancellation = observations.some((item) => item.kind === "CANCELLATION" && item.outcome === "OBSERVED");
  if (subscription && !cancellation) candidates.push({
    id: "review:surface:cancellation:missing", kind: "SEMANTIC_REVIEW", stage: "surface",
    text: "구독 화면은 확인했지만 해지 경로의 도달 여부를 확인하지 못했습니다.",
    reason: "관측 가능한 구독 경로는 있지만 해지 화면에 연결되는 증거가 없습니다.",
    evidenceIds: [subscription.evidenceId],
  });
  return candidates;
}

/** Create typed AI-review candidates only when relevant evidence was actually
 * observed. A broad crawl page can supply context, but absence of an observed
 * screen never becomes evidence of absence. */
export function collectRuleReviewCandidates(input: {
  snapshots: Snapshot[];
  surfaces: SurfaceObservation[];
  crawlPages: CrawledSitePage[];
}): ReviewCandidate[] {
  const candidates: ReviewCandidate[] = [];
  for (const [ruleType, question] of Object.entries(evidenceQuestions) as [RuleType, EvidenceQuestion][]) {
    const relevantIds = new Set<string>();
    for (const snapshot of input.snapshots) {
      if (question.stages?.includes(snapshot.stage)) relevantIds.add(snapshot.evidenceId ?? `evidence:${snapshot.stage}`);
    }
    for (const surface of input.surfaces) {
      if (surface.outcome === "OBSERVED" && question.surfaces?.includes(surface.kind)) relevantIds.add(surface.evidenceId);
    }
    if (!relevantIds.size) continue;
    if (question.crawl) {
      for (const page of input.crawlPages) if (page.outcome === "OBSERVED") relevantIds.add(page.evidenceId);
    }
    const evidenceIds = [...relevantIds].slice(0, 4);
    candidates.push({
      id: `review:rule:${ruleType.toLowerCase()}`, kind: "SEMANTIC_REVIEW", stage: "surface",
      ruleType, evidenceIds,
      text: `검토 질문: ${legalRuleTitle(ruleType)}. 제공된 관찰에서 이 유형을 뒷받침하거나 반박하는 사실과 부족한 정보를 구분하세요.`,
      reason: question.reason,
    });
  }
  return candidates;
}

function legalRuleTitle(type: Finding["type"]) {
  return legalRules[type].title;
}
