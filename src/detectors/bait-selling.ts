import type { FirstPriceExposure } from "../price-ledger";
import type { Finding, Snapshot } from "../rules";

const unavailable = /품절|판매\s*(?:종료|중단)|구매\s*불가|재고\s*없|sold\s*out|unavailable|out\s*of\s*stock/i;
const replacement = /대체\s*상품|유사\s*상품|비슷한\s*상품|다른\s*상품|alternative\s*product|similar\s*(?:product|item)/i;
const purchaseInvitation = /구매|담기|주문|buy|shop\s*now|add\s*to\s*cart/i;

function sameDestination(advertised: string, observed: string) {
  try {
    const left = new URL(advertised);
    const right = new URL(observed);
    return left.origin === right.origin && left.pathname.replace(/\/$/, "") === right.pathname.replace(/\/$/, "");
  } catch { return false; }
}

export type BaitSellingAssessment = { status: "SUSPECTED" | "REVIEW_NEEDED" | "NOT_OBSERVED"; reason: string; evidenceIds: string[] };

export function assessBaitSelling(exposure: FirstPriceExposure | undefined, snapshots: Snapshot[]): BaitSellingAssessment | null {
  const product = snapshots.find((snapshot) => snapshot.stage === "product" && exposure && sameDestination(exposure.productUrl, snapshot.url));
  if (!exposure || !product || !purchaseInvitation.test(exposure.text) || unavailable.test(exposure.text)) return null;
  const detailText = (product.textLines ?? []).join("\n");
  const evidenceIds = ["price:first-exposure", product.evidenceId ?? "evidence:product"];
  if (!unavailable.test(detailText)) {
    const checkout = snapshots.find((item) => item.stage === "checkout");
    if (!checkout || sameDestination(exposure.url, exposure.productUrl)) return null;
    return {
      status: "NOT_OBSERVED", reason: "목록에서 선택한 상품의 상세 경로에서 구매 차단이나 대체 상품 유도가 관찰되지 않았고 주문서에 도달했습니다. 주문서의 상품 동일성은 별도로 확인되지 않았습니다.",
      evidenceIds: [...evidenceIds, checkout.evidenceId ?? "evidence:checkout"],
    };
  }
  const offeredAlternative = (product.decisionControls ?? []).some((control) => replacement.test(control.label))
    || detailText.split(/\n+/).some((line) => replacement.test(line) && /(?:₩\s*)?\d[\d,]*\s*원|(?:buy|shop|구매|보기)/i.test(line));
  return {
    status: offeredAlternative ? "SUSPECTED" : "REVIEW_NEEDED",
    reason: offeredAlternative
      ? "목록에서 구매를 권한 상품이 상세 화면에서는 구매 불가로 표시되고 대체 상품으로 이동하는 선택지가 관찰됐습니다."
      : "목록에서 구매를 권한 상품이 상세 화면에서는 구매 불가로 표시됩니다. 대체 상품 유도 여부는 확인되지 않았습니다.",
    evidenceIds,
  };
}

/** Listing card and selected detail must refer to the same destination. A
 * stock-out by itself is not bait selling; a replacement offer must also be
 * observed before the basic engine emits a risk signal. */
export function detectBaitSelling(exposure: FirstPriceExposure | undefined, snapshots: Snapshot[]): Finding[] {
  const assessment = assessBaitSelling(exposure, snapshots);
  if (!assessment || assessment.status === "NOT_OBSERVED") return [];
  const evidence = snapshots.filter((item) => item.stage === "product");
  return [{
    type: "BAIT_SELLING", status: assessment.status, ruleVersion: "1", stage: "product",
    reason: assessment.reason, evidence, evidenceIds: assessment.evidenceIds,
  }];
}
