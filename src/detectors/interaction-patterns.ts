import { evidenceIds, type Finding, type Snapshot } from "../rules";
import type { JourneyBlocker } from "../purchase-journey";

/** A blocked purchase path is a review signal; it does not prove that login
 * or another action is mandatory across every available route. */
export function detectForcedAction(blocker: JourneyBlocker | null, snapshots: Snapshot[]): Finding[] {
  if (blocker?.code !== "LOGIN_REQUIRED") return [];
  const evidence = snapshots.find(({ stage }) => stage === blocker.stage);
  if (!evidence) return [];
  return [{
    type: "FORCED_ACTION", status: "SUSPECTED", ruleVersion: "1", stage: blocker.stage,
    reason: "현재 조사한 구매 경로에서 다음 단계 전에 인증을 요구했습니다. 비회원 대체 경로가 있는지는 이번 실행에서 확인하지 못했습니다.",
    evidence: [evidence], evidenceIds: evidenceIds([evidence]),
  }];
}
