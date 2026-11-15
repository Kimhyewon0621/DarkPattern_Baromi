import { evidenceIds, type Finding, type Snapshot } from "../rules";
import type { JourneyBlocker } from "../purchase-journey";

/** A blocked purchase path is a review signal; it does not prove that login
 * or another action is mandatory across every available route. */
export function detectForcedAction(blocker: JourneyBlocker | null, snapshots: Snapshot[]): Finding[] {
  if (blocker?.code !== "LOGIN_REQUIRED") return [];
  const evidence = snapshots.find(({ stage }) => stage === blocker.stage);
  if (!evidence) return [];
  return [{
    type: "FORCED_ACTION", status: "REVIEW_NEEDED", ruleVersion: "1", stage: blocker.stage,
    reason: "구매 경로에서 인증이 요구됐습니다. 비회원 구매 대안은 확인되지 않아 강제 여부를 검토해야 합니다.",
    evidence: [evidence], evidenceIds: evidenceIds([evidence]),
  }];
}
