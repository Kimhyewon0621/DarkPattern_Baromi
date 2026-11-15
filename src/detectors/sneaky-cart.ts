import { evidenceIds, type Finding, type Snapshot } from "../rules";

export function detectSneakyCartAdd(snapshot: Snapshot): Finding[] {
  if (snapshot.stage !== "cart" || snapshot.cartItemCount === undefined || snapshot.cartItemCount <= 1) return [];
  return [{
    type: "SNEAKY_CART_ADD", status: "SUSPECTED", ruleVersion: "1", stage: "cart",
    reason: `격리된 빈 장바구니에서 상품 하나를 담았지만 장바구니에 ${snapshot.cartItemCount}개 품목이 표시됩니다.`,
    evidence: [snapshot], evidenceIds: evidenceIds([snapshot]),
  }];
}
