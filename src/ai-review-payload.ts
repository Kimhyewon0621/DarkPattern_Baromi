import type { CrawledSitePage } from "./site-crawler";
import type { SurfaceObservation } from "./purchase-journey";

export type ReviewCandidate = { id: string; kind: string; stage: string; text: string; reason: string; evidenceIds: string[] };
export type SnapshotEvidence = { evidenceId?: string; stage?: string; url?: string; priceLines?: string[]; textLines?: string[]; options?: unknown[]; fees?: unknown[]; precheckedSignals?: unknown[]; surfaceSignals?: unknown[]; decisionControls?: unknown[] };
export type ReviewEvidence = {
  evidenceId: string;
  source: "snapshot" | "crawl_page" | "surface_observation";
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
  const relevant = candidate.text.toLocaleLowerCase();
  const selectedControls = item.interactives.filter((control) => control.selected === true)
    .map(({ label }) => redact(label).slice(0, 300)).filter(Boolean).slice(0, 20);
  const matchingVisualFacts = candidate.kind === "VISUAL_ACCESSIBILITY"
    ? item.domText.filter((entry) => entry.visible && (entry.text.toLocaleLowerCase().includes(relevant) || relevant.includes(entry.text.toLocaleLowerCase())))
      .slice(0, 5).map(({ text, fontSize, color, opacity, bounds }) => ({ text: redact(text).slice(0, 300), fontSize, color, opacity, bounds: { width: bounds.width, height: bounds.height } }))
    : undefined;
  const text = item.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const context = text.filter((line) => !relevant || line.toLocaleLowerCase().includes(relevant));
  return {
    evidenceId: item.evidenceId, source: "crawl_page", stage: "surface", url: safeUrl(item.url), outcome: item.outcome,
    title: redact(item.title).slice(0, 300),
    text: (context.length ? context : text).slice(0, 30).map((line) => redact(line).slice(0, 500)).join("\n"),
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
  reviewCandidates?: ReviewCandidate[];
  snapshots?: SnapshotEvidence[];
  siteCrawl?: { pages?: CrawledSitePage[] };
  surfaceObservations?: SurfaceObservation[];
}): AiCandidatePayload[] {
  const evidenceById = new Map<string, ReviewEvidence>();
  for (const item of report.snapshots ?? []) {
    const evidence = snapshotEvidence(item);
    if (evidence) evidenceById.set(evidence.evidenceId, evidence);
  }
  for (const item of report.siteCrawl?.pages ?? []) evidenceById.set(item.evidenceId, { evidenceId: item.evidenceId, source: "crawl_page" });
  for (const item of report.surfaceObservations ?? []) evidenceById.set(item.evidenceId, surfaceEvidence(item));

  return (report.reviewCandidates ?? []).slice(0, 40).flatMap((item) => {
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
    return [{ ...item, text: redact(item.text).slice(0, 1_000), reason: redact(item.reason).slice(0, 500), evidence }];
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
