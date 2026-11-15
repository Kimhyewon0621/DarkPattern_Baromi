import { evidenceIds, type Fee, type Finding, type PriorFeeDisclosure, type Snapshot } from "../rules";
import { mandatoryFeeFromText } from "../price-text";

function paidRequired(fee: Fee) {
  return fee.required && fee.won > 0;
}

function sameFee(prior: Fee, current: Fee) {
  if (prior.id === current.id) return true;
  if (!prior.id.startsWith("text:") && !current.id.startsWith("text:")) return false;
  const name = mandatoryFeeFromText(prior.label)?.key;
  return name !== undefined && name === mandatoryFeeFromText(current.label)?.key;
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
