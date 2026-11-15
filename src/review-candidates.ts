import type { Finding, Snapshot } from "./rules";
import type { SurfaceObservation } from "./purchase-journey";
import type { CrawledSitePage } from "./site-crawler";

export type ReviewCandidate = {
  id: string;
  kind: "FEE_SEMANTICS" | "OPTION_SEMANTICS" | "SURFACE_FLOW" | "EXPLORATION_UNVERIFIED" | "VISUAL_ACCESSIBILITY";
  stage: Snapshot["stage"] | "surface";
  text: string;
  reason: string;
  evidenceIds: string[];
  ruleType?: Finding["type"];
};

const amount = /(?:[₩$£€]\s*\d[\d,.]*|\d[\d,.]*\s*원)/;
const feeWords = /(?:배송비|처리비|포장비|서비스비|수수료|보증|보험|추가비용|fee|shipping|handling|service|warranty)/i;
const optionWords = /(?:옵션|추가|부가|포장|보증|보험|서비스|option|add[- ]?on|warranty)/i;

/**
 * Build a bounded, model-ready queue without making an AI call. Numeric and
 * stateful observations stay in deterministic rules; only unresolved wording
 * is queued for a later dictionary/classifier/LLM stage.
 */
export function collectReviewCandidates(snapshots: Snapshot[]): ReviewCandidate[] {
  const candidates: ReviewCandidate[] = [];
  for (const snapshot of snapshots) {
    const evidenceId = snapshot.evidenceId ?? `evidence:${snapshot.stage}`;
    for (const [index, line] of (snapshot.textLines ?? []).entries()) {
      if (!amount.test(line)) continue;
      if (feeWords.test(line) && !/^필수\s*(?:배송비|처리비|포장비|서비스비|수수료)/.test(line)) {
        candidates.push({
          id: `review:${evidenceId}:fee:${index}`, kind: "FEE_SEMANTICS", stage: snapshot.stage,
          text: line, reason: "금액이 포함된 비용 항목의 필수·조건부 의미를 확정하지 못했습니다.", evidenceIds: [evidenceId],
          ruleType: "DRIP_PRICING",
        });
      } else if (optionWords.test(line) && !/[+]\s*\d[\d,]*\s*원/.test(line)) {
        candidates.push({
          id: `review:${evidenceId}:option:${index}`, kind: "OPTION_SEMANTICS", stage: snapshot.stage,
          text: line, reason: "금액이 포함된 옵션 문구의 별도 거래 여부를 확정하지 못했습니다.", evidenceIds: [evidenceId],
        });
      }
      if (candidates.length >= 40) return candidates;
    }
  }
  return candidates;
}

/** Connect objective page-crawl evidence to the rule coverage report. These
 * are review signals only: crawling text and checked states does not by itself
 * establish that a practice is deceptive or unlawful. */
export function collectCrawlRuleCandidates(pages: CrawledSitePage[]): ReviewCandidate[] {
  const candidates: ReviewCandidate[] = [];
  const seen = new Set<Finding["type"]>();
  const add = (
    ruleType: Finding["type"],
    page: CrawledSitePage,
    kind: ReviewCandidate["kind"],
    text: string,
    reason: string,
  ) => {
    if (seen.has(ruleType) || !text.trim()) return;
    seen.add(ruleType);
    candidates.push({
      id: `review:crawl:${ruleType.toLowerCase()}:${page.evidenceId}`,
      kind, stage: "surface", text: text.replace(/\s+/g, " ").trim().slice(0, 500), reason,
      evidenceIds: [page.evidenceId], ruleType,
    });
  };
  for (const page of pages) {
    if (page.outcome !== "OBSERVED") continue;
    const visibleText = page.domText.filter((entry) => entry.visible).map((entry) => entry.text);
    const text = [...new Set([page.text, ...visibleText, ...page.interactives.map(({ label }) => label)].filter(Boolean))].join("\n");
    const lines = [...new Set([...page.text.split(/\r?\n/), ...visibleText].map((line) => line.trim()).filter(Boolean))];
    const selected = page.interactives.filter((item) => item.selected === true).map((item) => item.label.trim()).filter(Boolean);

    const urgency = lines.find((line) =>
      /(?:\b\d{1,2}:\d{2}\b|남은\s*시간|마감\s*임박|마감\s*전|타임특가)/i.test(line) &&
      /(?:마감|임박|한정|소멸|종료|쿠폰|특가|결제)/i.test(line),
    ) ?? lines.find((line) => /(?:마지막\s*재고\s*\d+|\d+\s*명\s*(?:동시\s*)?(?:조회|접속)\s*중)/i.test(line));
    if (urgency) add("URGENCY_SCARCITY", page, "EXPLORATION_UNVERIFIED", urgency,
      "카운트다운·재고·접속자 문구와 숫자를 화면에서 수집했습니다. 실제 제한 조건과 수치의 근거는 확인이 필요합니다.");

    const subscription = lines.find((line) =>
      /(?:무료\s*(?:체험|이용)|첫달\s*무료)/i.test(line) &&
      /(?:익월|다음\s*달|매월|월\s*\d|자동\s*(?:결제|연장|갱신))/i.test(line),
    ) ?? lines.find((line) => /(?:자동결제|자동\s*연장|자동\s*갱신)/i.test(line) && /(?:해지|월\s*\d|매월|익월)/i.test(line));
    if (subscription) add("HIDDEN_SUBSCRIPTION", page, "OPTION_SEMANTICS", subscription,
      "무료 체험·자동 결제·갱신 조건 문구를 수집했습니다. 안내의 시점과 눈에 띄는 정도를 확인해야 합니다.");

    const preselected = selected.find((label) =>
      /(?:멤버십|구독|자동\s*(?:결제|연장|갱신)|마케팅|광고성|보험|보상|유료|체험)/i.test(label),
    );
    if (preselected) add("PRESELECTION", page, "OPTION_SEMANTICS", preselected,
      "사용자 조작 전 선택된 동의·멤버십·유료 옵션을 발견했습니다. 선택 초기 상태와 실제 금액 반영을 확인해야 합니다.");

    const paidFee = lines.find((line) => amount.test(line) && feeWords.test(line) && /(?:필수|추가|부가|수수료|이용료|배송비|포장비|보험)/i.test(line));
    if (paidFee) add("DRIP_PRICING", page, "FEE_SEMANTICS", paidFee,
      "가격과 함께 표시된 비용 항목을 수집했습니다. 이전 단계의 고지 시점과 필수 여부를 대조해야 합니다.");

    const recommendation = lines.find((line) => /(?:실시간\s*\d+\s*명\s*(?:동시\s*)?(?:조회|접속)|역대\s*최저가|구매자\s*추천|인기\s*상품\s*\d+)/i.test(line));
    if (recommendation) add("FALSE_RECOMMENDATION", page, "EXPLORATION_UNVERIFIED", recommendation,
      "인기·추천·실시간 수치 표현을 수집했습니다. 산정 근거와 표시 대상의 관계를 확인해야 합니다.");

    const shame = lines.find((line) => /(?:아니오|아니요|싫어요|거절)/i.test(line) && /(?:손해|책임|포기|감수|후회)/i.test(line));
    if (shame) add("CONFIRM_SHAMING", page, "OPTION_SEMANTICS", shame,
      "거절 선택지의 문구를 수집했습니다. 수락 선택지와 비교해 죄책감 유도 여부를 검토해야 합니다.");

    const groupedConsent = page.interactives.find((item) => item.selected === true && /(?:필수.{0,12}선택|선택.{0,12}필수|전체.{0,8}동의)/i.test(item.label));
    if (groupedConsent) add("TRICK_QUESTION", page, "OPTION_SEMANTICS", groupedConsent.label,
      "필수·선택 동의가 한 선택지에 묶인 문구를 수집했습니다. 각 항목을 분리해 거절할 수 있는지 확인해야 합니다.");

    const tinyTerms = page.domText.find((entry) => {
      const fontSizePx = Number.parseFloat(entry.fontSize);
      return entry.visible && Number.isFinite(fontSizePx) && fontSizePx <= 10 &&
        /(?:자동결제|자동\s*연장|익월|매월|추가\s*비용|필수\s*비용|해지\s*(?:시|방법))/i.test(entry.text);
    });
    if (tinyTerms) add("HIDDEN_INFO", page, "VISUAL_ACCESSIBILITY", tinyTerms.text,
      `중요 조건 문구가 ${tinyTerms.fontSize} 크기로 표시됩니다. 주변 본문과의 가독성 차이를 검토해야 합니다.`);

    const discount = lines.find((line) => /(?:정가|정상가|시중가|원가)/i.test(line) && /(?:\d{1,3}%|할인|특가)/i.test(line));
    if (discount) add("FALSE_DISCOUNT", page, "EXPLORATION_UNVERIFIED", discount,
      "기준 가격과 할인 표현을 수집했습니다. 기준 가격의 실제 판매 이력은 별도 확인이 필요합니다.");

    const bait = lines.find((line) => /(?:품절|재고\s*없음|판매\s*불가|구매\s*불가|sold\s*out|out\s*of\s*stock)/i.test(line));
    if (bait) add("BAIT_SELLING", page, "EXPLORATION_UNVERIFIED", bait,
      "상품의 구매 불가 표현을 수집했습니다. 목록 노출과 실제 구매 가능 상태를 대조해야 합니다.");

    const forced = lines.find((line) => /(?:구매|주문|결제).{0,20}(?:로그인|회원가입).{0,12}(?:필수|필요)|(?:비회원).{0,12}(?:구매|주문).{0,12}(?:불가|불가능)/i.test(line));
    if (forced) add("FORCED_ACTION", page, "SURFACE_FLOW", forced,
      "구매와 로그인·회원가입 요구가 함께 표시된 문구를 수집했습니다. 비회원 구매 대안을 확인해야 합니다.");

    const autoCart = lines.find((line) => /(?:자동으로|자동).{0,12}(?:장바구니|함께\s*담기)|(?:장바구니|함께\s*담기).{0,12}(?:자동\s*추가|자동으로\s*추가)/i.test(line));
    if (autoCart) add("SNEAKY_CART_ADD", page, "EXPLORATION_UNVERIFIED", autoCart,
      "장바구니 자동 추가를 암시하는 문구를 수집했습니다. 사용자의 별도 선택 없이 품목 수가 변하는지 확인해야 합니다.");

    const cancellation = lines.find((line) => /(?:전화|유선|고객센터).{0,24}(?:평일|시간|접수)|(?:평일).{0,20}\d{1,2}\s*[~〜-]\s*\d{1,2}\s*시/i.test(line));
    if (cancellation) add("CANCELLATION_OBSTRUCTION", page, "SURFACE_FLOW", cancellation,
      "해지·취소 접수의 전화 또는 제한 시간 조건을 수집했습니다. 가입 경로와 단계·접근성을 대조해야 합니다.");

    const priceCompare = lines.find((line) => /(?:개당|100g당|단위당|총\s*비용|기준\s*가격|정상가)/i.test(line) && amount.test(line));
    if (priceCompare) add("PRICE_COMPARISON_OBSTRUCTION", page, "EXPLORATION_UNVERIFIED", priceCompare,
      "비교 기준 가격·단위 가격 표현을 수집했습니다. 동일 조건 비교가 가능한지 확인해야 합니다.");
  }
  return candidates.slice(0, 16);
}

/** Keep visible styling facts separate from the semantic judgment that an
 * account-exit action is being hidden. Only emit a review candidate when the
 * measured control is unusually small; never treat its presence as a violation. */
export function collectCrawlVisualCandidates(pages: CrawledSitePage[]): ReviewCandidate[] {
  const seen = new Set<string>();
  const candidates: ReviewCandidate[] = [];
  const exitAction = /^(?:로그아웃|로그아웃하기|sign\s*out|log\s*out|회원\s*탈퇴|계정\s*삭제|unsubscribe)$/i;
  for (const page of pages) {
    if (page.outcome !== "OBSERVED") continue;
    for (const interactive of page.interactives) {
      const label = interactive.label.replace(/\s+/g, " ").trim();
      if (!interactive.visible || !exitAction.test(label)) continue;
      const visual = page.domText.find((entry) => entry.visible && entry.text.replace(/\s+/g, " ").trim() === label);
      if (!visual) continue;
      const fontSizePx = Number.parseFloat(visual.fontSize);
      const area = visual.bounds.width * visual.bounds.height;
      if (!(Number.isFinite(fontSizePx) && fontSizePx <= 12) && area > 700) continue;
      const key = `${page.url}::${label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({
        id: `review:visual-exit:${page.evidenceId}`, kind: "VISUAL_ACCESSIBILITY", stage: "surface",
        text: `${label} · 글자 ${Number.isFinite(fontSizePx) ? `${fontSizePx}px` : "크기 미기록"} · 영역 ${visual.bounds.width}×${visual.bounds.height}px`,
        reason: "계정 종료 동작의 작은 표시 크기는 측정됐습니다. 주변 주요 동작과의 대비·배치가 실제로 접근을 어렵게 하는지는 검토가 필요합니다.",
        evidenceIds: [page.evidenceId], ruleType: "MISDIRECTED_HIERARCHY",
      });
    }
  }
  return candidates;
}

export function collectExplorationReviewCandidate(blocker: { stage: Snapshot["stage"]; action: string; code: string; candidateCount: number } | null): ReviewCandidate[] {
  if (!blocker) return [];
  const action = blocker.action === "ADD_TO_CART" ? "장바구니 담기" : blocker.action === "DIRECT_BUY" ? "바로구매" : "주문서 이동";
  return [{
    id: `review:exploration:${blocker.stage}:${blocker.action.toLowerCase()}`,
    kind: "EXPLORATION_UNVERIFIED",
    stage: blocker.stage,
    text: `${action} 경로를 검증하지 못했습니다.`,
    reason: blocker.code === "ACTION_AMBIGUOUS"
      ? `후보 ${blocker.candidateCount}개 중 하나로 확정할 수 없어 구매 경로의 상태와 비용 변화를 검증하지 못했습니다.`
      : blocker.code === "LOGIN_REQUIRED"
        ? "승인된 로그인 세션 또는 테스트 계정이 필요해 구매 경로를 검증하지 못했습니다."
        : blocker.code === "ACTION_NOT_FOUND"
          ? "쇼핑몰 화면에서 해당 구매 경로를 찾지 못해 그 경로의 상태와 비용 변화를 검증하지 못했습니다."
          : "동작을 시도했지만 화면 상태 변화를 확인하지 못해 해당 경로를 검증하지 못했습니다.",
    evidenceIds: [`evidence:${blocker.stage}`],
  }];
}

export function collectSurfaceReviewCandidates(observations: SurfaceObservation[]): ReviewCandidate[] {
  const candidates = observations.filter((item) => item.outcome === "OBSERVED").map((item, index) => ({
    id: `review:surface:${item.kind.toLowerCase()}:${index}`,
    kind: "SURFACE_FLOW" as const,
    stage: "surface" as const,
    text: item.text.slice(0, 240) || item.title || item.url,
    reason: item.kind === "AUTH"
      ? "회원가입·로그인 경로를 확인했지만 구매 전 강제 여부와 비회원 대안을 추가 확인해야 합니다."
      : item.kind === "SUBSCRIPTION"
        ? "구독·멤버십 경로를 확인했지만 결제·자동갱신·해지 조건을 추가 확인해야 합니다."
        : item.kind === "CANCELLATION"
          ? "해지·환불 경로를 확인했지만 가입 대비 단계 수와 접근성은 별도로 대조해야 합니다."
          : item.kind === "COUPON"
            ? "쿠폰 조건과 적용 결과를 확인했지만 결제 금액에 반영되는 방식은 추가 대조가 필요합니다."
            : item.kind === "RECOMMENDATION"
              ? "추천·인기·후기 콘텐츠를 확인했지만 표시 근거와 광고 구분은 추가 검토가 필요합니다."
              : item.kind === "CATALOG"
                ? "목록·카테고리 화면을 확인했지만 상품별 구매 가능 여부와 가격 대조가 필요합니다."
                : "배송·교환·반품 정책 화면을 확인했지만 결제 화면의 실제 조건과 대조가 필요합니다.",
    evidenceIds: [item.evidenceId],
  }));
  const hasObservedSubscription = observations.some((item) => item.kind === "SUBSCRIPTION" && item.outcome === "OBSERVED");
  // A discovered URL is not evidence that the cancellation flow was actually
  // reachable. Failed and cross-origin probes must still leave the missing-
  // cancellation review candidate visible.
  const hasCancellation = observations.some((item) => item.kind === "CANCELLATION" && item.outcome === "OBSERVED");
  if (hasObservedSubscription && !hasCancellation) {
    candidates.push({
      id: "review:surface:cancellation:missing", kind: "SURFACE_FLOW", stage: "surface",
      text: "구독·멤버십 흐름에서 해지 경로를 찾지 못했습니다.",
      reason: "구독 경로는 확인했지만 같은 공개 흐름에서 해지·자동갱신 중단 경로를 찾지 못해 취소·탈퇴 방해 여부를 검토해야 합니다.",
      evidenceIds: [observations.find((item) => item.kind === "SUBSCRIPTION" && item.outcome === "OBSERVED")?.evidenceId ?? "surface:subscription:missing-cancellation"],
    });
  }
  return candidates;
}
