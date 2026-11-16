import type { DecisionControl, Finding, Snapshot } from "../rules";
import type { CrawledSitePage } from "../site-crawler";

const accept = /동의|수락|계속|혜택\s*받|신청|가입|accept|agree|continue|confirm/i;
const decline = /거절|취소|동의하지|건너뛰기|나중에|아니오|decline|cancel|skip|no\s*thanks/i;
const exitAction = /로그아웃|회원\s*탈퇴|계정\s*삭제|sign\s*out|log\s*out|logout|signout|delete\s*account/i;

function luminance(color: string | undefined): number | null {
  if (!color) return null;
  const rgb = color.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\s*\)$/i);
  if (rgb) {
    if (rgb[4] !== undefined && Number(rgb[4]) < 1) return null;
    const channels = rgb.slice(1, 4).map((value) => {
      const channel = Number(value) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }
  const oklch = color.match(/^oklch\(\s*([\d.]+)(%)?\s+([\d.]+)(%)?\s+([\d.]+|none)(?:\s*\/\s*([\d.]+)%?)?\s*\)$/i);
  if (!oklch || (oklch[6] !== undefined && Number(oklch[6]) < 1)) return null;
  const lightness = Number(oklch[1]) / (oklch[2] ? 100 : 1);
  const chroma = Number(oklch[3]) * (oklch[4] ? 0.004 : 1);
  const hue = oklch[5].toLowerCase() === "none" ? 0 : Number(oklch[5]) * Math.PI / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  const channels = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ].map((channel) => Math.max(0, Math.min(1, channel)));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(control: DecisionControl) {
  const foreground = luminance(control.color);
  const background = luminance(control.backgroundColor);
  if (foreground === null || background === null) return null;
  return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
}

function contrastRatio(foreground: string | undefined, background: string | undefined) {
  const first = luminance(foreground);
  const second = luminance(background);
  if (first === null || second === null) return null;
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Compare account-exit links only with peer links in the same captured
 * navigation region. This extends hierarchy evidence beyond checkout choices
 * without treating a small control in isolation as a dark pattern. */
export function assessCrawledExitHierarchy(pages: CrawledSitePage[]): { status: "SUSPECTED"; reason: string; evidenceId: string }[] {
  const assessments: { status: "SUSPECTED"; reason: string; evidenceId: string }[] = [];
  for (const page of pages.filter((item) => item.outcome === "OBSERVED")) {
    const entries = (page.domText ?? []).filter((item) => item.visible && (item.href || item.interactive || item.tag === "button") && item.region && item.text.trim());
    const byControl = new Map<string, typeof entries[number]>();
    for (const entry of entries) {
      const key = `${entry.region}:${entry.href ?? `${entry.bounds.x}:${entry.bounds.y}:${entry.bounds.width}:${entry.bounds.height}`}`;
      const previous = byControl.get(key);
      if (!previous || entry.text.trim().length < previous.text.trim().length) byControl.set(key, entry);
    }
    const controls = [...byControl.values()];
    for (const target of controls.filter((item) => exitAction.test(item.text))) {
      const peers = controls.filter((item) => item !== target && item.region === target.region &&
        Math.hypot(item.bounds.x + item.bounds.width / 2 - target.bounds.x - target.bounds.width / 2,
          item.bounds.y + item.bounds.height / 2 - target.bounds.y - target.bounds.height / 2) <= 400);
      if (peers.length < 2) continue;
      const targetSize = Number.parseFloat(target.fontSize);
      const peerSize = median(peers.map(({ fontSize }) => Number.parseFloat(fontSize)).filter(Number.isFinite));
      const targetContrast = contrastRatio(target.color, target.backgroundColor);
      const peerContrasts = peers.map((item) => contrastRatio(item.color, item.backgroundColor)).filter((value): value is number => value !== null);
      const peerContrast = median(peerContrasts);
      const sizeRatio = targetSize > 0 && peerSize ? targetSize / peerSize : null;
      const contrastRatioToPeers = targetContrast !== null && peerContrast ? targetContrast / peerContrast : null;
      const contrastSignal = targetContrast !== null && targetContrast < 3 && contrastRatioToPeers !== null && contrastRatioToPeers <= 0.7;
      const severeSizeSignal = sizeRatio !== null && sizeRatio <= 0.6;
      if (!severeSizeSignal || !contrastSignal) continue;
      assessments.push({
        status: "SUSPECTED",
        evidenceId: page.evidenceId,
        reason: `같은 내비게이션 영역의 계정 종료 링크 «${target.text.trim()}»가 다른 링크보다 작고 낮은 대비로 표시됩니다.${sizeRatio === null ? "" : ` 글자 크기 비율 ${sizeRatio.toFixed(2)}:1.`}${targetContrast === null ? "" : ` 대비 ${targetContrast.toFixed(1)}:1${contrastRatioToPeers === null ? "" : ` (주변 링크 대비 ${contrastRatioToPeers.toFixed(2)}배)`}.`}`,
      });
    }
  }
  return assessments;
}

function centerDistance(first: DecisionControl, second: DecisionControl) {
  const x = first.bounds.x + first.bounds.width / 2 - second.bounds.x - second.bounds.width / 2;
  const y = first.bounds.y + first.bounds.height / 2 - second.bounds.y - second.bounds.height / 2;
  return Math.hypot(x, y);
}

export type HierarchyAssessment = { status: "SUSPECTED" | "NOT_OBSERVED"; reason: string; evidenceIds: string[] };

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
  return { status: "NOT_OBSERVED", reason: `같은 결정의 수락·거절 선택지에서 바로미의 엄격한 크기·대비·키보드 접근 기준을 함께 충족하는 신호가 없었습니다. ${facts.join(" · ")}`, evidenceIds };
}

export function detectMisdirectedHierarchy(snapshot: Snapshot): Finding[] {
  const assessment = assessMisdirectedHierarchy(snapshot);
  if (!assessment || assessment.status === "NOT_OBSERVED") return [];
  return [{ type: "MISDIRECTED_HIERARCHY", status: assessment.status, ruleVersion: "1", stage: snapshot.stage,
    reason: assessment.reason, evidence: [snapshot], evidenceIds: assessment.evidenceIds }];
}
