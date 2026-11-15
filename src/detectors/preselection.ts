import { evidenceIds, type Finding, type Snapshot } from "../rules";

export function detectPreselection(snapshot: Snapshot): Finding[] {
  const reasons: string[] = [];
  const signals = snapshot.precheckedSignals ?? [];
  reasons.push(...signals.map((signal) => `불리한 동의·자동연장 항목: ${signal.label}`));
  for (const option of snapshot.options) {
    const beneficial = /(?:무료|사은품|증정|증정품|gift|free)/i.test(option.label);
    if (option.selected && option.won > 0 && !beneficial) {
      reasons.push(`유료 옵션: ${option.label}`);
    }
  }
  if (!reasons.length) return [];
  return [{
    type: "PRESELECTION", status: "SUSPECTED", ruleVersion: "3", stage: snapshot.stage,
    reason: "사용자 조작 전에 다음 항목이 선택되어 있습니다. " + reasons.join(" · "),
    elementBounds: signals[0]?.bounds ?? snapshot.options.find((option) => option.selected && option.won > 0)?.bounds,
    evidence: [snapshot], evidenceIds: evidenceIds([snapshot]),
  }];
}
