import type { Finding } from "./rules";

export type RuleType = Finding["type"];
export type RuleDecisionMode = "BASIC_ENGINE" | "AI_CONTEXT";

/** Product-side thresholds used consistently by findings, report JSON, and UI.
 * A signal only qualifies when the rule-specific fact below is present; a
 * completed crawl with no qualifying signal is reported as NOT_OBSERVED. */
export const ruleDecisionCriteria = {
  PRESELECTION: "사용자 조작 전에 비필수 유료 옵션 또는 마케팅 동의가 선택된 상태면 위험 신호.",
  DRIP_PRICING: "같은 상품·수량의 필수 비용이 후속 구매 단계에서 처음 더해져 총액이 오른 경우 위험 신호.",
  URGENCY_SCARCITY: "시간·재고·접속자 수를 이용한 구매 압박 신호가 있으면 검토 필요; 실제 근거와 모순이 확인될 때 위험 신호.",
  HIDDEN_INFO: "가격·갱신·배송·환불 등 구매 결정에 필요한 조건이 눈에 띄지 않게 축소되거나 뒤늦게 제시되면 검토 필요.",
  FALSE_DISCOUNT: "기준가와 판매가(또는 기준가와 할인율)가 함께 표시되면 실제 판매 이력과 일치하는지 검토; 화면만으로 허위 할인 확정 금지.",
  DISGUISED_AD: "상업적 추천·홍보 콘텐츠와 광고·협찬 표시의 관계가 불명확하면 검토 필요.",
  CONFIRM_SHAMING: "거부 선택지에 죄책감·손실·책임을 강조하는 표현이 함께 있을 때 검토 필요.",
  FORCED_ACTION: "비회원 구매 시도에서 가입·로그인이 필수 단계로 요구되어 실제 진행이 차단되면 위험 신호.",
  HIDDEN_SUBSCRIPTION: "무료·저가 체험과 자동 갱신 또는 정기 청구 조건이 함께 제시되면 고지 시점과 가시성을 검토.",
  SNEAKY_CART_ADD: "담기 전후 장바구니 행을 비교해 요청하지 않은 상품·수량·유료 서비스가 추가된 경우 위험 신호.",
  FALSE_RECOMMENDATION: "인기·순위·후기·추천의 객관적 주장과 확인 가능한 산정 근거가 맞지 않으면 검토 필요.",
  BAIT_SELLING: "목록에서 구매를 유도한 동일 상품이 상세에서 구매 불가하고 대체품으로 유도되면 위험 신호.",
  TRICK_QUESTION: "질문·선택 문구에 부정·조건 표현이 있어 동의·거부 의미가 뒤집히거나 실제 선택 결과와 어긋나면 검토 필요.",
  MISDIRECTED_HIERARCHY: "같은 선택지군에서 거부 동작이 수락보다 4배 이상 작고 대비·투명도·키보드 접근 중 하나도 불리할 때 위험 신호.",
  CANCELLATION_OBSTRUCTION: "온라인 해지 대신 전화 접수만 허용하거나 해지 전 필수 사유 입력을 요구할 때 위험 신호.",
  PRICE_COMPARISON_OBSTRUCTION: "월 납부액·약정 기간만 먼저 표시하고, 동일 상품 한 개의 총액을 주문서에서 처음 공개한 경우 위험 신호.",
} satisfies Record<RuleType, string>;

/** Explicit ownership for every guideline. This is a routing contract, not a
 * claim that each engine-side detector is already implemented. */
export const ruleDecisionModes = {
  PRESELECTION: "BASIC_ENGINE",
  DRIP_PRICING: "BASIC_ENGINE",
  URGENCY_SCARCITY: "AI_CONTEXT",
  HIDDEN_INFO: "AI_CONTEXT",
  FALSE_DISCOUNT: "AI_CONTEXT",
  DISGUISED_AD: "AI_CONTEXT",
  CONFIRM_SHAMING: "AI_CONTEXT",
  FORCED_ACTION: "BASIC_ENGINE",
  HIDDEN_SUBSCRIPTION: "AI_CONTEXT",
  SNEAKY_CART_ADD: "BASIC_ENGINE",
  FALSE_RECOMMENDATION: "AI_CONTEXT",
  BAIT_SELLING: "BASIC_ENGINE",
  TRICK_QUESTION: "AI_CONTEXT",
  MISDIRECTED_HIERARCHY: "BASIC_ENGINE",
  CANCELLATION_OBSTRUCTION: "BASIC_ENGINE",
  PRICE_COMPARISON_OBSTRUCTION: "BASIC_ENGINE",
} satisfies Record<RuleType, RuleDecisionMode>;

export const contextualRuleTypes = Object.freeze([
  "URGENCY_SCARCITY", "HIDDEN_INFO", "FALSE_DISCOUNT", "DISGUISED_AD",
  "CONFIRM_SHAMING", "HIDDEN_SUBSCRIPTION", "FALSE_RECOMMENDATION", "TRICK_QUESTION",
] as const satisfies readonly RuleType[]);
