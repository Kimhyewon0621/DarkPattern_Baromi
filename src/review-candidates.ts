import type { Finding, Snapshot } from "./rules";
import type { SurfaceObservation } from "./purchase-journey";
import type { CrawledSitePage } from "./site-crawler";

export type ReviewCandidate = {
  id: string;
  kind: "FEE_SEMANTICS" | "OPTION_SEMANTICS" | "SURFACE_FLOW" | "EXPLORATION_UNVERIFIED" | "VISUAL_ACCESSIBILITY" | "SEMANTIC_REVIEW";
  stage: Snapshot["stage"] | "surface";
  text: string;
  reason: string;
  evidenceIds: string[];
  ruleType?: Finding["type"];
};

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
