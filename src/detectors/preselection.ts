import { evidenceIds, type Finding, type InteractionEvidence, type Snapshot } from "../rules";
import type { CrawledSitePage } from "../site-crawler";

const optionalConsent = /마케팅|광고(?:성)?\s*(?:정보|수신|동의)|정보\s*수신|자동\s*(?:갱신|연장|결제)|멤버십|newsletter|marketing|auto.?renew|membership/i;
const authRoute = /(?:^|[\\/_-])(?:login|log-in|signin|sign-in|register|signup|sign-up|join|account)(?:[\\/_?#-]|$)|로그인|회원가입|가입하기/i;

/** Recognize an observed, pre-auth form from its route or its actual controls.
 * A login link in the page header alone is not enough to call the form inspected. */
export function isPreAuthConsentPage(page: CrawledSitePage): boolean {
  if (page.outcome !== "OBSERVED") return false;
  if (page.statePath.some((state) => /로그인 후|테스트 계정 로그인|인증 완료/i.test(state))) return false;
  if (page.statePath.includes("로그인 화면 (인증 전)")) return true;
  const url = (() => { try { return new URL(page.url).pathname; } catch { return page.url; } })();
  const controls = page.interactives.filter((item) => item.visible);
  const hasPassword = controls.some((item) => item.type.toLowerCase() === "password");
  const hasIdentity = controls.some((item) => /^(?:email|text|tel)$/i.test(item.type)
    && /email|e-mail|아이디|이메일|username|user\s*id|로그인/i.test(`${item.label} ${item.role}`));
  const namedAuthRoute = authRoute.test(`${url} ${page.title}`);
  return hasPassword && (hasIdentity || namedAuthRoute);
}

/** The pre-auth page is captured before the scanner submits credentials. Do
 * not infer an initial state from later crawl states after scanner clicks. */
export function detectInitialConsentPreselection(pages: CrawledSitePage[]): Finding[] {
  const authPages = pages.filter(isPreAuthConsentPage);
  const selected = authPages.flatMap((page) => page.interactives
    .filter((item) => item.visible && item.selected === true
      && ["checkbox", "radio"].includes(item.type.toLowerCase()) && optionalConsent.test(item.label))
    .map((item) => ({ ...item, evidenceId: page.evidenceId })));
  if (!selected.length) return [];
  return [{
    type: "PRESELECTION", status: "SUSPECTED", ruleVersion: "3", stage: "product",
    reason: "로그인 전 화면에서 다음 비필수 동의·갱신 항목이 사용자 조작 전에 선택되어 있습니다. "
      + [...new Set(selected.map(({ label }) => label))].join(" · "),
    evidence: [], evidenceIds: [...new Set(selected.map(({ evidenceId }) => evidenceId))],
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
