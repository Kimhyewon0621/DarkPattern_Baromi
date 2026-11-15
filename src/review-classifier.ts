import type { ReviewCandidate } from "./review-candidates";

export type ReviewClassification = {
  candidateId: string;
  label: "FEE" | "PAID_OPTION" | "FLOW" | "UNRESOLVED";
  confidence: number;
  method: "candidate_kind_mapping" | "unresolved";
};

/** Cheap, deterministic candidate-kind tagging. This is not a risk decision or an AI eligibility gate. */
export function classifyReviewCandidates(candidates: ReviewCandidate[]): ReviewClassification[] {
  return candidates.map((candidate) => {
    if (candidate.kind === "FEE_SEMANTICS") return { candidateId: candidate.id, label: "FEE", confidence: 1, method: "candidate_kind_mapping" };
    if (candidate.kind === "OPTION_SEMANTICS") return { candidateId: candidate.id, label: "PAID_OPTION", confidence: 1, method: "candidate_kind_mapping" };
    if (candidate.kind === "SURFACE_FLOW") return { candidateId: candidate.id, label: "FLOW", confidence: 1, method: "candidate_kind_mapping" };
    return { candidateId: candidate.id, label: "UNRESOLVED", confidence: 0, method: "unresolved" };
  });
}
