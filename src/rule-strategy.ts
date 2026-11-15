import type { Finding } from "./rules";

export type RuleType = Finding["type"];
export type RuleDecisionMode = "BASIC_ENGINE" | "AI_CONTEXT";

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
