import { createHash } from "node:crypto";
import type { Page } from "playwright";
import { waitForDomQuiet } from "./purchase-journey";

export type CrawledSitePage = {
  evidenceId: string;
  url: string;
  discoveredFrom: string | null;
  depth: number;
  statePath: string[];
  status: number | null;
  outcome: "OBSERVED" | "FETCH_FAILED";
  title: string;
  text: string;
  linksFound: number;
  controlsFound: string[];
  productCardsFound: string[];
  /** Direct text and accessible labels for content-bearing elements, including hidden copy. */
  domText: { tag: string; text: string; visible: boolean; fontSize: string; color: string; opacity: string; bounds: { x: number; y: number; width: number; height: number }; href?: string }[];
  interactives: { tag: string; label: string; role: string; type: string; visible: boolean; disabled: boolean; selected?: boolean; href?: string }[];
  formsFound: { method: string; action: string }[];
  elementCount: number;
  hiddenTextElementCount: number;
  outgoingLinks: string[];
  bodyTextLength: number;
  anchorCount: number;
  interactiveCount: number;
  capturedAt: string;
  failureReason?: string;
};

export type SkippedSiteLink = { url: string; discoveredFrom: string; reason: string };
export type SiteCrawlProgress = {
  /** Counts visited URL + SPA-state nodes; multiple states may share one URL. */
  visited: number;
  discovered: number;
  pending: number;
  currentUrl: string;
  uniqueVisitedUrls: number;
  uniqueDiscoveredUrls: number;
};
export type SiteCrawlResult = {
  complete: boolean;
  pages: CrawledSitePage[];
  skippedLinks: SkippedSiteLink[];
  unexploredControls: { url: string; label: string; reason: string; statePath?: string[] }[];
  nonNavigatingControls: { url: string; label: string; reason: string }[];
  skippedControls: { url: string; label: string; reason: string }[];
  pendingUrls: string[];
  discoveredUrlCount: number;
  visitedUrlCount: number;
  discoveredStateCount: number;
  visitedStateCount: number;
  uniqueDiscoveredUrlCount: number;
  uniqueVisitedUrlCount: number;
  productCardCount: number;
  failedUrlCount: number;
  maxDepth: number;
  durationMs: number;
  stopReason?: string;
};

function safeSkippedUrl(raw: string, base: string) {
  try {
    const url = new URL(raw, base);
    url.username = "";
    url.password = "";
    for (const key of [...url.searchParams.keys()]) if (sensitiveParam.test(key)) url.searchParams.set(key, "[가림]");
    url.hash = "";
    return url.href.slice(0, 1_000);
  } catch {
    return raw.replace(/[?#].*$/, "").slice(0, 1_000);
  }
}

type CrawlOptions = {
  maxPages?: number;
  maxDurationMs?: number;
  pageTimeoutMs?: number;
  concurrency?: number;
  maxQueuedUrls?: number;
  seedUrls?: string[];
};

/** Capture a pre-authentication screen before credential submission hides its
 * controls. It uses the same evidence shape and redaction rules as crawl pages. */
export async function captureCurrentPageAsCrawlEvidence(
  page: Page,
  options: { status: number | null; secrets: string[]; statePath?: string[] },
): Promise<CrawledSitePage> {
  const currentUrl = safeSkippedUrl(page.url(), page.url());
  const [title, extracted, inventory] = await Promise.all([
    page.title().catch(() => ""),
    page.evaluate(`(() => ({
      text: document.body?.innerText ?? "",
      links: Array.from(document.querySelectorAll('a[href]')).map(anchor => anchor.href).filter(Boolean),
      anchorCount: document.querySelectorAll('a[href]').length,
      interactiveCount: document.querySelectorAll('a[href], button, input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [onclick], [tabindex="0"]').length
    }))()`) as Promise<{ text: string; links: string[]; anchorCount: number; interactiveCount: number }>,
    page.evaluate(`(() => {
      const visible = element => {
        const style = getComputedStyle(element);
        return element.checkVisibility() && style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity || 1) > 0;
      };
      const texts = Array.from(document.body?.querySelectorAll("*") ?? []).flatMap(element => {
        const directText = Array.from(element.childNodes).filter(node => node.nodeType === Node.TEXT_NODE)
          .map(node => node.textContent ?? "").join(" ").replace(/\\s+/g, " ").trim();
        const text = directText || element.getAttribute("aria-label") || element.getAttribute("title") || element.getAttribute("alt") || element.getAttribute("placeholder") || "";
        if (!text) return [];
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const anchor = element.closest("a[href]");
        return [{ tag: element.tagName.toLowerCase(), text: text.slice(0, 500), visible: visible(element), fontSize: style.fontSize,
          color: style.color, opacity: style.opacity,
          bounds: { x: Math.round(rect.x), y: Math.round(rect.y + window.scrollY), width: Math.round(rect.width), height: Math.round(rect.height) },
          ...(anchor ? { href: anchor.href } : {}) }];
      });
      const interactives = Array.from(document.body?.querySelectorAll('a[href], button, input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [onclick], [tabindex="0"]') ?? []).map(node => {
        const input = node instanceof HTMLInputElement ? node : null;
        const option = node instanceof HTMLOptionElement ? node : null;
        const anchor = node instanceof HTMLAnchorElement ? node : node.closest("a[href]");
        const associatedLabels = input ? Array.from(input.labels ?? [], item => item.innerText.trim()).filter(Boolean).join(" ") : "";
        const label = node.innerText || node.getAttribute("aria-label") || node.getAttribute("title") || associatedLabels || input?.getAttribute("placeholder") || "";
        return { tag: node.tagName.toLowerCase(), label: label.replace(/\\s+/g, " ").trim().slice(0, 300),
          role: node.getAttribute("role") ?? "", type: input?.type ?? "", visible: visible(node), disabled: Boolean(node.disabled),
          ...(input && ["checkbox", "radio"].includes(input.type) ? { selected: input.checked } : option ? { selected: option.selected } : {}),
          ...(anchor ? { href: anchor.href } : {}) };
      });
      const forms = Array.from(document.body?.querySelectorAll("form") ?? []).map(form => ({ method: (form.getAttribute("method") ?? "GET").toUpperCase(), action: form.action || location.href }));
      return { elementCount: document.body?.querySelectorAll("*").length ?? 0, texts, interactives, forms };
    })()`) as Promise<{
      elementCount: number;
      texts: CrawledSitePage["domText"];
      interactives: CrawledSitePage["interactives"];
      forms: CrawledSitePage["formsFound"];
    }>,
  ]);
  const secrets = options.secrets;
  const normalizeHref = (href: string) => safeSkippedUrl(href, currentUrl);
  const text = redactText(extracted.text, secrets);
  const domText = inventory.texts.map((entry) => ({
    ...entry, text: redactText(entry.text, secrets),
    ...(entry.href ? { href: normalizeHref(entry.href) } : {}),
  }));
  const interactives = inventory.interactives.map((entry) => ({
    ...entry, label: redactText(entry.label, secrets),
    ...(entry.href ? { href: normalizeHref(entry.href) } : {}),
  }));
  const formsFound = inventory.forms.map((form) => ({ ...form, action: normalizeHref(form.action) }));
  const outgoingLinks = extracted.links.map(normalizeHref);
  return {
    evidenceId: `site-page:${createHash("sha256").update(`${currentUrl}::pre-auth`).digest("hex").slice(0, 20)}`,
    url: currentUrl, discoveredFrom: null, depth: 0, statePath: options.statePath ?? ["로그인 화면 (인증 전)"],
    status: options.status, outcome: "OBSERVED", title: redactText(title, secrets), text,
    linksFound: outgoingLinks.length, controlsFound: [...new Set(interactives.map(({ label }) => label).filter(Boolean))],
    productCardsFound: [], domText, interactives, formsFound, elementCount: inventory.elementCount,
    hiddenTextElementCount: domText.filter((entry) => !entry.visible).length,
    outgoingLinks, bodyTextLength: extracted.text.length, anchorCount: extracted.anchorCount,
    interactiveCount: extracted.interactiveCount, capturedAt: new Date().toISOString(),
  };
}

type QueueItem = { url: string; discoveredFrom: string | null; depth: number; statePath: string[]; controlIndexes: (number | null)[] };

const trackingParam = /^(?:utm_.+|fbclid|gclid|yclid|_ga|_gl)$/i;
const sensitiveParam = /^(?:sessionid|phpsessid|jsessionid|csrf|csrf_token|token|access_token|auth|authorization|password|code)$/i;
const stateChangingPath = /(?:^|\/)(?:logout|signout|unsubscribe|cancel|delete|withdraw|remove)(?:\/|$)/i;
// Cart and checkout GET pages are readable without confirming a purchase.
// Only exclude payment handoffs and explicit order confirmation/completion.
const purchasePath = /(?:^|\/)(?:payment)(?:\/|$)|(?:^|\/)order\/(?:confirm|complete|submit)(?:\/|$)|(?:^|\/)place-order(?:\/|$)/i;
const stateChangingQuery = /^(?:action|intent|add-to-cart|buy-now|checkout|logout|cancel|delete|unsubscribe|withdraw|remove|confirm|execute)$/i;
const safeNavigationLabel = /(?:상품|카테고리|목록|검색|후기|리뷰|추천|인기|쿠폰|이벤트|혜택|배송|교환|반품|정책|약관|로그인|회원가입|멤버십|구독|마이페이지|장바구니|카트|주문서|메뉴|다음|이전|페이지|더보기|shop|catalog|category|products?|search|review|recommend|popular|coupon|event|benefit|shipping|delivery|policy|terms|login|register|membership|account|cart|basket|checkout|menu|next|previous|more)/i;
const safeNavigationRegion = /(?:고객센터|공지|문의|자주\s*묻는|서비스|회사소개|브랜드|회원정보|내\s*정보|주문조회|마이쇼핑|고객지원|가이드|스토리|커뮤니티|support|help|contact|about|brand|profile|order\s*history|my\s*page|faq|notice)/i;
const unsafeNavigationLabel = /(?:담기|장바구니|카트|구매|주문|결제|확정|해지|탈퇴|삭제|취소|환불|신청|적용|받기|다운로드|로그아웃|sign\s*out|checkout|payment|purchase|buy\s*now|add\s*to|unsubscribe|delete|cancel|refund|submit|apply|download)/i;
const readOnlyAccountNavigationLabel = /(?:주문\s*[\/]\s*배송\s*조회|주문\s*내역|배송\s*조회|order\s*history|track\s*orders?)/i;
const readOnlyPurchaseNavigationLabel = /^(?:장바구니|카트|내\s*장바구니|쇼핑\s*카트|cart|basket|shopping\s*cart|주문서|주문서\s*작성|checkout)$/i;
const readOnlyPolicyControlLabel = /(?:(?:취소|환불|해지|탈퇴|반품).{0,24}(?:규정|정책|안내|조회|보기|방법|조건)|(?:규정|정책|안내|조회|보기|방법|조건).{0,24}(?:취소|환불|해지|탈퇴|반품))/i;
const paginationControlLabel = /^(?:다음|이전|next|previous|페이지\s*\d+|page\s*\d+|\d+)$/i;
const productTabLabel = /(?:상품\s*(?:상세|고시|정보|후기|리뷰)|배송\s*[\/·|]?\s*(?:교환|반품)|구매\s*(?:후기|리뷰)|description|specification|shipping\s*(?:\/|and)\s*returns?|reviews?)/i;
const readOnlyNavigationPattern = new RegExp(`${readOnlyAccountNavigationLabel.source}|${readOnlyPurchaseNavigationLabel.source}|${productTabLabel.source}|${readOnlyPolicyControlLabel.source}`, "i");

function redactText(value: string, secrets: string[]) {
  let text = value
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[이메일 가림]")
    .replace(/(?:\+?82[- ]?)?0?1[016789][- ]?\d{3,4}[- ]?\d{4}/g, "[연락처 가림]")
    .replace(/\b\d{6}[- ]?[1-4]\d{6}\b/g, "[식별번호 가림]");
  for (const secret of secrets.filter(Boolean)) text = text.replaceAll(secret, "[계정정보 가림]");
  return text.slice(0, 16_000);
}

function normalizeUrl(raw: string, base: string, targetHost: string): { url?: string; reason?: string } {
  let parsed: URL;
  try { parsed = new URL(raw, base); } catch { return { reason: "INVALID_URL" }; }
  if (parsed.protocol !== "https:") return { reason: "NON_HTTPS" };
  const shopHost = (hostname: string) => hostname.toLowerCase().replace(/^www\./, "");
  if (shopHost(parsed.hostname) !== shopHost(targetHost)) return { reason: "OUT_OF_SHOP_DOMAIN" };
  if (parsed.username || parsed.password) return { reason: "URL_CONTAINS_CREDENTIALS" };
  let path: string;
  try { path = decodeURIComponent(parsed.pathname); } catch { path = parsed.pathname; }
  if (purchasePath.test(path)) return { reason: "PURCHASE_FLOW_CHECKED_SEPARATELY" };
  if (stateChangingPath.test(path)) return { reason: "STATE_CHANGE_URL_NOT_OPENED" };
  for (const key of parsed.searchParams.keys()) {
    if (stateChangingQuery.test(key)) return { reason: "STATE_CHANGE_URL_NOT_OPENED" };
    if (sensitiveParam.test(key)) return { reason: "SENSITIVE_QUERY_NOT_OPENED" };
  }
  for (const key of [...parsed.searchParams.keys()]) if (trackingParam.test(key)) parsed.searchParams.delete(key);
  // Preserve hash-router routes (`#/category/...`) while collapsing ordinary
  // in-page anchors such as `#reviews` into the containing document URL.
  if (parsed.hash && !/^#(?:!\/|\/)/.test(parsed.hash)) parsed.hash = "";
  parsed.searchParams.sort();
  return { url: parsed.href };
}

function parseSitemapLocations(markup: string) {
  const source = markup.replace(/^\uFEFF/, "");
  const root = source.match(/^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[^]*?-->\s*)*(?:<!DOCTYPE[^>]*>\s*)?<(?:[\w.-]+:)?(urlset|sitemapindex)(?:\s|>)/i)?.[1]?.toLowerCase();
  if (root !== "urlset" && root !== "sitemapindex") return null;
  const decodeXml = (value: string) => value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([\da-f]+);/gi, (_match, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  const locations = [...source.matchAll(/<(?:[\w.-]+:)?loc(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?loc\s*>/gi)]
    .map((match) => decodeXml(match[1].trim()))
    .filter(Boolean);
  return { root, locations };
}

const navigationControlSelector = 'button, [role="tab"], [role="menuitem"], [role="button"], [role="link"], [onclick], [tabindex="0"], [class*="cursor-pointer"]';

async function loadLazyContent(page: Page, maxScrollSteps = 60) {
  let stableAtBottom = 0;
  const metricsScript = `(() => {
    const targets = Array.from(document.querySelectorAll('body *')).filter(element => {
      const style = getComputedStyle(element);
      return element.clientHeight > 100 && element.scrollHeight > element.clientHeight + 40 && /(auto|scroll)/.test(style.overflowY) && element.checkVisibility();
    });
    const bodyText = document.body?.innerText ?? '';
    return {
      height: document.documentElement.scrollHeight, textLength: bodyText.length,
      textHash: Array.from(bodyText).slice(0, 20000).reduce((hash, character) => (Math.imul(hash, 31) + character.charCodeAt(0)) | 0, 7),
      links: document.querySelectorAll('a[href]').length, elements: document.body?.querySelectorAll('*').length ?? 0,
      scrollY: window.scrollY, viewport: window.innerHeight, scrollTargets: targets.length,
      overflowedTargets: targets.filter(element => element.scrollTop + element.clientHeight < element.scrollHeight - 8).length,
      scrollPositions: targets.map(element => element.scrollTop).join(',')
    };
  })()`;
  let last = { height: 0, textLength: 0, textHash: 0, links: 0, elements: 0, scrollY: 0, viewport: 0, scrollTargets: 0, overflowedTargets: 0, scrollPositions: "" };
  for (let step = 0; step < maxScrollSteps; step++) {
    const before = await page.evaluate(metricsScript) as typeof last;
    await page.evaluate(`(() => {
      const candidates = Array.from(document.querySelectorAll('body *')).filter(element => {
        const style = getComputedStyle(element);
        return element.clientHeight > 100 && element.scrollHeight > element.clientHeight + 40 && /(auto|scroll)/.test(style.overflowY) && element.checkVisibility() && element.scrollTop + element.clientHeight < element.scrollHeight - 8;
      });
      const target = candidates[0];
      if (target) target.scrollBy(0, Math.max(240, Math.floor(target.clientHeight * 0.82)));
      else window.scrollBy(0, Math.max(320, Math.floor(window.innerHeight * 0.82)));
    })()`);
    await page.waitForFunction(`previous => {
      const body = document.body;
      const positions = Array.from(document.querySelectorAll('body *')).filter(element => {
        const style = getComputedStyle(element);
        return element.clientHeight > 100 && element.scrollHeight > element.clientHeight + 40 && /(auto|scroll)/.test(style.overflowY) && element.checkVisibility();
      }).map(element => element.scrollTop).join(',');
      return document.documentElement.scrollHeight > previous.height || window.scrollY !== previous.scrollY || positions !== previous.scrollPositions ||
        (body?.innerText.length ?? 0) > previous.textLength || document.querySelectorAll('a[href]').length !== previous.links ||
        body?.querySelectorAll('*').length !== previous.elements || Array.from(body?.innerText ?? '').slice(0, 20000).reduce((hash, character) => (Math.imul(hash, 31) + character.charCodeAt(0)) | 0, 7) !== previous.textHash;
    }`, before, { timeout: 350, polling: 100 }).catch(() => undefined);
    const after = await page.evaluate(metricsScript) as typeof last;
    const atBottom = after.scrollY + after.viewport >= after.height - 4 && after.overflowedTargets === 0;
    const contentChanged = after.height !== before.height || after.textHash !== before.textHash || after.links !== before.links || after.elements !== before.elements;
    stableAtBottom = atBottom && !contentChanged ? stableAtBottom + 1 : 0;
    last = after;
    if (stableAtBottom >= 2) return { complete: true, ...after };
  }
  return { complete: stableAtBottom >= 2, ...last };
}

function waitForShopContent(page: Page, timeoutMs = 4_000) {
  return page.waitForFunction(() => {
    const body = document.body;
    if (!body || document.readyState === "loading") return false;
    const text = (body.innerText ?? "").trim();
    const interactive = document.querySelector('a[href], button, [role="button"], [role="link"], [onclick], [tabindex="0"]');
    return text.length >= 24 || !!interactive || body.querySelector("main, article, [role=main]");
  }, undefined, { timeout: timeoutMs }).catch(() => undefined);
}

const clickableCardSelector = 'article, li, [data-product-id], [data-product], [class*="product-card" i], [class*="goods-card" i], [class*="item-card" i], [class*="product" i][class*="cursor-pointer" i], [class*="cursor-pointer"]';
const productCardActionPrefix = "__OPEN_PRODUCT_CARD__:";
const searchActionPrefix = "__SUBMIT_READ_ONLY_SEARCH__:";

async function productCardCandidates(page: Page) {
  return page.locator(clickableCardSelector).evaluateAll((nodes, unsafePattern) => nodes.flatMap((node, index) => {
    const element = node as HTMLElement;
    if (element.parentElement?.closest(unsafePattern.cardSelector)) return [];
    // Option rows and checkout summaries can contain prices and clickable
    // styling too, but they are not product cards. In particular, avoid
    // queuing those controls as if each one were a product detail page.
    if (element.closest('dialog, [role="dialog"], [aria-modal="true"]') || element.querySelector('input[type="checkbox"], input[type="radio"], [role="checkbox"], [role="radio"]')) return [];
    const text = (element.innerText ?? "").replace(/\s+/g, " ").trim();
    const hasPrice = /(?:[₩$£€]\s*\d[\d,.]*|\d[\d,.]*\s*원)/.test(text);
    const hasProductAction = [...element.querySelectorAll("button, [role='button'], a[href]")].some((control) =>
      /(?:담기|장바구니|구매(?:하기)?|바로\s*구매|특가|buy\s*now|add\s+to\s+(?:cart|bag|basket))/i.test((control as HTMLElement).innerText ?? control.getAttribute("aria-label") ?? ""));
    const style = getComputedStyle(element);
    const hasCardNavigation = element.matches('[onclick], [role="link"], [role="button"], [tabindex="0"]') || style.cursor === "pointer";
    if (!element.checkVisibility() || !hasPrice || (!hasProductAction && !hasCardNavigation) || text.length < 20) return [];
    const heading = element.querySelector("h2, h3, h4, [class*='title' i], [class*='name' i], h1") as HTMLElement | null;
    const title = (heading?.innerText ?? text).replace(/\s+/g, " ").trim().slice(0, 100);
    if (!title || new RegExp(unsafePattern.unsafeLabel, "i").test(title)) return [];
    const priceSignature = (text.match(/(?:[₩$£€]\s*\d[\d,.]*|\d[\d,.]*\s*원)/g) ?? []).join("|");
    return [{ index, title, identity: `${title.toLocaleLowerCase()}::${priceSignature}` }];
  }), { cardSelector: clickableCardSelector, unsafeLabel: unsafeNavigationLabel.source });
}

async function openProductCard(page: Page, encodedAction: string) {
  const [rawIndex, ...titleParts] = encodedAction.split(":");
  const expectedTitle = titleParts.join(":");
  const index = Number(rawIndex);
  if (!Number.isInteger(index) || index < 0) return false;
  const card = page.locator(clickableCardSelector).nth(index);
  const cardText = await card.innerText().catch(() => "");
  if (!cardText.includes(expectedTitle)) return false;
  const beforeUrl = page.url();
  const beforeText = await page.locator("body").innerText().catch(() => "");
  const box = await card.boundingBox();
  if (!box || box.width < 24 || box.height < 24) return false;
  // Click the identified product title instead of a card coordinate: card layouts
  // vary, and a fixed coordinate can land on the add-to-cart control.
  const titleTarget = card.locator("h1, h2, h3, h4, [class*='title' i], [class*='name' i]").filter({ hasText: expectedTitle }).first();
  if (await titleTarget.count()) await titleTarget.click({ timeout: 1_500 });
  else await card.click({ position: { x: Math.min(24, box.width - 8), y: Math.min(12, box.height - 8) }, timeout: 1_500 });
  await page.waitForFunction(({ url, text }) => location.href !== url || (document.body?.innerText ?? "") !== text,
    { url: beforeUrl, text: beforeText }, { timeout: 1_200 }).catch(() => undefined);
  await waitForDomQuiet(page, 75, 500);
  return page.url() !== beforeUrl || (await page.locator("body").innerText().catch(() => "")) !== beforeText;
}

async function submitSearchAction(page: Page, encodedAction: string) {
  const [rawIndex, encodedQuery] = encodedAction.split(":");
  const index = Number(rawIndex);
  if (!Number.isInteger(index) || index < 0 || !encodedQuery) return false;
  let query: string;
  try { query = decodeURIComponent(encodedQuery); } catch { return false; }
  if (!query || query.length > 120) return false;
  const input = page.locator("input").nth(index);
  const attributes = [
    await input.getAttribute("type").catch(() => ""),
    await input.getAttribute("name").catch(() => ""),
    await input.getAttribute("placeholder").catch(() => ""),
    await input.getAttribute("aria-label").catch(() => ""),
    await input.getAttribute("id").catch(() => ""),
  ].join(" ");
  if (!/(?:search|query|keyword|검색|찾기|^q\b)/i.test(attributes) || !await input.isVisible().catch(() => false)) return false;
  const beforeUrl = page.url();
  const beforeText = await page.locator("body").innerText().catch(() => "");
  await input.fill(query);
  await input.press("Enter");
  await page.waitForFunction(({ url, text }) => location.href !== url || (document.body?.innerText ?? "") !== text,
    { url: beforeUrl, text: beforeText }, { timeout: 1_500 }).catch(() => undefined);
  if (page.url() === beforeUrl && (await page.locator("body").innerText().catch(() => "")) === beforeText) {
    // Some SPA search boxes listen for delegated keyboard events and do not
    // trigger through the browser's native default action when no form exists.
    await input.dispatchEvent("keydown", { key: "Enter", code: "Enter", bubbles: true });
    await input.dispatchEvent("keyup", { key: "Enter", code: "Enter", bubbles: true });
    await page.waitForFunction(({ url, text }) => location.href !== url || (document.body?.innerText ?? "") !== text,
      { url: beforeUrl, text: beforeText }, { timeout: 1_000 }).catch(() => undefined);
  }
  await waitForDomQuiet(page, 75, 500);
  const afterText = await page.locator("body").innerText().catch(() => "");
  return page.url() !== beforeUrl || afterText !== beforeText;
}

async function clickSafeNavigationControl(page: Page, label: string, expectedIndex?: number) {
  const controls = page.locator(navigationControlSelector);
  const matching = await controls.evaluateAll((nodes, expected) => nodes.flatMap((node, index) => {
    const element = node as HTMLElement;
    const navigationItem = !!element.closest("nav, [role='navigation'], header, footer, [role='tablist'], [role='menu']");
    const named = element.innerText || element.getAttribute("aria-label") || element.getAttribute("title") || element.getAttribute("data-testid") || "";
    const iconMenu = !named && navigationItem && element.tagName === "BUTTON" && !!(
      element.querySelector("svg") || element.hasAttribute("aria-haspopup") || element.hasAttribute("aria-controls") ||
      /(?:menu|nav|hamburger)/i.test(typeof element.className === "string" ? element.className : "")
    );
    const current = (named || (iconMenu ? "아이콘 메뉴 열기" : "")).replace(/\s+/g, " ").trim();
    const expandable = element.hasAttribute("aria-expanded") || element.hasAttribute("aria-controls");
    const visible = element.checkVisibility();
    const safeInForm = !element.closest("form") || element.tagName === "A" || ["tab", "menuitem", "link"].includes(element.getAttribute("role") ?? "") ||
      (element.tagName === "BUTTON" && element.getAttribute("type") === "button");
    if (!visible || !safeInForm || current !== expected.label || element.hasAttribute("disabled")) return [];
    if (!navigationItem && !expandable && !new RegExp(expected.safePattern, "i").test(current)) return [];
    if (iconMenu && expected.label !== "아이콘 메뉴 열기") return [];
    if (new RegExp(expected.unsafePattern, "i").test(current) && !new RegExp(expected.readOnlyPattern, "i").test(current)) return [];
    return [index];
  }), { label, safePattern: `${safeNavigationLabel.source}|${safeNavigationRegion.source}`, unsafePattern: unsafeNavigationLabel.source, readOnlyPattern: readOnlyNavigationPattern.source });
  const selectedIndex = expectedIndex === undefined
    ? matching.length === 1 ? matching[0] : undefined
    : matching.includes(expectedIndex) ? expectedIndex : undefined;
  if (selectedIndex === undefined) return false;
  await controls.nth(selectedIndex).click({ timeout: 1_500 });
  await waitForDomQuiet(page, 75, 500);
  return true;
}

async function visibleStateSignature(page: Page) {
  return page.locator("body").evaluate((body) => {
    const bodyElement = body as HTMLElement;
    const controls = Array.from(bodyElement.querySelectorAll('a[href], button, [role="button"], [role="link"], [role="tab"], [onclick], [tabindex="0"]'))
      .filter((node) => {
        const element = node as HTMLElement;
        const style = getComputedStyle(element);
        return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length) && style.visibility !== "hidden" && style.display !== "none";
      })
      .map((node) => {
        const element = node as HTMLElement;
        const isInput = element instanceof HTMLInputElement;
        const isOption = element instanceof HTMLOptionElement;
        return [element.tagName, (element.innerText || element.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim(), element.className,
          element.getAttribute("aria-selected"), element.getAttribute("aria-pressed"), element.getAttribute("aria-current"),
          element.getAttribute("data-state"), element.getAttribute("data-active"), isInput ? (element as HTMLInputElement).checked : null, isOption ? (element as HTMLOptionElement).selected : null,
          element.getAttribute("href"), element.hasAttribute("disabled")];
      });
    return JSON.stringify([location.href, bodyElement.innerText, controls]);
  });
}

async function restoreStatePath(page: Page, statePath: string[], controlIndexes: (number | null)[] = []) {
  for (const [index, state] of statePath.entries()) {
    const restored = state.startsWith(productCardActionPrefix)
      ? await openProductCard(page, state.slice(productCardActionPrefix.length))
      : state.startsWith(searchActionPrefix)
        ? await submitSearchAction(page, state.slice(searchActionPrefix.length))
      : await clickSafeNavigationControl(page, state, controlIndexes[index] ?? undefined);
    if (!restored) return { restored: false, failedState: state };
  }
  return { restored: true as const, failedState: undefined };
}

/** Crawl the finite, safe, same-shop link graph. Forms and state-changing actions are never submitted. */
export async function crawlShopSite(
  sourcePage: Page,
  targetUrl: string,
  credentials: { username: string; password: string } | undefined,
  onProgress?: (progress: SiteCrawlProgress) => Promise<void>,
  options: CrawlOptions = {},
): Promise<SiteCrawlResult> {
  const startedAt = Date.now();
  const target = new URL(targetUrl);
  const maxPages = options.maxPages ?? 1_000;
  const maxDurationMs = options.maxDurationMs ?? 210_000;
  const pageTimeoutMs = options.pageTimeoutMs ?? 7_000;
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 4, 6));
  const maxQueuedUrls = options.maxQueuedUrls ?? 10_000;
  const frontier: QueueItem[] = [];
  const queued = new Set<string>();
  const visited = new Set<string>();
  const skipped = new Map<string, SkippedSiteLink>();
  const unexploredControls: SiteCrawlResult["unexploredControls"] = [];
  const nonNavigatingControls: SiteCrawlResult["nonNavigatingControls"] = [];
  const skippedControls: SiteCrawlResult["skippedControls"] = [];
  // A control label is not globally unique: “다음”, “전체 보기”, and category
  // names commonly recur on different pages. Scope deduplication to the exact
  // page/state so every distinct route can be explored.
  const exploredControlLabels = new Set<string>();
  const exploredSearchUrls = new Set<string>();
  // The same product is commonly repeated in “featured” and category grids.
  // Visit its detail once, while still visiting every distinct category page.
  const discoveredProductCards = new Set<string>();
  const exploredNavigationLabels = new Set<string>();
  const pages: CrawledSitePage[] = [];
  let stopReason: string | undefined;
  let maxDepth = 0;
  let startedVisits = 0;

  const nodeKey = (url: string, statePath: string[], controlIndexes: (number | null)[] = []) =>
    `${url}::state:${statePath.map((label, index) => `${label}#${controlIndexes[index] ?? "-"}`).join(" > ")}`;
  const enqueue = (raw: string, base: string, discoveredFrom: string | null, depth: number, statePath: string[] = [], controlIndexes: (number | null)[] = []) => {
    const normalized = normalizeUrl(raw, base, target.hostname);
    if (!normalized.url) {
      if (normalized.reason) {
        const key = `${raw}:${normalized.reason}`;
        if (!skipped.has(key)) skipped.set(key, { url: safeSkippedUrl(raw, base), discoveredFrom: discoveredFrom ? safeSkippedUrl(discoveredFrom, base) : safeSkippedUrl(base, base), reason: normalized.reason });
      }
      return;
    }
    const key = nodeKey(normalized.url, statePath, controlIndexes);
    if (visited.has(key) || queued.has(key)) return;
    if (queued.size + visited.size >= maxQueuedUrls) {
      stopReason = "URL_QUEUE_LIMIT";
      return;
    }
    frontier.push({ url: normalized.url, discoveredFrom, depth, statePath, controlIndexes });
    queued.add(key);
    maxDepth = Math.max(maxDepth, depth);
  };

  enqueue(target.href, target.href, null, 0);
  enqueue(new URL("/", target).href, target.href, null, 0);
  for (const seed of options.seedUrls ?? []) enqueue(seed, target.href, target.href, 0);
  const robotsPage = await sourcePage.context().newPage();
  try {
    const sitemapQueue: string[] = [];
    const queuedSitemaps = new Set<string>();
    const queueSitemap = (raw: string) => {
      const normalized = normalizeUrl(raw, target.href, target.hostname);
      if (!normalized.url || queuedSitemaps.has(normalized.url)) return;
      queuedSitemaps.add(normalized.url);
      sitemapQueue.push(normalized.url);
    };
    const response = await robotsPage.goto(new URL("/robots.txt", target).href, { waitUntil: "domcontentloaded", timeout: Math.min(pageTimeoutMs, 4_000) }).catch(() => null);
    if (response?.ok()) {
      const robotsText = await robotsPage.locator("body").innerText().catch(() => "");
      for (const match of robotsText.matchAll(/^\s*Sitemap:\s*(\S+)/gim)) {
        queueSitemap(match[1]);
      }
    }
    // Robots files are often absent or omit their sitemap declaration. Probe
    // the conventional sitemap endpoint once so unlinked catalog routes can
    // still enter the same bounded, same-origin crawl queue.
    if (sitemapQueue.length === 0) {
      queueSitemap(new URL("/sitemap.xml", target).href);
    }
    // Parse sitemap documents as discovery indexes, never as storefront
    // pages. Only actual <urlset>/<sitemapindex> XML roots are accepted;
    // app-shell fallbacks at /sitemap.xml must not become failed crawl pages.
    const maxSitemapDocuments = 30;
    let sitemapDocumentsRead = 0;
    for (let cursor = 0; cursor < sitemapQueue.length && sitemapDocumentsRead < maxSitemapDocuments; cursor++) {
      const sitemapUrl = sitemapQueue[cursor];
      const sitemapResponse = await robotsPage.goto(sitemapUrl, { waitUntil: "domcontentloaded", timeout: Math.min(pageTimeoutMs, 2_500) }).catch(() => null);
      if (!sitemapResponse?.ok()) continue;
      const contentType = sitemapResponse.headers()["content-type"] ?? "";
      if (!/\b(?:application|text)\/(?:[\w.+-]*\+)?xml\b/i.test(contentType)) continue;
      const parsed = parseSitemapLocations(await sitemapResponse.text().catch(() => ""));
      if (!parsed) continue;
      sitemapDocumentsRead++;
      for (const location of parsed.locations) {
        if (parsed.root === "sitemapindex") queueSitemap(location);
        else enqueue(location, sitemapUrl, target.href, 0);
      }
    }
    if (sitemapQueue.length > maxSitemapDocuments) {
      unexploredControls.push({
        url: target.href,
        label: "사이트맵 추가 문서",
        reason: `사이트맵 안전 한도 ${maxSitemapDocuments}개를 넘어 일부 문서를 확인하지 못했습니다.`,
      });
    }
  } finally {
    await robotsPage.close().catch(() => undefined);
  }
  const workers = await Promise.all(Array.from({ length: concurrency }, () => sourcePage.context().newPage()));
  const secrets = [credentials?.username ?? "", credentials?.password ?? ""];

  const crawlWorker = async (page: Page) => {
    page.setDefaultTimeout(4_000);
    while (!stopReason) {
      // An empty frontier is terminal even if the clock crosses the budget
      // while the last page is being recorded. Only stop on time when there
      // is still work left to do.
      if (frontier.length === 0) return;
      if (Date.now() - startedAt >= maxDurationMs) {
        stopReason = "TIME_BUDGET_REACHED";
        return;
      }
      if (startedVisits >= maxPages) {
        stopReason = "PAGE_BUDGET_REACHED";
        return;
      }
      const item = frontier.shift();
      if (!item) return;
      const itemKey = nodeKey(item.url, item.statePath, item.controlIndexes);
      queued.delete(itemKey);
      if (visited.has(itemKey)) continue;
      visited.add(itemKey);
      startedVisits++;
      const visitedUrlsAtStart = new Set([...pages.map(({ url }) => url), item.url]);
      const discoveredUrlsAtStart = new Set([...frontier.map(({ url }) => url), ...visitedUrlsAtStart]);
      await onProgress?.({
        visited: pages.length, discovered: queued.size + visited.size, pending: frontier.length, currentUrl: item.url,
        uniqueVisitedUrls: visitedUrlsAtStart.size, uniqueDiscoveredUrls: discoveredUrlsAtStart.size,
      });

      let status: number | null = null;
      let title = "";
      let text = "";
      let links: { href: string; text: string }[] = [];
      let controls: string[] = [];
      let controlCandidates: { label: string; index: number; navigationItem: boolean; active: boolean }[] = [];
      let productCards: { index: number; title: string; identity: string }[] = [];
      let domText: CrawledSitePage["domText"] = [];
      let interactives: CrawledSitePage["interactives"] = [];
      let formsFound: CrawledSitePage["formsFound"] = [];
      let elementCount = 0;
      let hiddenTextElementCount = 0;
      let lazyContentComplete = true;
      let unsafeControls: string[] = [];
      let bodyTextLength = 0;
      let anchorCount = 0;
      let interactiveCount = 0;
      let failureReason: string | undefined;
      let crawledUrl = item.url;
      try {
        const response = await page.goto(item.url, { waitUntil: "domcontentloaded", timeout: pageTimeoutMs });
        status = response?.status() ?? null;
        if (!response?.ok()) failureReason = response ? `HTTP_${response.status()}` : "NO_RESPONSE";
        await waitForDomQuiet(page);
        await waitForShopContent(page);
        const restored = await restoreStatePath(page, item.statePath, item.controlIndexes);
        if (!restored.restored) throw new Error(`SPA_STATE_REPLAY_FAILED: ${restored.failedState}`);
        crawledUrl = page.url();
        const lazyContent = await loadLazyContent(page);
        lazyContentComplete = lazyContent.complete;
        title = await page.title().catch(() => "");
        const extracted = await page.evaluate(`(() => ({
          text: document.body?.innerText ?? "",
          anchorCount: document.querySelectorAll('a[href]').length,
          interactiveCount: document.querySelectorAll('button, [role="button"], [role="link"], [onclick], [tabindex="0"], [class*="cursor-pointer"]').length,
          links: Array.from(document.querySelectorAll('a[href]')).map(anchor => ({ href: anchor.href, text: (anchor.textContent ?? anchor.getAttribute('aria-label') ?? '').replace(/\\s+/g, ' ').trim() })).filter(item => item.href),
          getSearchForms: Array.from(document.querySelectorAll('form')).flatMap(form => {
            if ((form.getAttribute('method') || 'GET').toUpperCase() !== 'GET') return [];
            return Array.from(form.querySelectorAll('input')).flatMap(input => {
              const type = (input.getAttribute('type') || 'text').toLowerCase();
              const label = [input.name, input.getAttribute('placeholder'), input.getAttribute('aria-label'), input.id].join(' ');
              if (!input.name || !['search', 'text', ''].includes(type) ||
                !(/^(?:q|query|keyword|search|term)$/i.test(input.name) || /(?:search|query|keyword|검색|찾기)/i.test(label))) return [];
              return [{ action: form.action || location.href, name: input.name, value: input.value || '' }];
            });
          }),
          unclassifiedControls: Array.from(document.querySelectorAll(${JSON.stringify(navigationControlSelector)})).flatMap(node => {
            const element = node;
            const label = (element.innerText || element.getAttribute('aria-label') || element.getAttribute('title') || '').replace(/\\s+/g, ' ').trim();
            const style = getComputedStyle(element);
            const visible = !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length) && style.visibility !== 'hidden' && style.display !== 'none';
            const safeInForm = !element.closest('form') || element.tagName === 'A' || ['tab', 'menuitem', 'link'].includes(element.getAttribute('role') || '') || (element.tagName === 'BUTTON' && element.getAttribute('type') === 'button');
            if (!visible || !safeInForm || element.disabled || !label || label.length > 100) return [];
            return [label];
          }),
          sitemapLocations: Array.from(document.querySelectorAll('loc')).map(node => node.textContent?.trim() ?? '').filter(Boolean),
          robotsSitemaps: (document.body?.innerText ?? '').split(/\\r?\\n/).map(line => line.match(/^\\s*Sitemap:\\s*(\\S+)/i)?.[1]).filter(Boolean),
          controls: Array.from(document.querySelectorAll(${JSON.stringify(navigationControlSelector)})).flatMap((node, index) => {
            const element = node;
            const navigationItem = !!element.closest('nav, [role="navigation"], header, footer, [role="tablist"], [role="menu"]');
            const named = element.innerText || element.getAttribute('aria-label') || element.getAttribute('title') || element.getAttribute('data-testid') || '';
            const iconMenu = !named && navigationItem && element.tagName === 'BUTTON' && (
              !!element.querySelector('svg') || element.hasAttribute('aria-haspopup') || element.hasAttribute('aria-controls') ||
              /(?:menu|nav|hamburger)/i.test(typeof element.className === 'string' ? element.className : '')
            );
            const label = (named || (iconMenu ? '아이콘 메뉴 열기' : '')).replace(/\\s+/g, ' ').trim();
            const style = getComputedStyle(element);
            const visible = !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length) && style.visibility !== 'hidden' && style.display !== 'none';
            const safeInForm = !element.closest('form') || element.tagName === 'A' || ['tab', 'menuitem', 'link'].includes(element.getAttribute('role') || '') || (element.tagName === 'BUTTON' && element.getAttribute('type') === 'button');
            const expandable = element.hasAttribute('aria-expanded') || element.hasAttribute('aria-controls');
            const paginationRegion = !!element.closest('[class*="pagination" i], [aria-label*="pagination" i], [aria-label*="페이지"], [data-pagination]');
            if (new RegExp(${JSON.stringify(paginationControlLabel.source)}, 'i').test(label) && !paginationRegion && !navigationItem) return [];
            const active = element.getAttribute('aria-selected') === 'true' || element.getAttribute('aria-pressed') === 'true' || element.getAttribute('aria-current') === 'page' || element.getAttribute('data-state') === 'active' || element.getAttribute('data-active') === 'true' || /(?:^|\s)(?:active|selected|current)(?:\s|$)/i.test(typeof element.className === 'string' ? element.className : '');
            const recognized = new RegExp(${JSON.stringify(`${safeNavigationLabel.source}|${safeNavigationRegion.source}`)}, 'i').test(label) || /\\//.test(label) || /^(?:전체\\s*보기|all\\s*(?:products|categories)?|view\\s*all|아이콘\\s*메뉴\\s*열기)$/i.test(label);
            const unsafe = new RegExp(${JSON.stringify(unsafeNavigationLabel.source)}, 'i').test(label) &&
              !new RegExp(${JSON.stringify(readOnlyNavigationPattern.source)}, 'i').test(label);
            if (!visible || !safeInForm || element.disabled || !label || label.length > 40 || (!navigationItem && !expandable && !recognized) || unsafe) return [];
            return [{ label, index, navigationItem, active }];
          })
        }))()`) as { text?: string; links?: { href: string; text: string }[]; getSearchForms?: { action: string; name: string; value: string }[]; sitemapLocations?: string[]; robotsSitemaps?: string[]; controls?: { label: string; index: number; navigationItem: boolean; active: boolean }[]; unclassifiedControls?: string[]; anchorCount?: number; interactiveCount?: number };
        const rawText = String(extracted.text ?? "");
        const inventory = await page.evaluate(`(() => {
          const body = document.body;
          const visible = element => {
            const style = getComputedStyle(element);
            return element.checkVisibility() && style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity || 1) > 0;
          };
          const texts = Array.from(body?.querySelectorAll("*") ?? []).flatMap((element) => {
            const directText = Array.from(element.childNodes)
              .filter((node) => node.nodeType === Node.TEXT_NODE)
              .map((node) => node.textContent ?? "").join(" ").replace(/\s+/g, " ").trim();
            const text = directText || element.getAttribute("aria-label") || element.getAttribute("title") || element.getAttribute("alt") || element.getAttribute("placeholder") || "";
            if (!text) return [];
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            const anchor = element.closest("a[href]");
            return [{ tag: element.tagName.toLowerCase(), text: text.slice(0, 500), visible: visible(element), fontSize: style.fontSize,
              color: style.color, opacity: style.opacity,
              bounds: { x: Math.round(rect.x), y: Math.round(rect.y + window.scrollY), width: Math.round(rect.width), height: Math.round(rect.height) },
              ...(anchor ? { href: anchor.href } : {}) }];
          });
          const interactives = Array.from(body?.querySelectorAll('a[href], button, input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [onclick], [tabindex="0"], [class*="cursor-pointer"]') ?? []).map((node) => {
            const element = node;
            const input = element instanceof HTMLInputElement ? element : null;
            const option = element instanceof HTMLOptionElement ? element : null;
            const anchor = element instanceof HTMLAnchorElement ? element : element.closest("a[href]");
            return {
              tag: element.tagName.toLowerCase(),
              label: (element.innerText || element.getAttribute("aria-label") || element.getAttribute("title") ||
                (input ? Array.from(input.labels ?? [], item => item.innerText.trim()).filter(Boolean).join(" ") : "") || input?.getAttribute("placeholder") || "").replace(/\s+/g, " ").trim().slice(0, 300),
              role: element.getAttribute("role") ?? "", type: input?.type ?? "",
              visible: visible(element), disabled: Boolean(element.disabled),
              ...(input && ["checkbox", "radio"].includes(input.type) ? { selected: input.checked } : option ? { selected: option.selected } : {}),
              ...(anchor ? { href: anchor.href } : {}),
            };
          });
          const forms = Array.from(body?.querySelectorAll("form") ?? []).map((form) => ({
            method: (form.getAttribute("method") ?? "GET").toUpperCase(), action: form.action || location.href,
          }));
          return { elementCount: body?.querySelectorAll("*").length ?? 0, texts, interactives, forms };
        })()`) as {
          elementCount: number;
          texts: CrawledSitePage["domText"];
          interactives: CrawledSitePage["interactives"];
          forms: { method: string; action: string }[];
        };
        bodyTextLength = rawText.length;
        anchorCount = extracted.anchorCount ?? 0;
        interactiveCount = extracted.interactiveCount ?? 0;
        text = redactText(rawText, secrets);
        elementCount = inventory.elementCount;
        domText = inventory.texts.map((entry) => ({
          ...entry, text: redactText(entry.text, secrets),
          ...(entry.href ? { href: safeSkippedUrl(entry.href, page.url()) } : {}),
        }));
        interactives = inventory.interactives.map((entry) => ({
          ...entry, label: redactText(entry.label, secrets),
          ...(entry.href ? { href: safeSkippedUrl(entry.href, page.url()) } : {}),
        }));
        hiddenTextElementCount = domText.filter((entry) => !entry.visible).length;
        formsFound = inventory.forms.map((form) => ({ ...form, action: safeSkippedUrl(form.action, page.url()) }));
        links = (extracted.links ?? []) as typeof links;
        unsafeControls = [...new Set(inventory.interactives.map(({ label }) => label.replace(/\s+/g, " ").trim().slice(0, 180)).filter((label) => label && unsafeNavigationLabel.test(label) && !readOnlyNavigationPattern.test(label)))];
        for (const form of inventory.forms) if (form.method === "GET") links.push({ href: form.action, text: "GET 양식 경로" });
        for (const label of [...new Set(extracted.unclassifiedControls ?? [])]) {
          if ((safeNavigationLabel.test(label) || safeNavigationRegion.test(label) || readOnlyNavigationPattern.test(label)) && (!unsafeNavigationLabel.test(label) || readOnlyNavigationPattern.test(label)) && !(extracted.controls ?? []).some((item) => item.label === label)) {
            unexploredControls.push({ url: item.url, label, reason: "화면 조작 후보는 있지만 안전한 화면 이동인지 분류하지 못했습니다.", statePath: item.statePath });
          }
        }
        if (!lazyContentComplete) unexploredControls.push({ url: item.url, label: "페이지 아래쪽 추가 콘텐츠", reason: "스크롤 조사 한도 안에 하단과 지연 로딩 콘텐츠가 안정되지 않아 미확인 상태입니다." });
        for (const label of unsafeControls) skippedControls.push({ url: item.url, label, reason: "계정·구매 상태를 바꿀 수 있어 실행하지 않았습니다. 버튼과 주변 문구는 DOM 증거로 보관했습니다." });
        for (const form of formsFound.filter(({ method }) => method !== "GET")) skippedControls.push({ url: item.url, label: `${form.method} form`, reason: "상태를 바꿀 수 있는 양식 제출은 실행하지 않았습니다." });
        controlCandidates = extracted.controls ?? [];
      controls = [...new Set(controlCandidates.map(({ label }) => label))];
        if (!item.statePath.some((state) => state.startsWith(productCardActionPrefix))) {
          productCards = await productCardCandidates(page);
        }
        for (const form of extracted.getSearchForms ?? []) {
          const searchUrl = new URL(form.action, item.url);
          if (!searchUrl.searchParams.has(form.name) || !searchUrl.searchParams.get(form.name)?.trim()) {
            searchUrl.searchParams.set(form.name, form.value.trim() || productCards[0]?.title || "상품");
          }
          links.push({ href: searchUrl.href, text: "검색 양식 결과" });
        }
        if (!item.statePath.some((state) => state.startsWith(productCardActionPrefix))) {
          const searchScopeUrl = normalizeUrl(crawledUrl, item.url, target.hostname).url ?? item.url;
          if (!exploredSearchUrls.has(searchScopeUrl)) {
            exploredSearchUrls.add(searchScopeUrl);
            const searchQuery = productCards[0]?.title || "상품";
            const searchInputIndexes: number[] = [];
            const inputLocator = page.locator("input");
            for (let index = 0; index < await inputLocator.count(); index++) {
              const input = inputLocator.nth(index);
              const type = (await input.getAttribute("type").catch(() => "text") ?? "text").toLowerCase();
              const name = await input.getAttribute("name").catch(() => "") ?? "";
              const label = [name, await input.getAttribute("placeholder").catch(() => ""), await input.getAttribute("aria-label").catch(() => ""), await input.getAttribute("id").catch(() => "")].join(" ");
              const hasForm = await input.evaluate((element) => Boolean((element as HTMLInputElement).form)).catch(() => true);
              if (!hasForm && await input.isVisible().catch(() => false) && ["search", "text", ""].includes(type) &&
                (/^(?:q|query|keyword|search|term)$/i.test(name) || /(?:search|query|keyword|검색|찾기)/i.test(label))) searchInputIndexes.push(index);
            }
            for (const inputIndex of searchInputIndexes) {
              const action = `${searchActionPrefix}${inputIndex}:${encodeURIComponent(searchQuery.slice(0, 120))}`;
              if (!item.statePath.includes(action)) {
                // Evidence for this node has already been snapshotted, so run the
                // read-only query on the same worker page and avoid opening and
                // replaying an extra page for every search box.
                const beforeSearchUrl = page.url();
                if (await submitSearchAction(page, action.slice(searchActionPrefix.length))) {
                  if (page.url() !== beforeSearchUrl) enqueue(page.url(), beforeSearchUrl, crawledUrl, item.depth + 1);
                  else enqueue(page.url(), beforeSearchUrl, crawledUrl, item.depth + 1, [...item.statePath, action], [...item.controlIndexes, null]);
                } else if (!nonNavigatingControls.some((entry) => entry.url === item.url && entry.label === "상품 검색")) {
                  nonNavigatingControls.push({ url: item.url, label: "상품 검색", reason: "검색어를 입력했지만 경로 또는 화면 내용이 바뀌지 않았습니다. 입력창은 현재 페이지 증거에 포함했습니다." });
                }
                }
            }
          }
        }
        const sitemapUrls = [
          ...((extracted.sitemapLocations ?? []) as string[]),
          ...((extracted.robotsSitemaps ?? []) as string[]),
          ...[...rawText.matchAll(/<loc>\s*(https?:\/\/[^<\s]+)\s*<\/loc>/gi)].map((match) => match[1]),
        ];
        for (const url of sitemapUrls) links.push({ href: url, text: "사이트맵에서 발견" });
      } catch (error) {
        failureReason = error instanceof Error ? error.name + ": " + error.message.slice(0, 180) : "NAVIGATION_FAILED";
      }
      const finalUrl = crawledUrl;
      const normalizedFinal = normalizeUrl(finalUrl, item.url, target.hostname).url ?? item.url;
      const evidenceId = `site-page:${createHash("sha256").update(nodeKey(normalizedFinal, item.statePath, item.controlIndexes)).digest("hex").slice(0, 20)}`;
      pages.push({
        evidenceId, url: normalizedFinal, discoveredFrom: item.discoveredFrom, depth: item.depth, statePath: item.statePath,
        status, outcome: failureReason ? "FETCH_FAILED" : "OBSERVED", title: redactText(title, secrets), text,
        linksFound: links.length, controlsFound: controls, productCardsFound: productCards.map(({ title }) => title),
        domText, interactives, formsFound, elementCount, hiddenTextElementCount,
        bodyTextLength, anchorCount, interactiveCount,
        outgoingLinks: links.flatMap(({ href }) => {
          const normalized = normalizeUrl(href, normalizedFinal, target.hostname);
          return normalized.url ? [normalized.url] : [];
        }),
        capturedAt: new Date().toISOString(),
        ...(failureReason ? { failureReason } : {}),
      });
      for (const link of links) enqueue(link.href, normalizedFinal, normalizedFinal, item.depth + 1);
      for (const card of productCards) {
        const action = `${productCardActionPrefix}${card.index}:${card.title}`;
        const cardKey = card.identity;
        if (!discoveredProductCards.has(cardKey)) {
          discoveredProductCards.add(cardKey);
          if (!item.statePath.includes(action)) enqueue(normalizedFinal, normalizedFinal, normalizedFinal, item.depth + 1, [...item.statePath, action], [...item.controlIndexes, null]);
        }
      }
      const noteUnexplored = (label: string, reason: string) => {
        if (unexploredControls.length < 5_000 && !unexploredControls.some((note) => note.url === normalizedFinal && note.label === label && note.reason === reason && JSON.stringify(note.statePath ?? []) === JSON.stringify(item.statePath))) {
          unexploredControls.push({ url: normalizedFinal, label, reason, statePath: item.statePath });
        }
      };
      const productScope = item.statePath.find((state) => state.startsWith(productCardActionPrefix));
      const isProductTabState = !!productScope && item.statePath.at(-1) !== productScope;
      // Controls are independent because every candidate gets a fresh page.
      // Probe two at a time per crawl worker to cut serial reload latency while
      // keeping browser memory bounded.
      for (let offset = 0; offset < controlCandidates.length; offset += 2) {
        await Promise.all(controlCandidates.slice(offset, offset + 2).map(async (control) => {
        const { label, index: controlIndex } = control;
        // Product tabs are sibling states queued from the product-detail state.
        // Reopening every other tab from each tab creates a combinatorial graph.
        // Product tabs are sibling views, not a navigation graph: clicking
        // tab A -> tab B -> tab A creates endless combinations without
        // exposing any new page. The initial product state queues each tab
        // once; tab states only explore non-tab routes/actions.
        if (isProductTabState && (control.navigationItem || productTabLabel.test(control.label))) return;
        // The active tab/category's content is already present in this snapshot.
        if (control.active) return;
        // The action that opened the current SPA state is already represented
        // by this snapshot. Repeating a modal/menu/tab trigger often closes it
        // or yields a false unexplored-control blocker. Pagination is the
        // exception: a repeated “next” control can reveal another page.
        if (item.statePath.at(-1) === label && !paginationControlLabel.test(label)) return;
        if (control.navigationItem) {
          const navKey = `${normalizedFinal}::${controlIndex}::${label}`;
          if (exploredNavigationLabels.has(navKey) && !paginationControlLabel.test(label)) return;
          exploredNavigationLabels.add(navKey);
        }
        const exploredKey = `${nodeKey(normalizedFinal, item.statePath, item.controlIndexes)}::control:${controlIndex}:${label}`;
        if (exploredControlLabels.has(exploredKey)) return;
        if (item.statePath.length >= 8) {
          noteUnexplored(label, "중첩 화면 상태 조사는 안전 깊이 한도에 도달했습니다.");
          return;
        }
        exploredControlLabels.add(exploredKey);
        let probe: Page | undefined;
        let openedPopup: Page | undefined;
        const capturePopup = (popup: Page) => { openedPopup = popup; };
        try {
          probe = await page.context().newPage();
          const probeResponse = await probe.goto(item.url, { waitUntil: "domcontentloaded", timeout: pageTimeoutMs });
          if (!probeResponse?.ok()) {
            noteUnexplored(label, "상호작용 후보가 있는 화면을 다시 열지 못했습니다.");
            return;
          }
          await waitForDomQuiet(probe);
          await waitForShopContent(probe);
          const restored = await restoreStatePath(probe, item.statePath, item.controlIndexes);
          if (!restored.restored) {
            noteUnexplored(label, "화면 상태를 재현하지 못했습니다.");
            return;
          }
          const beforeUrl = probe.url();
          const beforeSignature = await visibleStateSignature(probe).catch(() => "");
          // Some storefronts expose policy/help destinations as buttons that
          // open a new tab instead of anchors. Capture that tab so same-shop
          // pages join the crawl frontier instead of being silently missed.
          probe.on("popup", capturePopup);
          if (!await clickSafeNavigationControl(probe, label, controlIndex)) {
            noteUnexplored(label, "후보 동작을 안전한 단일 화면 이동으로 확정하지 못했습니다.");
            return;
          }
          // A parallel probe can fail while another probe of the same control
          // succeeds and records the destination state. Keep the report aligned
          // with the successful observation instead of leaving a stale blocker.
          for (let noteIndex = unexploredControls.length - 1; noteIndex >= 0; noteIndex--) {
            const note = unexploredControls[noteIndex];
            if (note.url === normalizedFinal && note.label === label && JSON.stringify(note.statePath ?? []) === JSON.stringify(item.statePath)) {
              unexploredControls.splice(noteIndex, 1);
            }
          }
          if (openedPopup) {
            await openedPopup.waitForURL((url) => url.href !== "about:blank", { timeout: pageTimeoutMs }).catch(() => undefined);
            await openedPopup.waitForLoadState("domcontentloaded", { timeout: pageTimeoutMs }).catch(() => undefined);
            await waitForDomQuiet(openedPopup, 75, 500).catch(() => undefined);
            const popupUrl = openedPopup.url();
            const normalizedPopup = normalizeUrl(popupUrl, beforeUrl, target.hostname);
            if (normalizedPopup.url) enqueue(normalizedPopup.url, beforeUrl, normalizedFinal, item.depth + 1);
            else if (normalizedPopup.reason) {
              const key = `${popupUrl}:${normalizedPopup.reason}`;
              if (!skipped.has(key)) skipped.set(key, { url: safeSkippedUrl(popupUrl, beforeUrl), discoveredFrom: normalizedFinal, reason: normalizedPopup.reason });
            }
          }
          const afterSignature = await visibleStateSignature(probe).catch(() => "");
          const changed = beforeSignature !== afterSignature;
          const nextUrl = normalizeUrl(probe.url(), beforeUrl, target.hostname).url;
          if (!nextUrl) {
            skippedControls.push({ url: normalizedFinal, label, reason: "동작 뒤 구매·계정 변경 가능 경로로 이동해 안전상 열지 않았습니다." });
          } else if (!changed) {
            if (!nonNavigatingControls.some((item) => item.url === normalizedFinal && item.label === label)) {
              nonNavigatingControls.push({ url: normalizedFinal, label, reason: "동작을 시도했지만 경로·화면 내용·선택 상태가 바뀌지 않았습니다. 현재 화면 증거에는 포함했습니다." });
            }
          } else if (nextUrl !== normalizedFinal) {
            enqueue(nextUrl, beforeUrl, normalizedFinal, item.depth + 1);
          } else {
            enqueue(nextUrl, beforeUrl, normalizedFinal, item.depth + 1, [...item.statePath, label], [...item.controlIndexes, controlIndex]);
          }
        } catch {
          noteUnexplored(label, "안전한 화면 이동 여부를 확인하지 못했습니다.");
        } finally {
          probe?.off("popup", capturePopup);
          await openedPopup?.close().catch(() => undefined);
          await probe?.close().catch(() => undefined);
        }
        }));
      }
      const visitedUrls = new Set(pages.map(({ url }) => url));
      const discoveredUrls = new Set([...frontier.map(({ url }) => url), ...pages.map(({ url }) => url), normalizedFinal]);
      await onProgress?.({
        visited: pages.length, discovered: queued.size + visited.size, pending: frontier.length, currentUrl: normalizedFinal,
        uniqueVisitedUrls: visitedUrls.size, uniqueDiscoveredUrls: discoveredUrls.size,
      });
    }
  };

  try {
    await Promise.all(workers.map((page) => crawlWorker(page)));
  } finally {
    await Promise.all(workers.map((page) => page.close().catch(() => undefined)));
  }
  const failedUrlCount = pages.filter((page) => page.outcome === "FETCH_FAILED").length;
  const pendingUrls = frontier.map(({ url, statePath }) => statePath.length ? `${url} [화면 상태: ${statePath.join(" → ")}]` : url);
  const complete = pendingUrls.length === 0 && failedUrlCount === 0 && unexploredControls.length === 0 && !stopReason;
  return {
    complete, pages, skippedLinks: [...skipped.values()], unexploredControls, nonNavigatingControls, skippedControls, pendingUrls,
    // Backward-compatible counts are state-node counts, not unique URL counts.
    // Keep both explicit so progress and reports cannot imply that 80 SPA states
    // mean 80 pages were visited.
    discoveredUrlCount: queued.size + visited.size,
    visitedUrlCount: pages.length,
    discoveredStateCount: queued.size + visited.size,
    visitedStateCount: pages.length,
    uniqueDiscoveredUrlCount: new Set([...frontier.map(({ url }) => url), ...pages.map(({ url }) => url)]).size,
    uniqueVisitedUrlCount: new Set(pages.map(({ url }) => url)).size,
    productCardCount: discoveredProductCards.size,
    failedUrlCount,
    maxDepth,
    durationMs: Date.now() - startedAt,
    ...(stopReason ? { stopReason } : {}),
  };
}
