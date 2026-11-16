import type { CrawledSitePage } from "../site-crawler";
import type { SurfaceObservation } from "../purchase-journey";

const signup = /회원\s*가입|가입하기|sign\s*up|register/i;
const cancellation = /해지|탈퇴|구독\s*취소|unsubscribe|cancel\s*(?:subscription|membership)/i;
const phoneOnly = /(?:전화|유선)(?:\s*상담|\s*접수|\s*통화)?(?:로|으로)?\s*만|only\s*(?:by\s*)?(?:phone|call)/i;
const forcedReason = /(?:사유|이유|불만)(?:.{0,25})(?:필수|\d+\s*자\s*이상)|(?:required|mandatory)\s*(?:reason|explanation)/i;

export type CancellationAssessment = {
  status: "SUSPECTED" | "NOT_OBSERVED";
  reason: string;
  evidenceIds: string[];
};

/** Compare the online enrollment route with the cancellation route up to the
 * final confirmation. The scanner never performs the cancellation itself. */
export function assessCancellationObstruction(surfaces: SurfaceObservation[], pages: CrawledSitePage[]): CancellationAssessment | null {
  const subscription = surfaces.find((item) => item.kind === "SUBSCRIPTION" && item.outcome === "OBSERVED");
  const cancelSurface = surfaces.find((item) => item.kind === "CANCELLATION" && item.outcome === "OBSERVED");
  if (!subscription || !cancelSurface) return null;
  const enrollmentPage = pages.find((page) => page.outcome === "OBSERVED" && page.formsFound.length > 0
    && (signup.test(new URL(page.url).pathname) || page.interactives.some((control) =>
      control.visible && ["button", "input"].includes(control.tag) && signup.test(control.label))));
  if (!enrollmentPage) return null;
  const cancelPage = pages.find((page) => page.outcome === "OBSERVED" && page.url === cancelSurface.url
    && (cancellation.test(page.url) || page.statePath.some((state) => cancellation.test(state))));
  if (!cancelPage) return null;
  const evidenceIds = [subscription.evidenceId, enrollmentPage.evidenceId, cancelSurface.evidenceId, cancelPage.evidenceId];
  const cancelText = `${cancelSurface.text}\n${cancelPage.text}`;
  const onlineCancel = cancelPage.interactives.some((control) => control.visible && !control.disabled && cancellation.test(control.label));
  if (phoneOnly.test(cancelText) && !onlineCancel) return {
    status: "SUSPECTED", reason: "온라인 가입 경로는 확인됐지만 해지 화면은 전화 접수만 안내하고 온라인 해지 선택지를 제공하지 않습니다.", evidenceIds,
  };
  if (forcedReason.test(cancelText)) return {
    status: "SUSPECTED", reason: "해지 화면에서 해지 전에 필수 사유 입력을 요구합니다.", evidenceIds,
  };
  if (!onlineCancel) return null;
  return {
    status: "NOT_OBSERVED", reason: "온라인 가입과 해지 경로를 확인했고, 전화 전용 접수나 해지 전 필수 사유 입력을 관찰하지 않았습니다. 실제 해지 확정은 실행하지 않았습니다.", evidenceIds,
  };
}
