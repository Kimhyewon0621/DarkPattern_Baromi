import type { Finding, InteractionEvidence, Snapshot } from "./rules";
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
  observedFacts?: string[];
  missingInformation?: string[];
};

/** Maps evidence to the rule questions it can inform without interpreting the
 * merchant's wording as proof of a violation. AI receives these as review
 * questions; it may return insufficient evidence and never overwrites facts. */
type EvidenceQuestion = {
  stages?: Snapshot["stage"][];
  surfaces?: SurfaceObservation["kind"][];
  crawl?: boolean;
  reason: string;
  missingInformation: string;
};

const evidenceQuestions = {
  URGENCY_SCARCITY: { stages: ["product"], crawl: true, reason: "긴급성·희소성 표현의 실제 근거와 표시 맥락을 확인해야 합니다.", missingInformation: "재고·접속자 수의 실제 기록과 타이머 종료 후 조건 변화" },
  HIDDEN_INFO: { stages: ["product", "cart", "checkout"], crawl: true, reason: "중요 조건의 표시 위치·가독성·누락 여부를 화면 맥락에서 검토해야 합니다.", missingInformation: "구매 결정 전에 공개된 전체 조건의 범위" },
  FALSE_DISCOUNT: { stages: ["product"], crawl: true, reason: "표시된 할인 기준 가격의 실제 이력은 화면만으로 검증할 수 없습니다.", missingInformation: "기준 가격의 실제 판매 이력" },
  DISGUISED_AD: { surfaces: ["RECOMMENDATION"], crawl: true, reason: "추천·콘텐츠와 광고 표시의 관계를 화면 맥락에서 검토해야 합니다.", missingInformation: "콘텐츠의 광고·협찬 여부와 표시 주체" },
  CONFIRM_SHAMING: { stages: ["checkout"], crawl: true, reason: "선택지 문구가 거부를 감정적으로 압박하는지 검토해야 합니다.", missingInformation: "거부 선택 직후 나타나는 문구와 실제 진행 결과" },
  HIDDEN_SUBSCRIPTION: { stages: ["product", "checkout"], surfaces: ["SUBSCRIPTION"], crawl: true, reason: "체험·자동 갱신·청구 조건의 고지 맥락을 검토해야 합니다.", missingInformation: "체험 종료 후 청구 금액·주기와 동의 시점의 전체 고지" },
  FALSE_RECOMMENDATION: { surfaces: ["RECOMMENDATION"], crawl: true, reason: "추천·인기·후기의 표시와 실제 산정 근거를 대조해야 합니다.", missingInformation: "추천·순위·후기 수의 실제 산정 데이터" },
  TRICK_QUESTION: { stages: ["checkout"], crawl: true, reason: "질문·동의 문구와 실제 선택 결과가 일치하는지 맥락을 검토해야 합니다.", missingInformation: "선택 전후의 실제 동의·거절 결과" },
} satisfies Record<(typeof contextualRuleTypes)[number], EvidenceQuestion>;

const reviewReason = "관찰 내용은 수집했지만, 의미와 맥락을 자동으로 확정하지 않았습니다. 근거 화면을 검토해야 합니다.";

function boundedText(parts: Array<string | undefined>, maxLength = 1_000) {
  return [...new Set(parts.map((part) => part?.replace(/\s+/g, " ").trim()).filter((part): part is string => Boolean(part)))].join("\n").slice(0, maxLength);
}

function factsForRule(type: RuleType, snapshot: Snapshot): string[] {
  const controls = (snapshot.decisionControls ?? []).map(({ label, kind, selected }) =>
    `${kind} · ${label}${selected === undefined ? "" : selected ? " · 선택됨" : " · 선택 안 됨"}`);
  const options = snapshot.options.map(({ label, won, selected }) =>
    `${label} · ${won}원 · ${selected ? "선택됨" : "선택 안 됨"}`);
  switch (type) {
    case "URGENCY_SCARCITY":
      return (snapshot.textLines ?? []).filter((line) => /\d{1,2}:\d{2}|남은\s*(?:시간|수량|재고)|마감|품절\s*임박|countdown|only\s+\d+\s+left/i.test(line)).slice(0, 8);
    case "FALSE_DISCOUNT":
      return [...snapshot.priceLines, ...(snapshot.textLines ?? [])]
        .filter((line) => /정가|할인|원래\s*가격|discount|was\s+[₩$£€\d]/i.test(line)).slice(0, 8);
    case "HIDDEN_INFO":
      return [...snapshot.fees.map(({ label, won }) => `${label} · ${won}원`),
        ...(snapshot.textLines ?? []).filter((line) => /추가\s*(?:비용|요금)|별도\s*(?:청구|결제)|결제\s*단계|자세한\s*조건|additional\s*(?:fee|charge)|terms\s*apply/i.test(line))].slice(0, 8);
    case "CONFIRM_SHAMING":
      return controls.filter((line) => /아니오|거절|포기|손해|책임|동의하지|decline|reject|no thanks|risk/i.test(line)).slice(0, 8);
    case "TRICK_QUESTION":
      return controls.filter((line) => /동의|수신|거부|선택|체크|agree|consent|opt.?out|unsubscribe/i.test(line)).slice(0, 8);
    case "HIDDEN_SUBSCRIPTION":
      return [...(snapshot.textLines ?? []).filter((line) => /구독|체험|갱신|연장|정기\s*결제|subscription|trial|renewal/i.test(line)),
        ...options.filter((line) => /구독|체험|갱신|연장|정기\s*결제|subscription|trial|renewal/i.test(line))].slice(0, 8);
    default:
      return [];
  }
}

function surfaceFactsForRule(type: RuleType, surface: SurfaceObservation): string[] {
  const lines = [surface.title, ...surface.text.split(/\n+/)].map((line) => line.trim()).filter(Boolean);
  if (type === "DISGUISED_AD") return lines.filter((line) => /광고|협찬|제공|추천|sponsor|advertis|promoted/i.test(line)).slice(0, 8);
  if (type === "FALSE_RECOMMENDATION") return lines.filter((line) => /추천|인기|순위|후기|평점|베스트|review|rating|popular|rank/i.test(line)).slice(0, 8);
  if (type === "HIDDEN_SUBSCRIPTION") return lines.filter((line) => /구독|체험|갱신|연장|정기\s*결제|subscription|trial|renewal/i.test(line)).slice(0, 8);
  return [];
}

function crawlFactsForRule(type: RuleType, page: CrawledSitePage): string[] {
  const lines = [page.title, ...page.text.split(/\n+/), ...page.interactives.filter((item) => item.visible).map((item) => item.label)]
    .map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const patterns: Partial<Record<RuleType, RegExp>> = {
    URGENCY_SCARCITY: /\d{1,2}:\d{2}|남은\s*(?:시간|수량|재고)|마감|품절\s*임박|countdown|only\s+\d+\s+left/i,
    HIDDEN_INFO: /추가\s*(?:비용|요금)|별도\s*(?:청구|결제)|결제\s*단계|자세한\s*조건|additional\s*(?:fee|charge)|terms\s*apply/i,
    FALSE_DISCOUNT: /정가|할인|원래\s*가격|discount|was\s+[₩$£€\d]/i,
    DISGUISED_AD: /광고|협찬|제공|추천|sponsor|advertis|promoted/i,
    CONFIRM_SHAMING: /아니오|거절|포기|손해|책임|동의하지|decline|reject|no thanks|risk/i,
    HIDDEN_SUBSCRIPTION: /구독|체험|갱신|연장|정기\s*결제|subscription|trial|renewal/i,
    FALSE_RECOMMENDATION: /추천|인기|순위|후기|평점|베스트|review|rating|popular|rank/i,
    TRICK_QUESTION: /동의|수신|거부|선택|체크|agree|consent|opt.?out|unsubscribe/i,
  };
  const pattern = patterns[type];
  return pattern ? [...new Set(lines.filter((line) => pattern.test(line)))].slice(0, 8) : [];
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
  interactions?: InteractionEvidence[];
}): ReviewCandidate[] {
  const candidates: ReviewCandidate[] = [];
  for (const [ruleType, question] of Object.entries(evidenceQuestions) as [RuleType, EvidenceQuestion][]) {
    const relevantIds = new Set<string>();
    const relevantUrls = new Set<string>();
    const observedFacts: string[] = [];
    for (const snapshot of input.snapshots) {
      if (question.stages?.includes(snapshot.stage)) {
        const facts = factsForRule(ruleType, snapshot);
        if (!facts.length) continue;
        relevantIds.add(snapshot.evidenceId ?? `evidence:${snapshot.stage}`);
        relevantUrls.add(snapshot.url.split("#")[0]);
        observedFacts.push(...facts);
      }
    }
    for (const surface of input.surfaces) {
      if (surface.outcome === "OBSERVED" && question.surfaces?.includes(surface.kind)) {
        const facts = surfaceFactsForRule(ruleType, surface);
        if (!facts.length) continue;
        relevantIds.add(surface.evidenceId);
        relevantUrls.add(surface.url.split("#")[0]);
        observedFacts.push(...facts);
      }
    }
    if (ruleType === "CONFIRM_SHAMING" || ruleType === "TRICK_QUESTION") {
      for (const interaction of input.interactions ?? []) {
        if (!question.stages?.includes(interaction.stage) || !interaction.revealedText?.length) continue;
        observedFacts.push(...interaction.revealedText.slice(0, 4));
        relevantIds.add(interaction.id);
        const snapshot = input.snapshots.find((item) => item.stage === interaction.stage);
        if (snapshot) relevantIds.add(snapshot.evidenceId ?? `evidence:${snapshot.stage}`);
      }
    }
    for (const page of input.crawlPages) {
      if (page.outcome !== "OBSERVED" || relevantIds.size >= 4) continue;
      const facts = crawlFactsForRule(ruleType, page);
      if (!facts.length) continue;
      relevantIds.add(page.evidenceId);
      observedFacts.push(...facts);
    }
    if (!observedFacts.some(Boolean) || !relevantIds.size) continue;
    if (question.crawl) {
      for (const page of input.crawlPages) {
        if (page.outcome === "OBSERVED" && relevantUrls.has(page.url.split("#")[0])) {
          relevantIds.add(page.evidenceId);
        }
      }
    }
    const interactionIds = new Set((input.interactions ?? []).filter((item) =>
      (ruleType === "CONFIRM_SHAMING" || ruleType === "TRICK_QUESTION") && item.revealedText?.length,
    ).map(({ id }) => id));
    const evidenceIds = [...relevantIds].sort((left, right) => Number(interactionIds.has(right)) - Number(interactionIds.has(left))).slice(0, 4);
    candidates.push({
      id: `review:rule:${ruleType.toLowerCase()}`, kind: "SEMANTIC_REVIEW", stage: "surface",
      ruleType, evidenceIds,
      observedFacts: [...new Set(observedFacts.filter(Boolean))].slice(0, 12),
      missingInformation: [question.missingInformation],
      text: `검토 질문: ${legalRuleTitle(ruleType)}. 제공된 관찰에서 이 유형을 뒷받침하거나 반박하는 사실과 부족한 정보를 구분하세요.`,
      reason: question.reason,
    });
  }
  return candidates;
}

function legalRuleTitle(type: Finding["type"]) {
  return legalRules[type].title;
}
