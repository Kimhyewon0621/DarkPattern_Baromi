import { evidenceIds, type Finding, type Snapshot } from "../rules";
import type { JourneyBlocker } from "../purchase-journey";

/** An anonymous journey blocked by an explicit login gate is a concrete
 * signal under Baromi's strict rule. A test-account journey cannot establish
 * whether the same gate is imposed on guests. */
export function detectForcedAction(
  blocker: JourneyBlocker | null,
  snapshots: Snapshot[],
  authContext: "ANONYMOUS" | "TEST_ACCOUNT" | "UNKNOWN",
): Finding[] {
  if (blocker?.code !== "LOGIN_REQUIRED" || authContext !== "ANONYMOUS") return [];
  const evidence = snapshots.find(({ stage }) => stage === blocker.stage);
  if (!evidence) return [];
  return [{
    type: "FORCED_ACTION", status: "SUSPECTED", ruleVersion: "3", stage: blocker.stage,
    reason: "비회원 구매 시도에서 로그인 요구로 진행이 차단되었습니다.",
    evidence: [evidence], evidenceIds: evidenceIds([evidence]),
  }];
}
