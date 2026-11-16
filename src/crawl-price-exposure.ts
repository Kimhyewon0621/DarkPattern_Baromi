import type { CrawledSitePage } from "./site-crawler";
import type { Snapshot } from "./rules";
import type { FirstPriceExposure } from "./price-ledger";
import { feeMentionsFromText } from "./price-text";

const productCardAction = "__OPEN_PRODUCT_CARD__:";
const normalizeName = (value: string) => value.normalize("NFKC").replace(/^name:/i, "")
  .replace(/[\p{P}\p{S}\s]+/gu, " ").trim().toLocaleLowerCase();

function titleFromState(state: string) {
  if (!state.startsWith(productCardAction)) return null;
  const separator = state.indexOf(":", productCardAction.length);
  return separator < 0 ? null : state.slice(separator + 1).trim() || null;
}

function listingCardText(page: CrawledSitePage, title: string) {
  if (!page.productCardsFound.some((candidate) => normalizeName(candidate) === normalizeName(title))) return null;
  const normalizedPage = page.text.normalize("NFKC");
  const startAt = normalizedPage.toLocaleLowerCase().indexOf(title.normalize("NFKC").toLocaleLowerCase());
  if (startAt < 0) return null;
  const otherCardStarts = page.productCardsFound
    .filter((candidate) => normalizeName(candidate) !== normalizeName(title))
    .map((candidate) => normalizedPage.toLocaleLowerCase().indexOf(candidate.normalize("NFKC").toLocaleLowerCase()))
    .filter((index) => index > startAt);
  const nextCardAt = otherCardStarts.length ? Math.min(...otherCardStarts) : normalizedPage.length;
  // Card actions and category labels can precede the title in the DOM text.
  // Keep a bounded prefix while stopping before the next detected product.
  const start = Math.max(0, startAt - 220);
  const end = Math.min(nextCardAt, startAt + 1_200);
  return normalizedPage.slice(start, end).replace(/\s+/g, " ").trim();
}

/**
 * Link the selected purchase product to a catalog card and its SPA detail
 * state. This uses crawler state/evidence IDs and normalized product identity;
 * it does not infer a product from a shop name, URL convention, or wording.
 */
export function firstPriceExposureFromCrawl(
  pages: CrawledSitePage[], product: Snapshot | undefined,
): FirstPriceExposure | undefined {
  if (!product || product.stage !== "product" || !product.productIdentity) return undefined;
  const selectedName = normalizeName(product.productIdentity);
  const detailStates = pages.flatMap((page) => page.statePath.flatMap((state) => {
    const title = titleFromState(state);
    if (!title || normalizeName(title) !== selectedName) return [];
    const listing = pages.find((candidate) => candidate.url === page.url && !candidate.statePath.includes(state)
      && candidate.productCardsFound.some((cardTitle) => normalizeName(cardTitle) === selectedName));
    if (!listing) return [];
    const text = listingCardText(listing, title);
    if (!text || !/(?:구매|담기|주문|buy|shop\s*now|add\s*to\s*cart)/i.test(text)) return [];
    const amounts = [...text.matchAll(/(?:[₩$£€]\s*)?(\d[\d,]*)\s*원/g)]
      .filter((match) => !/(?:배송비|배송료|shipping|delivery\s*fee)[^\d]{0,12}$/i.test(text.slice(Math.max(0, match.index! - 32), match.index)))
      .map((match) => Number(match[1].replaceAll(",", "")))
      .filter((amount) => Number.isSafeInteger(amount) && amount > 0);
    if (!amounts.length) return [];
    return [{
      status: "OBSERVED" as const,
      url: listing.url,
      productUrl: page.url,
      text,
      amounts: [...new Set(amounts)],
      feeMentions: feeMentionsFromText(text),
      capturedAt: listing.capturedAt,
      productIdentity: product.productIdentity,
      listingStatePath: listing.statePath,
      productStatePath: page.statePath,
      sourceEvidenceIds: [listing.evidenceId, page.evidenceId],
    } satisfies FirstPriceExposure];
  }));
  return detailStates[0];
}
