import { evidenceIds, type Finding, type Snapshot } from "../rules";
import type { JourneyBlocker } from "../purchase-journey";

const accept = /(?:동의|허용|수락|계속|혜택.{0,8}받|가입|구매|예\b|yes\b)/i;
const decline = /(?:거부|아니요?|싫어요|괜찮아요|혜택.{0,8}포기|나중에|취소|아니오|no\b)/i;
const shaming = /(?:손해|후회|불편하게|싫어요\??|혜택을\s*포기|똑똑한\s*선택|정말\s*거절|포기하시겠어요|실망)/i;

function boundsArea(control: NonNullable<Snapshot["decisionControls"]>[number]) {
  return Math.max(1, control.bounds.width * control.bounds.height);
}

/** Detect only paired decision controls; wording and visual asymmetry stay review signals. */
export function detectInteractionPatterns(snapshot: Snapshot): Finding[] {
  const controls = (snapshot.decisionControls ?? []).filter(({ label, bounds }) =>
    label.trim() && bounds.width > 0 && bounds.height > 0,
  );
  if (!controls.length) return [];
  const positive = controls.find(({ label }) => accept.test(label));
  const negative = controls.find(({ label }) => decline.test(label));
  if (!positive || !negative) return [];

  const findings: Finding[] = [];
  const pair = `${positive.label} / ${negative.label}`;
  const add = (type: Finding["type"], reason: string, elementBounds?: Snapshot["screenshotArea"]) => findings.push({
    type, status: "REVIEW_NEEDED", ruleVersion: "1", stage: snapshot.stage,
    reason, evidence: [snapshot], evidenceIds: evidenceIds([snapshot]),
    ...(elementBounds ? { elementBounds } : {}),
  });
  if (shaming.test(negative.label)) {
    add("CONFIRM_SHAMING", `수락·거부 선택지가 함께 보이고 거부 문구가 압박성일 수 있어 검토가 필요합니다: ${pair}`);
  }

  const large = boundsArea(positive);
  const small = boundsArea(negative);
  const ratio = Math.max(large, small) / Math.min(large, small);
  if (ratio >= 3) {
    add("MISDIRECTED_HIERARCHY", `수락·거부 선택지의 화면 면적이 약 ${ratio.toFixed(1)}배 차이 납니다. 대비·위치와 함께 검토하세요: ${pair}`,
      positive.bounds.width >= negative.bounds.width ? positive.bounds : negative.bounds);
  }

  const question = controls.find(({ label }) => /(?:동의하지\s*않|수신\s*거부|혜택을\s*포기|아니요.{0,20}(?:동의|혜택)|선택하지\s*않으면)/i.test(label));
  if (question) {
    add("TRICK_QUESTION", `수락·거부 선택지와 부정·조건 표현이 함께 있어 질문의 의미와 선택 결과를 확인해야 합니다: ${question.label}`);
  }
  return findings;
}

/** A login gate is a review signal only; it does not prove that guest purchase is unavailable. */
export function detectForcedAction(blocker: JourneyBlocker | null, snapshots: Snapshot[]): Finding[] {
  if (blocker?.code !== "LOGIN_REQUIRED") return [];
  const evidence = snapshots.find(({ stage }) => stage === blocker.stage);
  if (!evidence) return [];
  return [{
    type: "FORCED_ACTION", status: "REVIEW_NEEDED", ruleVersion: "1", stage: blocker.stage,
    reason: "구매 경로에서 로그인이 요구되는 신호가 있었지만 비회원 구매 대안은 확인되지 않았습니다. 필수 가입 여부를 검토하세요.",
    evidence: [evidence], evidenceIds: evidenceIds([evidence]),
  }];
}
