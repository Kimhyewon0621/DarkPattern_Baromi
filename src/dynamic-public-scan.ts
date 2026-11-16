import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Browser } from "playwright";
import { buildPriceLedger, type FirstPriceExposure } from "./price-ledger";
import { isProductPage } from "./public-scan";
import { explorePurchaseJourney, waitForDomQuiet, type JourneyBlocker, type SurfaceObservation } from "./purchase-journey";
import { observePaidOptionChanges } from "./journey-evidence";
import { capture } from "./scan";
import { scanComparisonVersion } from "./scan-comparison";
import { detect, type InteractionEvidence, type Snapshot } from "./rules";
import { detectForcedAction } from "./detectors/interaction-patterns";
import { detectInitialConsentPreselection } from "./detectors/preselection";
import { feeMentionsFromText } from "./price-text";
import { collectCrawlRuleCandidates, collectExplorationReviewCandidate, collectReviewCandidates, collectRuleReviewCandidates, collectSurfaceReviewCandidates } from "./review-candidates";
import { classifyReviewCandidates } from "./review-classifier";
import { structuredProductLinks } from "./structured-product-links";
import type { TestCredentials } from "./credential-vault";
import { clickAndWaitForChange, openLoginForm, submitLoginForm } from "./test-login";
import { classifyDynamicFailure } from "./scan-failure";
import { summarizeAiUsage } from "./ai-cost";
import { buildRuleCoverage } from "./rule-coverage";
import { diagnosticSurfaceKinds, type DiagnosticSurfaceKind } from "./diagnostic-surfaces";
import type { ScanPhaseStatus } from "./scan-phases";
import { captureCurrentPageAsCrawlEvidence, crawlShopSite, type CrawledSitePage, type SiteCrawlProgress, type SiteCrawlResult } from "./site-crawler";

const rootHost = (hostname: string) => hostname.replace(/^www\./, "");

export function dynamicScanStatus(
  reached: "product" | "cart" | "checkout",
  blocker: JourneyBlocker | null,
  siteCrawlComplete: boolean,
) {
  return reached === "checkout" && !blocker && siteCrawlComplete ? "COMPLETED" as const : "PARTIAL" as const;
}

export function classifyCrawledSurfaceKinds(routeAndText: string): DiagnosticSurfaceKind[] {
  const kinds: DiagnosticSurfaceKind[] = [];
  if (/(?:catalog|category|categories|product|goods|item|search|shop|상품|카테고리|검색)/i.test(routeAndText)) kinds.push("CATALOG");
  if (/(?:login|sign[-_ ]?in|register|signup|join|로그인|회원가입|회원 등록)/i.test(routeAndText)) kinds.push("AUTH");
  if (/(?:coupon|promotion|promo|쿠폰|프로모션|할인코드)/i.test(routeAndText)) kinds.push("COUPON");
  if (/(?:recommend|popular|best|review|추천|인기|베스트|후기|리뷰)/i.test(routeAndText)) kinds.push("RECOMMENDATION");
  if (/(?:subscription|membership|auto[-_ ]?renew|구독|멤버십|자동\s*갱신)/i.test(routeAndText)) kinds.push("SUBSCRIPTION");
  if (/(?:cancel|unsubscribe|withdraw|refund|해지|탈퇴|환불|취소|반품)/i.test(routeAndText)) kinds.push("CANCELLATION");
  if (/(?:shipping|delivery|exchange|return|policy|terms|배송|교환|반품|정책|약관)/i.test(routeAndText)) kinds.push("POLICY");
  return kinds;
}

export function isAllowedDynamicRequest(targetUrl: string, requestUrl: string) {
  try {
    const target = new URL(targetUrl);
    const request = new URL(requestUrl);
    return ["data:", "blob:"].includes(request.protocol) ||
      (request.protocol === "https:" && rootHost(request.hostname) === rootHost(target.hostname));
  } catch {
    return false;
  }
}

export async function scanDynamicPublicShop(
  browser: Browser,
  targetUrl: string,
  directory: string,
  proxyServer: string,
  viewport: "DESKTOP" | "MOBILE",
  onStage: (snapshot: Snapshot) => Promise<void>,
  purchasePath: "CART" | "DIRECT" = "CART",
  credentials?: TestCredentials,
  onSurfacePhase?: (surface: DiagnosticSurfaceKind, status: ScanPhaseStatus, details?: { reason?: string; evidenceIds?: string[] }) => Promise<void>,
  onCrawlProgress?: (progress: SiteCrawlProgress) => Promise<void>,
) {
  const target = new URL(targetUrl);
  const stageStartedAt = Date.now();
  let stageCheckpointAt = stageStartedAt;
  const stageTimingsMs: Record<string, number> = {};
  let productLinksConsidered = 0;
  let productLinksVisited = 0;
  let productLinksFound = 0;
  await mkdir(directory, { recursive: true });
  const mobile = viewport === "MOBILE";
  const context = await browser.newContext({
    proxy: { server: proxyServer }, serviceWorkers: "block", acceptDownloads: false,
    locale: "ko-KR", timezoneId: "Asia/Seoul",
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1,
  });
  try {
    await context.route("**/*", async (route) => {
      const request = route.request();
      let url: URL;
      try { url = new URL(request.url()); } catch { await route.abort(); return; }
      if (["data:", "blob:"].includes(url.protocol)) { await route.continue(); return; }
      // Keep the dynamic session inside the verified storefront origin. A
      // third-party asset is not evidence-critical and must not expand the
      // requested scan's network boundary or receive session state.
      if (!isAllowedDynamicRequest(target.href, url.href)) {
        await route.abort();
        return;
      }
      await route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(4_000);
    let response: Awaited<ReturnType<typeof page.goto>> = null;
    let navigationError: unknown;
    // The local worker reaches public stores through a DNS-validating CONNECT
    // proxy. A transient DNS/upstream close appears in Chromium as
    // ERR_EMPTY_RESPONSE before any shop data is read. Retry that initial,
    // side-effect-free navigation once instead of turning the whole report
    // into an immediate all-unverified result.
    for (let attempt = 0; attempt < 2 && !response; attempt++) {
      try {
        response = await page.goto(target.href, { waitUntil: "domcontentloaded", timeout: 20_000 });
      } catch (error) {
        navigationError = error;
        if (attempt === 0) await page.waitForTimeout(300);
      }
    }
    if (!response && navigationError) throw navigationError;
    if (!response?.ok()) throw new Error("쇼핑몰 첫 화면을 불러오지 못했습니다.");
    await waitForDomQuiet(page);
    let authenticationObservation: SurfaceObservation | null = null;
    let authenticatedWithTestAccount = false;
    let preAuthenticationPage: CrawledSitePage | null = null;
    if (credentials && await openLoginForm(page)) {
      // Login overlays can contain preselected consent and renewal controls.
      // Preserve their actual checked states before submitting credentials.
      preAuthenticationPage = await captureCurrentPageAsCrawlEvidence(page, {
        status: response.status(), secrets: [credentials.username, credentials.password],
        statePath: ["로그인 화면 (인증 전)"],
      });
      await submitLoginForm(page, credentials);
      authenticatedWithTestAccount = true;
      authenticationObservation = {
        evidenceId: "surface:auth:test-account", kind: "AUTH", url: page.url(), status: response.status(),
        title: "테스트 계정 로그인", text: "승인된 테스트 계정으로 로그인 화면을 제출하고 인증 후 화면에 도달했습니다.",
        source: "BUTTON", outcome: "OBSERVED",
      };
    }

    // Preserve diagnostic surfaces already visible on the storefront landing
    // page. They are real inspected evidence even when the shop implements
    // categories, reviews, or coupons as same-page buttons instead of links.
    const landingText = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 6_000);
    const landingUrl = page.url();
    const landingObservations: SurfaceObservation[] = [];
    const visibleProductActions = await page.getByRole("button", { name: /(?:구매|상품\s*보기|장바구니|담기|buy|view\s*product|add\s*to)/i })
      .or(page.getByRole("link", { name: /(?:구매|상품\s*보기|장바구니|담기|buy|view\s*product|add\s*to)/i })).filter({ visible: true }).count();
    const visibleProductCards = await page.locator('article:visible, [class*="product" i]:visible, [class*="item" i]:visible').count();
    if (/(?:[₩$£€]\s*\d[\d,.]*|\d[\d,.]*\s*원)/.test(landingText) && (visibleProductActions > 0 || visibleProductCards > 1)) {
      landingObservations.push({
        evidenceId: "surface:catalog:landing", kind: "CATALOG", url: landingUrl, status: response.status(),
        title: "쇼핑몰 첫 상품 목록", text: landingText, source: "BUTTON", outcome: "OBSERVED",
      });
    }
    if (/(?:추천|인기|베스트|후기|리뷰|recommend|popular|best|review)/i.test(landingText)) {
      landingObservations.push({
        evidenceId: "surface:recommendation:landing", kind: "RECOMMENDATION", url: landingUrl, status: response.status(),
        title: "첫 화면의 추천·인기·후기 영역", text: landingText, source: "BUTTON", outcome: "OBSERVED",
      });
    }
    if (/(?:쿠폰|프로모션|할인코드|coupon|promo)/i.test(landingText)) {
      landingObservations.push({
        evidenceId: "surface:coupon:landing", kind: "COUPON", url: landingUrl, status: response.status(),
        title: "첫 화면의 쿠폰·프로모션 영역", text: landingText, source: "BUTTON", outcome: "OBSERVED",
      });
    }
    for (const surface of [...new Set(landingObservations.map(({ kind }) => kind))]) {
      await onSurfacePhase?.(surface, "COVERED", {
        evidenceIds: landingObservations.filter((item) => item.kind === surface).map(({ evidenceId }) => evidenceId),
      });
    }

    let firstPriceExposure: FirstPriceExposure | undefined;
    if (!await isProductPage(page, page.url())) {
      const listingUrl = page.url();
      const links = await page.locator("a[href]").evaluateAll((anchors) => anchors.slice(0, 300).map((item) => ({
        href: item.getAttribute("href") ?? "",
        context: (item.closest("article, li, [class*='product' i], [class*='item' i]") ?? item).textContent?.replace(/\s+/g, " ").trim().slice(0, 500) ?? "",
      })));
      const structuredLinks = structuredProductLinks(await page.locator('script[type="application/ld+json"]').allTextContents());
      const metadataLinks = await page.locator('link[rel="canonical"][href], meta[property="og:url"][content]').evaluateAll((nodes) => nodes.flatMap((node) => {
        const href = node.getAttribute("href") ?? node.getAttribute("content") ?? "";
        return href ? [{ href, context: "표준 상품 메타데이터" }] : [];
      }));
      const candidates = new Set<string>();
      const contexts = new Map<string, string>();
      const candidateScore = (item: { href: string; context: string }) =>
        (/(?:product|상품|detail|item|goods|sku)/i.test(item.href) ? 4 : 0) +
        (/(?:\d[\d,]*\s*원|₩)/.test(item.context) ? 3 : 0) +
        (/(?:상품|product|item|goods)/i.test(item.context) ? 2 : 0);
      const ranked = [...links, ...structuredLinks, ...metadataLinks]
        .filter((item) => candidateScore(item) >= 3)
        .sort((left, right) => candidateScore(right) - candidateScore(left));
      for (const { href, context } of ranked) {
        let candidate: URL;
        try { candidate = new URL(href, page.url()); } catch { continue; }
        if (candidate.protocol !== "https:" || rootHost(candidate.hostname) !== rootHost(target.hostname) ||
            /(?:^|\/)(?:search|search\.html)(?:\/|$)/i.test(candidate.pathname) ||
            [...candidate.searchParams.keys()].some((key) => /^(?:q|query|keyword|search|action|add-to-cart|redirect|return_url)$/i.test(key))) continue;
        candidates.add(candidate.href);
        if (!contexts.has(candidate.href)) contexts.set(candidate.href, context);
      }
      productLinksFound = candidates.size;
      const candidateRoutes = [...candidates].slice(0, 10);
      productLinksConsidered = candidateRoutes.length;
      const listingScreenshot = "listing.png";
      await page.screenshot({ path: join(directory, listingScreenshot), fullPage: false, scale: "css" });
      const listingCapturedAt = new Date().toISOString();
      let found = false;
      for (const candidate of candidateRoutes) {
        productLinksVisited++;
        const next = await page.goto(candidate, { waitUntil: "domcontentloaded", timeout: 5_000 }).catch(() => null);
        if (next?.ok() && await isProductPage(page, page.url())) {
          const text = contexts.get(candidate) ?? "";
          const observedAmounts = [...text.matchAll(/(?:₩\s*)?(\d[\d,]*)\s*원/g)]
            .map((match) => Number(match[1].replaceAll(",", ""))).filter((amount) => Number.isFinite(amount) && amount > 0);
          if (observedAmounts.length) firstPriceExposure = {
            status: "OBSERVED", url: listingUrl, productUrl: page.url(), text,
            amounts: [...new Set(observedAmounts)], feeMentions: feeMentionsFromText(text),
            screenshot: listingScreenshot, capturedAt: listingCapturedAt,
          };
          found = true;
          break;
        }
      }
      if (!found) {
        // Some modern React shops render product cards as clickable divs and
        // expose no product href. Select one card with a visible price, then
        // verify that the click actually opened a product surface.
        if (page.url() !== listingUrl) {
          await page.goto(listingUrl, { waitUntil: "domcontentloaded", timeout: 5_000 }).catch(() => undefined);
        }
        const clickableCards = page.locator('[class*="cursor-pointer"]:visible').filter({
          hasText: /(?:₩|\d[\d,]*\s*원)/,
        });
        const semanticCards = page.locator('article:visible, li:visible').filter({
          hasText: /(?:₩|\d[\d,]*\s*원)/,
          has: page.getByRole("button", { name: /담기|add\s*to/i }),
        });
        const cards = await clickableCards.count() ? clickableCards : semanticCards;
        for (let index = 0; index < Math.min(await cards.count(), 3); index++) {
          const card = cards.nth(index);
          if (!await card.isVisible().catch(() => false)) continue;
          const context = (await card.innerText().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 2_000);
          const before = page.url();
          await clickAndWaitForChange(page, card).catch(() => undefined);
          if (await isProductPage(page, page.url())) {
            const observedAmounts = [...context.matchAll(/(?:₩\s*)?(\d[\d,]*)\s*원/g)]
              .map((match) => Number(match[1].replaceAll(",", ""))).filter((amount) => Number.isFinite(amount) && amount > 0);
            if (observedAmounts.length) firstPriceExposure = {
              status: "OBSERVED", url: listingUrl, productUrl: page.url(), text: context,
              amounts: [...new Set(observedAmounts)], feeMentions: feeMentionsFromText(context),
              screenshot: listingScreenshot, capturedAt: listingCapturedAt,
            };
            found = true;
            break;
          }
          if (page.url() !== before) await page.goto(listingUrl, { waitUntil: "domcontentloaded", timeout: 5_000 }).catch(() => undefined);
        }
      }
      if (!found) {
        // Some listings expose only a per-card purchase button and open the
        // product detail in a modal. Open one visible card action and accept it
        // only when the resulting surface has detail-specific controls.
        const cardActions = page.getByRole("button", { name: /(?:특가\s*)?구매하기|상품\s*보기|view\s*(?:product|details?)/i })
          .or(page.getByRole("link", { name: /(?:특가\s*)?구매하기|상품\s*보기|view\s*(?:product|details?)/i }))
          .filter({ visible: true });
        for (let index = 0; index < Math.min(await cardActions.count(), 6); index++) {
          const action = cardActions.nth(index);
          const context = await action.evaluate((node) => {
            let current = node.parentElement;
            for (let depth = 0; current && depth < 8; depth++, current = current.parentElement) {
              const text = current.textContent?.replace(/\s+/g, " ").trim() ?? "";
              if (/(?:₩\s*)?\d[\d,]*\s*원/.test(text)) return text.slice(0, 2_000);
            }
            return "";
          });
          await clickAndWaitForChange(page, action).catch(() => undefined);
          if (!await isProductPage(page, page.url())) continue;
          const observedAmounts = [...context.matchAll(/(?:₩\s*)?(\d[\d,]*)\s*원/g)]
            .map((match) => Number(match[1].replaceAll(",", ""))).filter((amount) => Number.isFinite(amount) && amount > 0);
          if (observedAmounts.length) firstPriceExposure = {
            status: "OBSERVED", url: listingUrl, productUrl: page.url(), text: context,
            amounts: [...new Set(observedAmounts)], feeMentions: feeMentionsFromText(context),
            screenshot: listingScreenshot, capturedAt: listingCapturedAt,
          };
          found = true;
          break;
        }
      }
      if (!found) {
        // A client-rendered storefront may expose product cards as buttons with
        // no detail URL. Preserve the rendered listing as the product-stage
        // evidence instead of failing the whole scan; journey exploration will
        // report an explicit ambiguous/missing action without guessing a SKU.
        const listingText = await page.locator("body").innerText().catch(() => "");
        const actionPattern = /(?:구매|장바구니|카트|담기|buy|cart|bag|add)/i;
        const purchaseActions = page.getByRole("button", { name: actionPattern })
          .or(page.getByRole("link", { name: actionPattern }));
        const inputActions = page.locator('input[type="submit"], input[type="button"]');
        const inputCount = await inputActions.evaluateAll((items, source) => items.filter((item) => {
          if (!(item as HTMLElement).checkVisibility()) return false;
          return new RegExp(source as string, "i").test(`${(item as HTMLInputElement).value} ${item.getAttribute("aria-label") ?? ""}`);
        }).length, actionPattern.source);
        if (/(?:[₩$£€]\s*\d[\d,.]*|\d[\d,.]*\s*원)/.test(listingText) &&
            (await purchaseActions.count() + inputCount > 0)) {
          const observedAmounts = [...listingText.matchAll(/(?:₩\s*)?(\d[\d,]*)\s*원/g)]
            .map((match) => Number(match[1].replaceAll(",", ""))).filter((amount) => Number.isFinite(amount) && amount > 0);
          firstPriceExposure = {
            status: "OBSERVED", url: listingUrl, productUrl: listingUrl, text: listingText.slice(0, 2_000),
            amounts: [...new Set(observedAmounts)].slice(0, 20), feeMentions: feeMentionsFromText(listingText),
            screenshot: listingScreenshot, capturedAt: listingCapturedAt,
          };
        } else {
          throw new Error("동적으로 검사할 상품 상세 화면을 찾지 못했습니다.");
        }
      }
    }

    await mkdir(directory, { recursive: true });
    const snapshots: Snapshot[] = [];
    const interactions: InteractionEvidence[] = [];
    const journeyTimeoutMs = Math.min(Math.max(Number(process.env.DYNAMIC_JOURNEY_TIMEOUT_MS ?? 60_000), 20_000), 120_000);
    let journeyFailure: string | null = null;
    let journeyTimer: ReturnType<typeof setTimeout> | undefined;
    const journeyPromise = explorePurchaseJourney(page, async (stage) => {
      const checkpoint = Date.now();
      stageTimingsMs[stage] = checkpoint - stageCheckpointAt;
      stageCheckpointAt = checkpoint;
      const activeSurface = page.locator('[role="dialog"]:visible, [aria-modal="true"]:visible, div.fixed.inset-0:visible').last();
      const root = await activeSurface.count() ? activeSurface : page.locator("body");
      const snapshot = await capture(page, stage, directory, root, page.url(), true);
      snapshots.push(snapshot);
      // The checked state at every stage is preserved by capture() before any
      // reversible probing below changes it.
      if (stage === "product" || stage === "checkout") {
        // Checkout is probed too: a decline confirmation shown only after
        // unchecking a preselected paid option is otherwise never observed.
        const toggles = await observePaidOptionChanges(page, root, stage);
        interactions.push(...toggles);
        const revealed = toggles.flatMap(({ revealedText }) => revealedText ?? []);
        if (revealed.length) snapshot.textLines = [...(snapshot.textLines ?? []), ...revealed];
      }
      await onStage(snapshot);
    }, purchasePath, onSurfacePhase);
    const journey = await Promise.race([
      journeyPromise,
      new Promise<never>((_, reject) => { journeyTimer = setTimeout(() => reject(new Error(`동적 구매 흐름 시간 초과(${journeyTimeoutMs}ms)`)), journeyTimeoutMs); }),
    ]).catch((error: unknown) => {
      journeyFailure = error instanceof Error ? error.message : "동적 구매 흐름이 제한 시간 안에 끝나지 않았습니다.";
      return { observations: [], network: [], surfaceDestinations: [], surfaceObservations: [], reached: "product" as const, blocker: { stage: "product" as const, code: "ACTION_FAILED" as const, action: purchasePath === "DIRECT" ? "DIRECT_BUY" as const : "ADD_TO_CART" as const, candidateCount: 0 } };
    });
    if (journeyTimer) clearTimeout(journeyTimer);
    interactions.push(...journey.observations.map(({ action }) => action));
    // Start whole-shop discovery after the safe purchase journey has exposed
    // client-rendered product/category/surface routes. Crawling before this
    // point only sees the framework shell on some SPA storefronts.
    const initialCrawlUrls = new Set([target.href, ...journey.surfaceDestinations.map(({ href }) => href)]);
    await onCrawlProgress?.({
      visited: 0, discovered: initialCrawlUrls.size, pending: initialCrawlUrls.size, currentUrl: target.href,
      uniqueVisitedUrls: 0, uniqueDiscoveredUrls: initialCrawlUrls.size,
    });
    let siteCrawl: SiteCrawlResult;
    try {
      siteCrawl = await crawlShopSite(page, target.href, credentials, onCrawlProgress, {
        seedUrls: journey.surfaceDestinations.map(({ href }) => href),
      });
    } catch (error) {
      const reason = error instanceof Error ? `${error.name}: ${error.message.slice(0, 240)}` : "SITE_CRAWL_FAILED";
      siteCrawl = {
        complete: false, pages: [], skippedLinks: [], unexploredControls: [], nonNavigatingControls: [], skippedControls: [], pendingUrls: [target.href],
        discoveredUrlCount: 1, visitedUrlCount: 0, discoveredStateCount: 1, visitedStateCount: 0,
        uniqueDiscoveredUrlCount: 1, uniqueVisitedUrlCount: 0, productCardCount: 0, failedUrlCount: 0, maxDepth: 0,
        durationMs: 0, duplicateStates: [], loginReplayed: false, stopReason: reason,
      };
    }
    if (preAuthenticationPage) {
      const alreadyVisitedUrl = siteCrawl.pages.some(({ url }) => url === preAuthenticationPage?.url);
      siteCrawl = {
        ...siteCrawl,
        pages: [preAuthenticationPage, ...siteCrawl.pages],
        discoveredUrlCount: siteCrawl.discoveredUrlCount + 1,
        visitedUrlCount: siteCrawl.visitedUrlCount + 1,
        discoveredStateCount: siteCrawl.discoveredStateCount + 1,
        visitedStateCount: siteCrawl.visitedStateCount + 1,
        uniqueDiscoveredUrlCount: siteCrawl.uniqueDiscoveredUrlCount + (alreadyVisitedUrl ? 0 : 1),
        uniqueVisitedUrlCount: siteCrawl.uniqueVisitedUrlCount + (alreadyVisitedUrl ? 0 : 1),
      };
    }
    const surfaceFromCrawl = siteCrawl.pages.flatMap((item) => {
      const routeAndText = `${item.url} ${item.title} ${item.text}`;
      const kinds = classifyCrawledSurfaceKinds(routeAndText);
      return kinds.map((kind) => ({
        evidenceId: `${item.evidenceId}:${kind.toLowerCase()}`, kind, url: item.url, status: item.status,
        title: item.title, text: item.text.slice(0, 2_000), source: "LINK" as const,
        outcome: item.outcome === "OBSERVED" ? "OBSERVED" as const : "FETCH_FAILED" as const,
      }));
    });
    const skippedSurfaceObservations = siteCrawl.skippedLinks.flatMap((item, index) => {
      const value = `${item.url} ${item.reason}`;
      const kind: DiagnosticSurfaceKind | undefined = /(?:cancel|unsubscribe|withdraw|refund|해지|탈퇴|환불|취소|반품)/i.test(value) ? "CANCELLATION"
        : /(?:subscription|membership|구독|멤버십)/i.test(value) ? "SUBSCRIPTION"
        : /(?:login|register|signup|join|로그인|회원가입)/i.test(value) ? "AUTH"
        : /(?:coupon|promo|쿠폰|프로모션)/i.test(value) ? "COUPON"
        : /(?:review|recommend|popular|후기|리뷰|추천|인기)/i.test(value) ? "RECOMMENDATION"
        : /(?:policy|shipping|delivery|exchange|return|약관|정책|배송|교환|반품)/i.test(value) ? "POLICY"
        : /(?:catalog|category|product|goods|item|search|상품|카테고리|검색)/i.test(value) ? "CATALOG" : undefined;
      return kind ? [{
        evidenceId: `site-link:${index}:${kind.toLowerCase()}`, kind, url: item.url, status: null,
        title: "크롤링 중 안전상 열지 않은 내부 경로", text: `경로를 발견했지만 실행하지 않았습니다 (${item.reason}).`,
        source: "LINK" as const, outcome: "DISCOVERED" as const,
      }] : [];
    });
    const surfaceObservations = [
      ...landingObservations,
      ...(authenticationObservation ? [authenticationObservation] : []),
      ...journey.surfaceObservations,
      ...surfaceFromCrawl,
      ...skippedSurfaceObservations,
    ].filter((item, index, items) => items.findIndex((candidate) => candidate.evidenceId === item.evidenceId) === index);
    for (const surface of diagnosticSurfaceKinds) {
      const observations = surfaceObservations.filter((item) => item.kind === surface);
      const observed = observations.some((item) => item.outcome === "OBSERVED");
      const discovered = observations.some((item) => item.outcome === "DISCOVERED");
      const blocked = observations.length > 0 && !observed && !discovered;
      await onSurfacePhase?.(surface, observed ? "COVERED" : discovered ? "DISCOVERED" : blocked ? "BLOCKED" : "NOT_FOUND", {
        reason: observed ? undefined : discovered ? "화면 후보를 찾았지만 검사 가능한 내부 화면에 도달하지 못했습니다." : blocked ? "접근이 제한되거나 화면을 읽지 못했습니다." : "현재 페이지와 탐색 후보에서 영역을 찾지 못했습니다.",
        evidenceIds: observations.map(({ evidenceId }) => evidenceId),
      });
    }
    // Put typed rule questions first: AI payloads are bounded, so generic
    // screen notes must not crowd out the eight contextual rule candidates.
    const reviewCandidates = [...collectRuleReviewCandidates({ snapshots, surfaces: surfaceObservations, crawlPages: siteCrawl.pages, interactions }), ...collectReviewCandidates(snapshots), ...collectSurfaceReviewCandidates(surfaceObservations), ...collectCrawlRuleCandidates(siteCrawl.pages), ...collectExplorationReviewCandidate(journey.blocker ?? null)].slice(0, 40);
    const findings = [...detect(snapshots, firstPriceExposure?.feeMentions, interactions, firstPriceExposure),
      ...detectInitialConsentPreselection(siteCrawl.pages), ...detectForcedAction(journey.blocker ?? null, snapshots)];
    const authContext = authenticatedWithTestAccount ? "TEST_ACCOUNT" as const : "ANONYMOUS" as const;
    const ruleCoverage = buildRuleCoverage({ findings, snapshots, surfaceObservations, siteCrawlPages: siteCrawl.pages, reviewCandidates, authContext, firstPriceExposure });
    const report = {
      comparisonVersion: scanComparisonVersion,
      scanStatus: dynamicScanStatus(journey.reached, journey.blocker ?? null, siteCrawl.complete),
      executionMode: "DYNAMIC" as const, viewport, purchasePath, scenario: "public" as const, targetUrl, authContext, snapshots, interactions,
      explorationBlocker: journey.blocker ?? null,
      surfaceDestinations: journey.surfaceDestinations,
      surfaceObservations,
      siteCrawl,
      stageTimingsMs: { ...stageTimingsMs, total: Date.now() - stageStartedAt },
      explorationMetrics: {
        productLinksFound,
        productLinksConsidered,
        productLinksUnselected: Math.max(0, productLinksFound - productLinksConsidered),
        productLinksVisited,
        surfaceCandidates: journey.surfaceDestinations.length,
        surfaceCandidatesInspected: journey.surfaceObservations.length,
        surfaceCandidatesUninspected: Math.max(0, journey.surfaceDestinations.length - journey.surfaceObservations.length),
        purchaseActions: journey.observations.length,
        priceResponses: journey.network.length,
      },
      networkPriceEvidence: journey.network,
      priceLedger: buildPriceLedger(snapshots, journey.network, firstPriceExposure),
      reviewCandidates,
      reviewClassifications: classifyReviewCandidates(reviewCandidates),
      aiUsage: summarizeAiUsage([]),
      findings, ruleCoverage, collectionFailure: journeyFailure, collectionFailureCode: journeyFailure ? classifyDynamicFailure(journeyFailure) : null,
    };
    await writeFile(join(directory, "report.json"), JSON.stringify(report, null, 2) + "\n");
    return report;
  } finally {
    await context.close();
  }
}
