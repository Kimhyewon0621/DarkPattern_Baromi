import { classifyReviewCandidates } from "../src/review-classifier";
import type { ReviewCandidate } from "../src/review-candidates";

const cases: Array<[ReviewCandidate["kind"], ReturnType<typeof classifyReviewCandidates>[number]["label"]]> = [["FEE_SEMANTICS", "FEE"], ["OPTION_SEMANTICS", "PAID_OPTION"], ["SURFACE_FLOW", "FLOW"], ["EXPLORATION_UNVERIFIED", "UNRESOLVED"]];
const candidates = cases.map(([kind], index) => ({ id: `benchmark:${index}`, kind, stage: "product", text: "익명화된 평가 문구", reason: "분류기 회귀 평가", evidenceIds: [] })) as ReviewCandidate[];
const predictions = classifyReviewCandidates(candidates);
const correct = predictions.filter((prediction, index) => prediction.label === cases[index][1]).length;
const unresolved = predictions.filter((prediction) => prediction.label === "UNRESOLVED").length;
console.log(JSON.stringify({ classifier: "dictionary-v1", cases: cases.length, correct, accuracy: correct / cases.length, unresolvedRate: unresolved / cases.length, predictions }, null, 2));
