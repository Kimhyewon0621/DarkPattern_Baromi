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

function normalizedIdentity(value: string) {
  return value.normalize("NFKC").replace(/^name:/i, "").replace(/[\p{P}\p{S}\s]+/gu, " ").trim().toLocaleLowerCase();
}

function distinctSpaStates(exposure: FirstPriceExposure) {
  return Boolean(exposure.listingStatePath && exposure.productStatePath
    && JSON.stringify(exposure.listingStatePath) !== JSON.stringify(exposure.productStatePath));
}

export type BaitSellingAssessment = { status: "SUSPECTED" | "NOT_OBSERVED"; reason: string; evidenceIds: string[] };

export function assessBaitSelling(exposure: FirstPriceExposure | undefined, snapshots: Snapshot[]): BaitSellingAssessment | null {
  const product = snapshots.find((snapshot) => snapshot.stage === "product" && exposure && sameDestination(exposure.productUrl, snapshot.url));
  if (!exposure || !product || !purchaseInvitation.test(exposure.text) || unavailable.test(exposure.text)) return null;
  if (exposure.productIdentity && product.productIdentity
      && normalizedIdentity(exposure.productIdentity) !== normalizedIdentity(product.productIdentity)) return null;
  const sameRoute = sameDestination(exposure.url, exposure.productUrl);
  if (sameRoute && !distinctSpaStates(exposure)) return null;
  const detailText = (product.textLines ?? []).join("\n");
  const evidenceIds = [...new Set(["price:first-exposure", ...(exposure.sourceEvidenceIds ?? []), product.evidenceId ?? "evidence:product"] )];
  if (!unavailable.test(detailText)) {
    const checkout = snapshots.find((item) => item.stage === "checkout");
    const cart = snapshots.find((item) => item.stage === "cart");
    if (!checkout || !cart || cart.cartContentsVerified !== true) return null;
    return {
      status: "NOT_OBSERVED", reason: "목록에서 선택한 상품의 상세 경로에서 구매 차단이나 대체 상품 유도가 관찰되지 않았고, 같은 상품이 장바구니와 주문서까지 이어졌습니다.",
      evidenceIds: [...evidenceIds, cart.evidenceId ?? "evidence:cart", checkout.evidenceId ?? "evidence:checkout"],
    };
  }
  const offeredAlternative = (product.decisionControls ?? []).some((control) => replacement.test(control.label))
    || detailText.split(/\n+/).some((line) => replacement.test(line) && /(?:₩\s*)?\d[\d,]*\s*원|(?:buy|shop|구매|보기)/i.test(line));
  if (!offeredAlternative) return {
    status: "NOT_OBSERVED", reason: "목록에서 구매를 권한 상품은 상세 화면에서 품절로 표시됐지만, 대체 상품으로 이동시키는 선택지는 확인되지 않았습니다.", evidenceIds,
  };
  return {
    status: "SUSPECTED",
    reason: "목록에서 구매를 권한 상품이 상세 화면에서는 구매 불가로 표시되고 대체 상품으로 이동하는 선택지가 관찰됐습니다.",
    evidenceIds,
  };
}

/** Listing card and selected detail must refer to the same destination. A
 * stock-out by itself is not bait selling; a replacement offer must also be
 * observed before the basic engine emits a risk signal. A clean result also
 * requires verified cart-line identity through checkout. */
export function detectBaitSelling(exposure: FirstPriceExposure | undefined, snapshots: Snapshot[]): Finding[] {
  const assessment = assessBaitSelling(exposure, snapshots);
  if (!assessment || assessment.status === "NOT_OBSERVED") return [];
  const evidence = snapshots.filter((item) => item.stage === "product");
  return [{
    type: "BAIT_SELLING", status: assessment.status, ruleVersion: "1", stage: "product",
    reason: assessment.reason, evidence, evidenceIds: assessment.evidenceIds,
  }];
}
