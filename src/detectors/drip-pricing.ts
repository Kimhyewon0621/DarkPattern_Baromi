import { evidenceIds, type Fee, type Finding, type PriorFeeDisclosure, type Snapshot } from "../rules";
import { displayedTotal, mandatoryFeeFromText } from "../price-text";

function paidRequired(fee: Fee) {
  return fee.required && fee.won > 0;
}

function sameFee(prior: Fee, current: Fee) {
  if (prior.id === current.id) return true;
  const name = mandatoryFeeFromText(prior.label)?.key;
  const currentName = mandatoryFeeFromText(current.label)?.key;
  if (name !== undefined && name === currentName && prior.won === current.won) return true;
  const normalize = (label: string) => label.normalize("NFKC").replace(/[\s\p{P}\p{S}]/gu, "").toLocaleLowerCase();
  return prior.won === current.won && normalize(prior.label) === normalize(current.label);
}

/** A clean conclusion requires complete extraction and a verified, single-item
 * journey with the same labelled total at the first and final price screens. */
export function assessDripPricing(snapshots: Snapshot[]) {
  const product = snapshots.find(({ stage }) => stage === "product");
  const cart = snapshots.find(({ stage }) => stage === "cart");
  const checkout = snapshots.find(({ stage }) => stage === "checkout");
  if (!product || !cart || !checkout) return null;
  if ([product, cart, checkout].some((item) => item.inspection?.prices !== "COMPLETE" || item.inspection.feeRows !== "COMPLETE")) return null;
  if (cart.cartContentsVerified !== true || cart.requestedQuantity !== 1 || cart.cartItemCount !== 1) return null;
  if (product.options.some(({ selected, won }) => selected && won > 0)
    || checkout.options.some(({ selected, won }) => selected && won > 0)) return null;
  const firstTotal = displayedTotal(product.priceLines) ?? product.payableAmount ?? null;
  const finalTotal = displayedTotal(checkout.priceLines) ?? checkout.payableAmount ?? null;
  if (firstTotal === null || finalTotal === null || firstTotal !== finalTotal) return null;
  const disclosed = product.fees.filter(paidRequired);
  const laterFees = [...cart.fees, ...checkout.fees].filter(paidRequired);
  if (laterFees.some((fee) => !disclosed.some((prior) => sameFee(prior, fee)))) return null;
  return {
    status: "NOT_OBSERVED" as const,
    reason: `상품 화면부터 주문서까지 같은 상품 한 개의 표시 총액(${finalTotal.toLocaleString("ko-KR")}원)을 대조했고, 가격·필수 비용 추출이 모두 완료됐으며 새 필수 비용이 나타나지 않았습니다.`,
    evidenceIds: [product, cart, checkout].map((item) => item.evidenceId ?? `evidence:${item.stage}`),
  };
}

export function detectDripPricing(product: Snapshot, later: Snapshot[], priorDisclosures: PriorFeeDisclosure[] = []): Finding[] {
  const disclosed = product.fees.filter(paidRequired);
  const newlyDisclosed: { fee: Fee; snapshot: Snapshot }[] = [];
  for (const snapshot of later) {
    for (const fee of snapshot.fees.filter(paidRequired)) {
      const currentKey = mandatoryFeeFromText(fee.label)?.key;
      if (currentKey && priorDisclosures.some((item) => item.key === currentKey && item.won === fee.won)) continue;
      if (disclosed.some((prior) => sameFee(prior, fee))) continue;
      newlyDisclosed.push({ fee, snapshot });
      disclosed.push(fee);
    }
  }
  if (!newlyDisclosed.length) return [];
  const evidence = [product, ...new Set(newlyDisclosed.map(({ snapshot }) => snapshot))];
  return [{
    type: "DRIP_PRICING",
    status: "SUSPECTED",
    ruleVersion: "3",
    stage: newlyDisclosed[0].snapshot.stage,
    reason: "상품 상세 이후에 필수 비용이 처음 표시됩니다. " + newlyDisclosed.map(({ fee }) => fee.label).join(" · "),
    elementBounds: newlyDisclosed[0].fee.bounds,
    evidence,
    evidenceIds: evidenceIds(evidence),
  }];
}
