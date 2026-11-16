import type { CrawledSitePage } from "./site-crawler";
import type { SurfaceObservation } from "./purchase-journey";
import type { InteractionEvidence } from "./rules";
import { contextualRuleTypes } from "./rule-strategy";

export type ReviewCandidate = { id: string; kind: string; stage: string; text: string; reason: string; evidenceIds: string[]; ruleType?: string; observedFacts?: string[]; missingInformation?: string[] };
export type SnapshotEvidence = { evidenceId?: string; stage?: string; url?: string; priceLines?: string[]; textLines?: string[]; options?: unknown[]; fees?: unknown[]; precheckedSignals?: unknown[]; surfaceSignals?: unknown[]; decisionControls?: unknown[] };
export type ReviewEvidence = {
  evidenceId: string;
  source: "snapshot" | "crawl_page" | "surface_observation" | "interaction";
  stage?: string;
  url?: string;
  outcome?: string;
  title?: string;
  text?: string;
  priceLines?: string[];
  options?: unknown[];
  fees?: unknown[];
  precheckedSignals?: unknown[];
  surfaceSignals?: unknown[];
  decisionControls?: unknown[];
  selectedControls?: string[];
  matchingVisualFacts?: { text: string; fontSize: string; color: string; opacity: string; bounds: { width: number; height: number } }[];
  interaction?: { kind: string; controlLabel?: string; beforeSelected?: boolean; afterSelected?: boolean; beforeTotalWon?: number | null; afterTotalWon?: number | null; amountDeltaWon?: number | null; outcome: string; revealedText?: string[] };
};
export type AiCandidatePayload = ReviewCandidate & { evidence: ReviewEvidence[] };
export type AiProviderCandidate = Omit<ReviewCandidate, "evidenceIds"> & { evidence: (Omit<ReviewEvidence, "evidenceId"> & { evidenceId: string })[] };

const redact = (value: string) => value
  .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[이메일 가림]")
  .replace(/(?:\+?82[- ]?)?0?1[016789][- ]?\d{3,4}[- ]?\d{4}/g, "[연락처 가림]")
  .replace(/\b\d{6}[- ]?[1-4]\d{6}\b/g, "[식별번호 가림]");

function safeUrl(raw?: string) {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.split("/").map((segment) => {
      let decoded = segment;
      try { decoded = decodeURIComponent(segment); } catch { /* keep the encoded segment */ }
      if (!decoded) return "";
      if (decoded !== redact(decoded) || /^\d{6,}$/.test(decoded)
        || /^[a-f\d]{8}-[a-f\d-]{20,}$/i.test(decoded) || /^[A-Za-z\d_-]{32,}$/.test(decoded)) return "[가림]";
      return decoded;
    }).join("/");
    return url.href.slice(0, 500);
  } catch { return undefined; }
}

function redactObject(value: unknown): unknown {
  if (typeof value === "string") return redact(value).slice(0, 500);
  if (Array.isArray(value)) return value.slice(0, 20).map(redactObject);
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (/href|url|action|screenshot|path|cookie|password|token|email|phone|secret/i.test(key)) continue;
    if (["x", "y"].includes(key)) continue;
    result[key] = redactObject(item);
  }
  return result;
}

function redactArray(value?: unknown[]) {
  return value?.slice(0, 20).map(redactObject);
}

function snapshotEvidence(item: SnapshotEvidence): ReviewEvidence | null {
  if (!item.evidenceId) return null;
  return {
    evidenceId: item.evidenceId, source: "snapshot", stage: item.stage, url: safeUrl(item.url),
    priceLines: (item.priceLines ?? []).slice(0, 20).map((line) => redact(line).slice(0, 500)),
    text: (item.textLines ?? []).slice(0, 30).map((line) => redact(line).slice(0, 500)).join("\n"),
    options: redactArray(item.options), fees: redactArray(item.fees),
    precheckedSignals: redactArray(item.precheckedSignals), surfaceSignals: redactArray(item.surfaceSignals),
    decisionControls: redactArray(item.decisionControls),
  };
}

function crawlEvidence(item: CrawledSitePage, candidate: ReviewCandidate): ReviewEvidence {
  const facts = (candidate.observedFacts ?? [])
    .map((fact) => fact.toLocaleLowerCase().trim()).filter(Boolean);
  const matchesFact = (text: string) => facts.some((fact) => {
    const normalized = text.toLocaleLowerCase().trim();
    return normalized.length >= 4 && (normalized.includes(fact) || fact.includes(normalized));
  });
  const selectedControls = item.interactives.filter((control) => control.selected === true)
    .map(({ label }) => redact(label).slice(0, 300)).filter(Boolean).slice(0, 20);
  const matchingVisualFacts = candidate.kind === "VISUAL_ACCESSIBILITY" || candidate.kind === "SEMANTIC_REVIEW"
    ? item.domText.filter((entry) => entry.visible && (facts.length ? matchesFact(entry.text) : candidate.kind === "VISUAL_ACCESSIBILITY" || candidate.kind === "SEMANTIC_REVIEW"))
      .slice(0, 12).map(({ text, fontSize, color, opacity, bounds }) => ({ text: redact(text).slice(0, 300), fontSize, color, opacity, bounds: { width: bounds.width, height: bounds.height } }))
    : undefined;
  const text = item.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const context = facts.length ? text.filter(matchesFact) : text;
  return {
    evidenceId: item.evidenceId, source: "crawl_page", stage: "surface", url: safeUrl(item.url), outcome: item.outcome,
    title: redact(item.title).slice(0, 300),
    text: context.slice(0, 20).map((line) => redact(line).slice(0, 500)).join("\n"),
    selectedControls, matchingVisualFacts,
  };
}

function surfaceEvidence(item: SurfaceObservation): ReviewEvidence {
  return {
    evidenceId: item.evidenceId, source: "surface_observation", stage: "surface", url: safeUrl(item.url),
    outcome: item.outcome, title: redact(item.title).slice(0, 300), text: redact(item.text).slice(0, 5_000),
  };
}

export function buildAiCandidatePayload(report: {
  reviewCandidates?: readonly ReviewCandidate[];
  snapshots?: readonly SnapshotEvidence[];
  interactions?: readonly InteractionEvidence[];
  siteCrawl?: { pages?: readonly CrawledSitePage[] };
  surfaceObservations?: readonly SurfaceObservation[];
}): AiCandidatePayload[] {
  const evidenceById = new Map<string, ReviewEvidence>();
  for (const item of report.snapshots ?? []) {
    const evidence = snapshotEvidence(item);
    if (evidence) evidenceById.set(evidence.evidenceId, evidence);
  }
  for (const item of report.interactions ?? []) evidenceById.set(item.id, {
    evidenceId: item.id, source: "interaction", stage: item.stage,
    interaction: {
      kind: item.kind, controlLabel: item.controlLabel ? redact(item.controlLabel).slice(0, 300) : undefined,
      beforeSelected: item.beforeSelected, afterSelected: item.afterSelected,
      beforeTotalWon: item.beforeTotalWon, afterTotalWon: item.afterTotalWon, amountDeltaWon: item.amountDeltaWon,
      outcome: item.outcome, revealedText: item.revealedText?.slice(0, 8).map((line) => redact(line).slice(0, 300)),
    },
  });
  for (const item of report.siteCrawl?.pages ?? []) evidenceById.set(item.evidenceId, { evidenceId: item.evidenceId, source: "crawl_page" });
  for (const item of report.surfaceObservations ?? []) evidenceById.set(item.evidenceId, surfaceEvidence(item));

  // Untyped operator notes and BASIC_ENGINE rules remain visible in the
  // report/dataset, but only the eight explicitly contextual rules may reach
  // the paid AI provider.
  return (report.reviewCandidates ?? []).filter((item) =>
    item.ruleType && contextualRuleTypes.includes(item.ruleType as (typeof contextualRuleTypes)[number]),
  ).slice(0, 40).flatMap((item) => {
    const evidence = item.evidenceIds.slice(0, 4).flatMap((id) => {
      const resolved = evidenceById.get(id);
      if (!resolved) return [];
      if (resolved.source === "crawl_page") {
        const page = report.siteCrawl?.pages?.find((entry) => entry.evidenceId === id);
        return page ? [crawlEvidence(page, item)] : [];
      }
      return [resolved];
    });
    if (!evidence.length) return [];
    return [{ ...item, text: redact(item.text).slice(0, 1_000), reason: redact(item.reason).slice(0, 500),
      observedFacts: item.observedFacts?.slice(0, 12).map((fact) => redact(fact).slice(0, 300)),
      missingInformation: item.missingInformation?.slice(0, 8).map((fact) => redact(fact).slice(0, 300)), evidence }];
  });
}

/** Remove report-local identifiers before sending candidates to an AI provider. */
export function toAiProviderCandidates(candidates: AiCandidatePayload[]): AiProviderCandidate[] {
  return candidates.map(({ id: _id, evidenceIds: _evidenceIds, evidence, ...candidate }, index) => ({
    ...candidate,
    id: `candidate-${index + 1}`,
    evidence: evidence.map(({ evidenceId: _evidenceId, ...item }, evidenceIndex) => ({
      ...item, evidenceId: `evidence-${index + 1}-${evidenceIndex + 1}`,
    })),
  }));
}

export function restoreAiCandidateIds<T extends { candidateId: string }>(decisions: T[], candidates: AiCandidatePayload[]): T[] {
  return decisions.map((decision) => ({
    ...decision,
    candidateId: candidates[Number(decision.candidateId.replace(/^candidate-/, "")) - 1]?.id ?? decision.candidateId,
  }));
}
