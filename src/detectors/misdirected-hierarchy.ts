import type { DecisionControl, Finding, Snapshot } from "../rules";

const accept = /동의|수락|계속|혜택\s*받|신청|가입|accept|agree|continue|confirm/i;
const decline = /거절|취소|동의하지|건너뛰기|나중에|아니오|decline|cancel|skip|no\s*thanks/i;

function luminance(color: string | undefined): number | null {
  const match = color?.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\s*\)$/i);
  if (!match || (match[4] !== undefined && Number(match[4]) < 1)) return null;
  const channels = match.slice(1, 4).map((value) => {
    const channel = Number(value) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(control: DecisionControl) {
  const foreground = luminance(control.color);
  const background = luminance(control.backgroundColor);
  if (foreground === null || background === null) return null;
  return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
}

function centerDistance(first: DecisionControl, second: DecisionControl) {
  const x = first.bounds.x + first.bounds.width / 2 - second.bounds.x - second.bounds.width / 2;
  const y = first.bounds.y + first.bounds.height / 2 - second.bounds.y - second.bounds.height / 2;
  return Math.hypot(x, y);
}

export type HierarchyAssessment = { status: "SUSPECTED" | "REVIEW_NEEDED" | "NOT_OBSERVED"; reason: string; evidenceIds: string[] };

/** Compare only nearby accept/decline controls for the same decision. A large
 * button alone is not enough to assert a dark pattern. */
export function assessMisdirectedHierarchy(snapshot: Snapshot): HierarchyAssessment | null {
  const controls = (snapshot.decisionControls ?? []).filter((item) => ["BUTTON", "LINK"].includes(item.kind));
  const pairs = controls.filter((item) => accept.test(item.label) && !decline.test(item.label)).flatMap((yes) =>
    controls.filter((no) => decline.test(no.label) && (!yes.group || !no.group || yes.group === no.group)
      && centerDistance(yes, no) <= 400).map((no) => ({ yes, no, distance: centerDistance(yes, no) })));
  const pair = pairs.sort((left, right) => left.distance - right.distance)[0];
  if (!pair) return null;
  const yesArea = pair.yes.bounds.width * pair.yes.bounds.height;
  const noArea = pair.no.bounds.width * pair.no.bounds.height;
  if (!yesArea || !noArea) return null;
  const areaRatio = yesArea / noArea;
  const noContrast = contrast(pair.no);
  const noKeyboard = pair.no.tabIndex !== undefined && pair.no.tabIndex < 0;
  const lowOpacity = pair.no.opacity !== undefined && pair.no.opacity < 0.5;
  const poorContrast = noContrast !== null && noContrast < 3;
  const facts = [`수락 선택지 «${pair.yes.label}»와 거절 선택지 «${pair.no.label}»`,
    `표시 면적 비율 ${areaRatio.toFixed(1)}:1`,
    ...(noContrast === null ? [] : [`거절 선택지 문자 대비 ${noContrast.toFixed(1)}:1`]),
    ...(noKeyboard ? ["거절 선택지가 키보드 탐색에서 제외됨"] : []),
    ...(lowOpacity ? ["거절 선택지 투명도 50% 미만"] : [])];
  const evidenceIds = [snapshot.evidenceId ?? `evidence:${snapshot.stage}`];
  if (areaRatio >= 4 && (noKeyboard || lowOpacity || poorContrast)) return {
    status: "SUSPECTED", reason: `같은 결정의 거절 선택지가 여러 시각·접근성 지표에서 불리합니다. ${facts.join(" · ")}`, evidenceIds,
  };
  if (areaRatio >= 4 || noKeyboard || lowOpacity || poorContrast || noContrast === null || pair.yes.tabIndex === undefined || pair.no.tabIndex === undefined) return {
    status: "REVIEW_NEEDED", reason: `같은 결정의 선택지 차이를 확인했지만 맥락 검토가 필요합니다. ${facts.join(" · ")}`, evidenceIds,
  };
  return { status: "NOT_OBSERVED", reason: `같은 결정의 수락·거절 선택지를 비교했으며 크기·대비·키보드 접근에서 편향 신호가 관찰되지 않았습니다. ${facts.join(" · ")}`, evidenceIds };
}

export function detectMisdirectedHierarchy(snapshot: Snapshot): Finding[] {
  const assessment = assessMisdirectedHierarchy(snapshot);
  if (!assessment || assessment.status === "NOT_OBSERVED") return [];
  return [{ type: "MISDIRECTED_HIERARCHY", status: assessment.status, ruleVersion: "1", stage: snapshot.stage,
    reason: assessment.reason, evidence: [snapshot], evidenceIds: assessment.evidenceIds }];
}
