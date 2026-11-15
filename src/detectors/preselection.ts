import { evidenceIds, type Finding, type Snapshot } from "../rules";

export function detectPreselection(snapshot: Snapshot): Finding[] {
  const reasons: string[] = [];
  for (const option of snapshot.options) {
    if (option.selected && option.won > 0) {
      reasons.push(`유료 옵션: ${option.label}`);
    }
  }
  if (!reasons.length) return [];
  return [{
    type: "PRESELECTION", status: "SUSPECTED", ruleVersion: "3", stage: snapshot.stage,
    reason: "사용자 조작 전에 다음 항목이 선택되어 있습니다. " + reasons.join(" · "),
    elementBounds: snapshot.options.find((option) => option.selected && option.won > 0)?.bounds,
    evidence: [snapshot], evidenceIds: evidenceIds([snapshot]),
  }];
}
