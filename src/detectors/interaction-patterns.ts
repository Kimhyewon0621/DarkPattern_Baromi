import { evidenceIds, type Finding, type Snapshot } from "../rules";
import type { JourneyBlocker } from "../purchase-journey";

/** A blocked purchase path is a review signal; it does not prove that login
 * or another action is mandatory across every available route. */
export function detectForcedAction(blocker: JourneyBlocker | null, snapshots: Snapshot[]): Finding[] {
  if (blocker?.code !== "LOGIN_REQUIRED") return [];
  const evidence = snapshots.find(({ stage }) => stage === blocker.stage);
  if (!evidence) return [];
  return [{
    type: "FORCED_ACTION", status: "REVIEW_NEEDED", ruleVersion: "2", stage: blocker.stage,
    reason: "이 구매 경로에서 인증 화면에 도달했습니다. 비회원으로 계속 구매할 수 있는 대체 경로가 있는지는 확인하지 못했습니다.",
    evidence: [evidence], evidenceIds: evidenceIds([evidence]),
  }];
}
