import { detectPreselection } from "./detectors/preselection";
import { detectDripPricing } from "./detectors/drip-pricing";
import { detectSneakyCartAdd } from "./detectors/sneaky-cart";
import { detectBaitSelling } from "./detectors/bait-selling";
import { detectMisdirectedHierarchy } from "./detectors/misdirected-hierarchy";
import { detectPriceComparison } from "./detectors/price-comparison";
import type { FirstPriceExposure } from "./price-ledger";
import type { Stage } from "./demo";

type Bounds = { x: number; y: number; width: number; height: number };

export type EvidenceLocation = { frame: string; visible: boolean; source: "dom" | "api" };
export type Option = { label: string; won: number; selected: boolean; bounds: Bounds; location?: EvidenceLocation };
export type Fee = { id: string; label: string; won: number; required: boolean; bounds: Bounds; location?: EvidenceLocation };
export type SurfaceSignal = {
  kind: "AUTH" | "SUBSCRIPTION" | "CANCELLATION" | "MARKETING_CONSENT" | "POPUP";
  label: string;
  source: "link" | "button" | "text";
  href?: string;
};
export type DecisionControl = {
  label: string;
  kind: "BUTTON" | "LINK" | "CHECKBOX" | "RADIO";
  bounds: Bounds;
  selected?: boolean;
  href?: string;
  color?: string;
  backgroundColor?: string;
  opacity?: number;
  tabIndex?: number;
  group?: string;
};
export type Snapshot = {
  /** Stable reference used by findings, review payloads, and rescan diffs. */
  evidenceId?: string;
  stage: Stage;
  url: string;
  screenshot: string;
  capturedAt?: string;
  screenshotArea?: Bounds;
  priceLines: string[];
  /** Normalized visible text retained for text-only risk signals. */
  textLines?: string[];
  options: Option[];
  fees: Fee[];
  precheckedSignals?: { label: string; bounds: Bounds; location?: EvidenceLocation }[];
  surfaceSignals?: SurfaceSignal[];
  /** Visible, labelled controls used to compare paired accept/decline choices. */
  decisionControls?: DecisionControl[];
  /** Item count shown after exactly one add action in the isolated scan cart. */
  cartItemCount?: number;
};
export type InteractionEvidence = {
  id: string;
  stage: Stage;
  kind: "INITIAL_STATE" | "PAID_OPTION_TOGGLE" | "REQUIRED_OPTION_SELECTION" | "NAVIGATION";
  capturedAt: string;
  controlLabel?: string;
  beforeSelected?: boolean;
  afterSelected?: boolean;
  beforeTotalWon?: number | null;
  afterTotalWon?: number | null;
  amountDeltaWon?: number | null;
  outcome: "OBSERVED" | "NO_LIVE_CHANGE" | "NOT_APPLICABLE";
  /** Text lines that appeared only after the control was clicked, e.g. a decline confirmation. */
  revealedText?: string[];
};
export type NetworkPriceEvidence = {
  id: string;
  stage: Stage;
  url: string;
  capturedAt: string;
  values: { path: string; won: number }[];
};
export type PriorFeeDisclosure = { key: string; won: number };
export type Finding = {
  type: "PRESELECTION" | "DRIP_PRICING" | "URGENCY_SCARCITY" | "HIDDEN_INFO" | "FALSE_DISCOUNT" | "DISGUISED_AD" | "CONFIRM_SHAMING" | "FORCED_ACTION" | "HIDDEN_SUBSCRIPTION" | "SNEAKY_CART_ADD" | "FALSE_RECOMMENDATION" | "BAIT_SELLING" | "TRICK_QUESTION" | "MISDIRECTED_HIERARCHY" | "CANCELLATION_OBSTRUCTION" | "PRICE_COMPARISON_OBSTRUCTION";
  status: "SUSPECTED" | "REVIEW_NEEDED";
  ruleVersion: "1" | "2" | "3";
  stage: Stage;
  reason: string;
  evidence: Snapshot[];
  /** Every emitted finding carries the IDs of the evidence it cites. */
  evidenceIds?: string[];
  elementBounds?: Bounds;
};

export function evidenceIds(snapshots: Snapshot[]) {
  return snapshots.map((snapshot) => snapshot.evidenceId ?? `evidence:${snapshot.stage}`);
}

export function detect([product, ...later]: Snapshot[], priorDisclosures: PriorFeeDisclosure[] = [], interactions: InteractionEvidence[] = [], firstPriceExposure?: FirstPriceExposure): Finding[] {
  if (!product) return [];
  const findings = [
    ...[product, ...later].flatMap((snapshot) => detectPreselection(snapshot, interactions)),
    ...detectDripPricing(product, later, priorDisclosures),
    ...later.flatMap((snapshot) => detectSneakyCartAdd(snapshot)),
    ...detectBaitSelling(firstPriceExposure, [product, ...later]),
    ...[product, ...later].filter((snapshot) => snapshot.stage === "checkout").flatMap((snapshot) => detectMisdirectedHierarchy(snapshot)),
    ...detectPriceComparison([product, ...later]),
  ];
  // Show each rule once while retaining evidence from every observed stage.
  const byType = new Map<Finding["type"], Finding>();
  for (const finding of findings) {
    const previous = byType.get(finding.type);
    if (!previous) { byType.set(finding.type, finding); continue; }
    byType.set(finding.type, {
      ...previous,
      status: previous.status === "SUSPECTED" || finding.status === "SUSPECTED" ? "SUSPECTED" : "REVIEW_NEEDED",
      reason: [...new Set([previous.reason, finding.reason])].join(" · "),
      evidence: [...previous.evidence, ...finding.evidence].filter((item, index, items) =>
        items.findIndex((candidate) => (candidate.evidenceId ?? candidate.stage) === (item.evidenceId ?? item.stage)) === index),
      evidenceIds: [...new Set([...(previous.evidenceIds ?? evidenceIds(previous.evidence)), ...(finding.evidenceIds ?? evidenceIds(finding.evidence))])],
    });
  }
  return [...byType.values()];
}
