import { evidenceIds, type Finding, type InteractionEvidence, type Snapshot } from "../rules";
import type { CrawledSitePage } from "../site-crawler";

const optionalConsent = /마케팅|광고(?:성)?\s*(?:정보|수신|동의)|정보\s*수신|자동\s*(?:갱신|연장|결제)|멤버십|newsletter|marketing|auto.?renew|membership/i;

/** The pre-auth page is captured before the scanner submits credentials. Do
 * not infer an initial state from later crawl states after scanner clicks. */
export function detectInitialConsentPreselection(pages: CrawledSitePage[]): Finding[] {
  const page = pages.find((item) => item.outcome === "OBSERVED" && item.statePath.includes("로그인 화면 (인증 전)"));
  if (!page) return [];
  const selected = page.interactives.filter((item) => item.visible && item.selected === true
    && ["checkbox", "radio"].includes(item.type.toLowerCase()) && optionalConsent.test(item.label));
  if (!selected.length) return [];
  return [{
    type: "PRESELECTION", status: "SUSPECTED", ruleVersion: "3", stage: "product",
    reason: "로그인 전 화면에서 다음 비필수 동의·갱신 항목이 사용자 조작 전에 선택되어 있습니다. "
      + selected.map(({ label }) => label).join(" · "),
    evidence: [], evidenceIds: [page.evidenceId],
  }];
}

export function detectPreselection(snapshot: Snapshot, interactions: InteractionEvidence[] = []): Finding[] {
  const reasons: string[] = [];
  for (const option of snapshot.options) {
    if (option.selected && option.won > 0) {
      reasons.push(`유료 옵션: ${option.label}`);
    }
  }
  for (const signal of snapshot.precheckedSignals ?? []) {
    if (!signal.label || reasons.some((reason) => reason.includes(signal.label))) continue;
    reasons.push(`조작 전 선택된 동의·갱신 항목: ${signal.label}`);
  }
  if (!reasons.length) return [];
  const confirmed = interactions.filter((interaction) =>
    interaction.stage === snapshot.stage && interaction.kind === "PAID_OPTION_TOGGLE"
    && interaction.beforeSelected === true && interaction.afterSelected === false
    && (interaction.amountDeltaWon ?? 0) > 0
    && snapshot.options.some(({ label, selected, won }) =>
      selected && label === interaction.controlLabel && won === interaction.amountDeltaWon),
  );
  const changes = confirmed.map(({ controlLabel, beforeTotalWon, afterTotalWon }) =>
    `${controlLabel} 해제 후 총액 ${beforeTotalWon}원 → ${afterTotalWon}원`);
  return [{
    type: "PRESELECTION", status: "SUSPECTED", ruleVersion: "3", stage: snapshot.stage,
    reason: "사용자 조작 전에 다음 항목이 선택되어 있습니다. " + [...reasons, ...changes].join(" · "),
    elementBounds: snapshot.options.find((option) => option.selected && option.won > 0)?.bounds ?? snapshot.precheckedSignals?.[0]?.bounds,
    evidence: [snapshot], evidenceIds: evidenceIds([snapshot]),
  }];
}
