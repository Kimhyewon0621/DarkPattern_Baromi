import { evidenceIds, type Finding, type Snapshot } from "../rules";

const monthly = /(?:월\s*(?:납부|결제|요금|가격)?\s*(?:금액)?\s*[₩]?\s*(\d[\d,]*)\s*원|[₩]?\s*(\d[\d,]*)\s*원\s*\/\s*(?:월|month)|(?:per\s*month|monthly)\s*[₩]?\s*(\d[\d,]*))/i;
const fixedTerm = /(?:최소|의무|약정|계약)\s*(\d{1,3})\s*개월|(\d{1,3})\s*개월\s*(?:약정|의무|계약)/i;
const total = /(?:총\s*(?:결제|판매|구매|납부)?\s*(?:금액|가격|비용|액)|최종\s*(?:결제|금액)|total(?:\s*(?:price|amount|due))?)\s*[:：]?\s*[₩]?\s*(\d[\d,]*)\s*원?/i;

function amount(value: string | undefined) { return value ? Number(value.replaceAll(",", "")) : null; }
function totalAmount(lines: string[]) { return lines.map((line) => amount(line.match(total)?.[1])).find((value) => value !== null) ?? null; }
function monthlyAmount(lines: string[]) {
  const match = lines.join("\n").match(monthly);
  return amount(match?.[1] ?? match?.[2] ?? match?.[3]);
}

export type PriceComparisonAssessment = {
  status: "SUSPECTED" | "NOT_OBSERVED";
  reason: string;
  evidenceIds: string[];
};

/** The engine compares the same journey's displayed recurring and full costs.
 * An isolated missing unit-price label is never treated as a violation. */
export function assessPriceComparison(snapshots: Snapshot[]): PriceComparisonAssessment | null {
  const product = snapshots.find((item) => item.stage === "product");
  const checkout = snapshots.find((item) => item.stage === "checkout");
  if (!product || !checkout) return null;
  const productLines = [...product.priceLines, ...(product.textLines ?? [])];
  const checkoutLines = [...checkout.priceLines, ...(checkout.textLines ?? [])];
  const monthlyWon = monthlyAmount(productLines);
  const termMatch = productLines.join("\n").match(fixedTerm);
  const months = amount(termMatch?.[1] ?? termMatch?.[2]);
  const productTotal = totalAmount(productLines);
  const checkoutTotal = totalAmount(checkoutLines);
  const cart = snapshots.find((item) => item.stage === "cart");
  const evidence = [product, checkout];
  const ids = evidenceIds(evidence);
  if (monthlyWon && checkoutTotal && productTotal === null) {
    const sameConditions = product.options.length === 0 && checkout.options.length === 0
      && product.fees.length === 0 && checkout.fees.length === 0
      && cart?.cartContentsVerified === true
      && cart.cartItemCount === 1
      && cart.requestedQuantity === 1
      && Boolean(product.productIdentity)
      && cart.requestedProductIdentity === product.productIdentity
      && cart.cartLineIdentities?.length === 1
      && cart.cartLineIdentities[0] === product.productIdentity;
    if (sameConditions && months && months >= 2 && monthlyWon * months === checkoutTotal) return {
      status: "SUSPECTED",
      reason: `상품 화면에는 월 ${monthlyWon.toLocaleString("ko-KR")}원과 ${months}개월 의무 기간만 표시되고, 비교에 필요한 총 ${checkoutTotal.toLocaleString("ko-KR")}원은 주문서에서 처음 확인됩니다.`,
      evidenceIds: ids,
    };
    return null;
  }
  // Equal-looking totals alone do not establish a clean comparison: the cart
  // badge may count units or lines and the checkout may contain another item.
  // Require verified cart-line identity and complete price/fee extraction at
  // both endpoints before saying that no discrepancy was observed.
  const comparableConditions = product.inspection?.prices === "COMPLETE"
    && product.inspection.feeRows === "COMPLETE"
    && checkout.inspection?.prices === "COMPLETE"
    && checkout.inspection.feeRows === "COMPLETE"
    && cart?.cartContentsVerified === true
    && cart.cartItemCount === 1
    && cart.requestedQuantity === 1;
  if (comparableConditions && productTotal !== null && checkoutTotal === productTotal
    && product.options.length === 0 && checkout.options.length === 0
    && product.fees.length === 0 && checkout.fees.length === 0) return {
    status: "NOT_OBSERVED", reason: "동일 상품 한 개와 동일 수량의 구매 경로에서 가격·필수 비용 추출이 완료됐고, 상품 화면과 주문서 총액이 일치했습니다.", evidenceIds: [...ids, ...evidenceIds([cart!])],
  };
  return null;
}

export function detectPriceComparison(snapshots: Snapshot[]): Finding[] {
  const assessment = assessPriceComparison(snapshots);
  if (!assessment || assessment.status === "NOT_OBSERVED") return [];
  const checkout = snapshots.find((item) => item.stage === "checkout");
  if (!checkout) return [];
  return [{ type: "PRICE_COMPARISON_OBSTRUCTION", status: assessment.status, ruleVersion: "1", stage: "checkout",
    reason: assessment.reason, evidence: snapshots.filter((item) => item.stage === "product" || item.stage === "checkout"), evidenceIds: assessment.evidenceIds }];
}
