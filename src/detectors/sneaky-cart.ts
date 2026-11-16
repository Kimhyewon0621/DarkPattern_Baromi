import { evidenceIds, type Finding, type Snapshot } from "../rules";

export function detectSneakyCartAdd(snapshot: Snapshot): Finding[] {
  if (snapshot.stage !== "cart") return [];
  const lineIdentities = snapshot.cartLineIdentities ?? [];
  if (snapshot.cartLinesComplete === true && snapshot.requestedProductIdentity && lineIdentities.length
    && snapshot.cartCountBeforeAdd === 0
    && (lineIdentities.length !== 1 || lineIdentities[0] !== snapshot.requestedProductIdentity)) {
    // A post-add mismatch alone cannot establish that the scanner caused an
    // unrequested addition. Require a verified before/after identity delta.
    return [];
  }
  const hasComparison = snapshot.cartCountBeforeAdd !== undefined
    && snapshot.cartItemCount !== undefined
    && snapshot.requestedQuantity !== undefined;
  // A cart badge may count units, distinct lines, or a cached total. It cannot
  // establish an unrequested product without matching the actual cart lines.
  if (snapshot.inspection && snapshot.cartContentsVerified !== true) return [];
  if (snapshot.inspection && !hasComparison) return [];
  const unexpectedIncrease = hasComparison
    ? snapshot.cartItemCount! - snapshot.cartCountBeforeAdd! - snapshot.requestedQuantity!
    : snapshot.cartItemCount! - 1;
  if (snapshot.cartItemCount === undefined || unexpectedIncrease <= 0) return [];
  return [{
    type: "SNEAKY_CART_ADD", status: "SUSPECTED", ruleVersion: "1", stage: "cart",
    reason: hasComparison
      ? `담기 전 장바구니 ${snapshot.cartCountBeforeAdd}개, 요청 수량 ${snapshot.requestedQuantity}개, 담은 뒤 ${snapshot.cartItemCount}개로 요청 수량보다 ${unexpectedIncrease}개 더 증가했습니다.`
      : `격리된 빈 장바구니에서 상품 하나를 담았지만 장바구니에 ${snapshot.cartItemCount}개 품목이 표시됩니다.`,
    evidence: [snapshot], evidenceIds: evidenceIds([snapshot]),
  }];
}
