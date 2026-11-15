/**
 * Types mirrored from the DarkPatternPrevent API (`app/api/v1/[...path]/route.ts`).
 * Keep these in sync with the backend; the UI only reads what is listed here.
 */
export type Stage = "product" | "cart" | "checkout";
export const stages: Stage[] = ["product", "cart", "checkout"];

export type Viewport = "DESKTOP" | "MOBILE";
export type PurchasePath = "CART" | "DIRECT";
export type ExecutionMode = "DEMO" | "STATIC" | "DYNAMIC";
export type ScanProfile = "CONTEST" | "DYNAMIC";
export type ScanStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED" | "CANCELLED";
export type StageCoverage = "COVERED" | "BLOCKED" | "PENDING" | "SKIPPED";

export type SurfaceKind = "CATALOG" | "AUTH" | "COUPON" | "RECOMMENDATION" | "SUBSCRIPTION" | "CANCELLATION" | "POLICY";
export const surfaceKinds: SurfaceKind[] = ["CATALOG", "AUTH", "COUPON", "RECOMMENDATION", "SUBSCRIPTION", "CANCELLATION", "POLICY"];
export type SurfaceStatus = "COVERED" | "DISCOVERED" | "BLOCKED" | "NOT_FOUND" | "PENDING" | "SKIPPED";

export type FindingType =
  | "PRESELECTION" | "DRIP_PRICING" | "URGENCY_SCARCITY" | "HIDDEN_INFO" | "FALSE_DISCOUNT" | "DISGUISED_AD"
  | "CONFIRM_SHAMING" | "FORCED_ACTION" | "HIDDEN_SUBSCRIPTION" | "SNEAKY_CART_ADD" | "FALSE_RECOMMENDATION"
  | "BAIT_SELLING" | "TRICK_QUESTION" | "MISDIRECTED_HIERARCHY" | "CANCELLATION_OBSTRUCTION" | "PRICE_COMPARISON_OBSTRUCTION";
export type FindingStatus = "SUSPECTED" | "REVIEW_NEEDED";

export type Summary = { suspected: number; reviewNeeded: number; notTested: number; notObserved?: number };

/** Spec §4: purchase stages and the seven surfaces share one phase status system. */
export type PhaseStatus = "PENDING" | "RUNNING" | "COVERED" | "DISCOVERED" | "NOT_FOUND" | "BLOCKED" | "FAILED" | "SKIPPED";
export type PhaseId = Stage | `surface:${SurfaceKind}` | "site-crawl";
export type PhaseResult = {
  status: PhaseStatus;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  reason?: string;
  evidenceIds?: string[];
};
export type PhaseResults = Partial<Record<PhaseId, PhaseResult>>;

/** Spec §4/§5: one verdict per check type; a finished report always carries all 16. */
export type RuleStatus = "SUSPECTED" | "REVIEW_NEEDED" | "NOT_OBSERVED" | "NOT_TESTED";
export type RuleCoverageItem = { status: RuleStatus; reason: string; evidenceIds?: string[] };
export type RuleCoverage = Partial<Record<FindingType, RuleCoverageItem>>;

/** Spec §13.4: an observation record per stage, not the true paid price. */
export type PriceVerification = "SCREEN_ONLY" | "SCREEN_NETWORK_AGREE" | "SCREEN_NETWORK_PARTIAL" | "SCREEN_NETWORK_DISAGREE";
export type PriceLedgerStage = {
  stage: Stage;
  evidence?: { id: string; url?: string; capturedAt?: string };
  verification: PriceVerification;
  displayedLines: string[];
  networkValues?: { evidenceId: string; won: number; matchedScreen: boolean }[];
};
export type PriceLedger = {
  version: number;
  currency: "KRW";
  firstPriceExposure?: { status: "OBSERVED" | "NOT_VERIFIED"; url?: string; text?: string; amounts?: number[] };
  stages: PriceLedgerStage[];
};

export type Verification = { name: string; token: string; metaTag: string; filePath: string; dnsRecord: string };
export type CreateShopResponse = { shopId: string; url: string; verification: Verification | null };
export type VerifyResponse = { verified: true; verifiedAt: string; method?: "meta" | "file" | "dns" };
export type CreateScanResponse = { scanId: string; status?: string; createdAt?: string; deduplicated?: boolean };
export type CancelResponse = { status: string; cancelRequested?: boolean };
export type ShopListResponse = { limit: number; shops: { shopId: string; url: string }[] };

export type ScanState = {
  scanId: string;
  shopId: string;
  executionMode?: ExecutionMode;
  viewport: Viewport;
  purchasePath: PurchasePath;
  durationMs: number | null;
  status: ScanStatus;
  cancelRequested: boolean;
  currentStage?: Stage | null;
  progress: number;
  coverage: Record<Stage, StageCoverage>;
  surfaceCoverage: Record<SurfaceKind, SurfaceStatus>;
  phaseResults?: PhaseResults;
  ruleCoverage?: RuleCoverage | null;
  summary?: Summary;
  hasReport?: boolean;
};

export type Finding = {
  id: number;
  type: FindingType;
  status?: FindingStatus;
  stage: Stage;
  reason: string;
  ruleVersion?: string;
  evidenceIds?: string[];
};
export type ReviewCandidate = { id: string; kind: string; stage: Stage | "surface"; text: string; reason: string; evidenceIds: string[] };
export type SurfaceObservation = {
  evidenceId: string;
  kind: "AUTH" | "SUBSCRIPTION" | "CANCELLATION" | "COUPON" | "RECOMMENDATION" | "POLICY" | "CATALOG";
  url: string;
  status: number | null;
  title: string;
  text: string;
  outcome: string;
};
export type ComparisonSignal = { type: FindingType; stage: Stage; reason: string; ruleVersion?: string };
export type Comparison =
  | { baselineScanId: string; status: "UNAVAILABLE"; reason: string }
  | { baselineScanId: string; status?: "AVAILABLE"; added: ComparisonSignal[]; repeated: ComparisonSignal[]; notObserved: ComparisonSignal[] };
export type OperatorLabel = "LIKELY_RISK" | "NEEDS_REVIEW" | "LIKELY_BENIGN" | "INSUFFICIENT_EVIDENCE";
export type AiReview = {
  id: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  model?: string | null;
  candidateCount: number;
  durationMs?: number | null;
  error?: string | null;
  result?: {
    promptVersion?: string;
    decisions?: { candidateId: string; label: string; confidence: number; rationale: string; suggestedRule?: string | null }[];
  } | null;
  usage?: { inputTokens: number; outputTokens: number; estimatedCostUsd: number } | null;
};
export type ExplorationBlocker = {
  stage: Stage;
  code: "ACTION_NOT_FOUND" | "ACTION_AMBIGUOUS" | "ACTION_FAILED" | "LOGIN_REQUIRED";
  action: "ADD_TO_CART" | "OPEN_CHECKOUT" | "DIRECT_BUY";
  candidateCount: number;
};
export type CollectionFailureCode = "FETCH_FAILED" | "PRODUCT_NOT_FOUND" | "DYNAMIC_RENDER_FAILED" | "DYNAMIC_JOURNEY_FAILED" | "AUTH_CHALLENGE";

export type Report = {
  scanId: string;
  shopId: string;
  targetUrl: string;
  scanStatus: ScanStatus;
  executionMode: ExecutionMode;
  viewport: Viewport;
  purchasePath: PurchasePath;
  durationMs: number | null;
  stageTimingsMs?: Partial<Record<Stage, number>>;
  collectionFailure?: string;
  collectionFailureCode?: CollectionFailureCode;
  coverage: Record<Stage, StageCoverage>;
  surfaceCoverage: Record<SurfaceKind, SurfaceStatus>;
  phaseResults?: PhaseResults;
  ruleCoverage?: RuleCoverage | null;
  priceLedger?: PriceLedger | null;
  summary: Summary;
  comparison?: Comparison | null;
  explorationBlocker?: ExplorationBlocker | null;
  findings: Finding[];
  reviewCandidates?: ReviewCandidate[];
  surfaceObservations?: SurfaceObservation[];
  aiEligible: boolean;
  aiReview?: AiReview | null;
  aiUsage?: { calls: number; inputTokens: number; outputTokens: number; estimatedCostUsd: number };
};

export type Bounds = { x: number; y: number; width: number; height: number };
export type Snapshot = { evidenceId?: string; stage: Stage; url: string; screenshotArea?: Bounds; priceLines: string[] };
export type FindingDetail = {
  id: number;
  scanId: string;
  type: FindingType;
  stage: Stage;
  reason: string;
  ruleVersion?: string;
  evidence: Snapshot[];
  evidenceIds?: string[];
  elementBounds?: Bounds;
};

export type HistoryItem = {
  scanId: string;
  status: ScanStatus;
  executionMode: ExecutionMode;
  viewport: Viewport;
  purchasePath: PurchasePath;
  createdAt: string;
  durationMs: number | null;
  summary: { suspected: number; reviewNeeded: number };
};
export type Shop = { id: string; url: string; consentAt?: string | null; verifiedAt?: string | null };
