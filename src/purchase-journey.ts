import type { Locator, Page, Response } from "playwright";
import type { Stage } from "./demo";
import type { InteractionEvidence, NetworkPriceEvidence } from "./rules";
import type { ScanPhaseStatus } from "./scan-phases";

// Do not treat the header's plain "장바구니" navigation as an add action.
// An add candidate must express adding/putting an item into the cart.
const addCart = /(?:(?:장바구니|카트)\s*(?:담기|추가)|(?:상품을?\s*)?담기|add\s+to\s+(?:cart|bag|basket))/i;
const openCart = /^(?:(?:내|쇼핑|my|shopping)\s*)?(?:장바구니|카트|cart|bag|basket)(?:\s*(?:보기|열기|가기))?(?:\s*(?:\(\s*\d+\s*\)|\d+\s*(?:개|items?)?))?\s*$/i;
const checkout = /(?:주문서|주문|구매|결제|checkout|proceed\s+to\s+checkout)/i;
// Keep the candidate count visible to the blocker logic: a storefront may have
// several product-card purchase buttons, so we must not guess which item to buy.
const directBuy = /(?:바로\s*구매|즉시\s*구매|특가\s*구매|구매하기|주문하기|buy\s+now|order\s+now)/i;
const priceKey = /(?:^|_)(?:total|subtotal|price|amount|shipping|delivery|fee|discount)(?:_|$)/i;

function extractPrices(value: unknown, path = "$", depth = 0): { path: string; won: number }[] {
  if (depth > 6 || value === null) return [];
  if (Array.isArray(value)) return value.slice(0, 50).flatMap((item, index) => extractPrices(item, `${path}[${index}]`, depth + 1));
  if (typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).slice(0, 100).flatMap(([key, item]) => {
    const next = `${path}.${key}`;
    if (priceKey.test(key) && (typeof item === "number" || typeof item === "string")) {
      const number = Number(String(item).replaceAll(",", ""));
      if (Number.isFinite(number) && number >= 0 && number <= 1_000_000_000) return [{ path: next, won: number }];
    }
    return extractPrices(item, next, depth + 1);
  });
}

export async function priceEvidence(response: Response, stage: Stage): Promise<NetworkPriceEvidence | null> {
  const type = response.headers()["content-type"] ?? "";
  if (!/^application\/(?:[\w.+-]*\+)?json\b/i.test(type) || !response.ok()) return null;
  const length = Number(response.headers()["content-length"] ?? 0);
  if (length > 256_000) return null;
  const body = await response.json().catch(() => null);
  const values = extractPrices(body);
  if (!values.length) return null;
  return { id: `network:${stage}:${Date.now()}`, stage, url: response.url(), capturedAt: new Date().toISOString(), values };
}

async function actionCandidate(page: Page, pattern: RegExp) {
  if (pattern === directBuy) {
    const activeSurface = page.locator('[role="dialog"]:visible, [aria-modal="true"]:visible, div.fixed.inset-0:visible').last();
    if (await activeSurface.count()) {
      const detailCta = activeSurface.getByRole("button", { name: directBuy })
        .or(activeSurface.getByRole("link", { name: directBuy }))
        .filter({ visible: true });
      if (await detailCta.count() === 1) return { action: detailCta.first(), count: 1 };
    }
  }
  // Prefer the explicit product-detail CTA when card-level "담기" buttons
  // remain mounted behind an in-place detail view.
  if (pattern === addCart) {
    const exact = page.getByRole("button", { name: /장바구니\s*담기|add\s*to\s*(?:cart|bag|basket)/i })
      .or(page.getByRole("link", { name: /장바구니\s*담기|add\s*to\s*(?:cart|bag|basket)/i }))
      .filter({ visible: true });
    if (await exact.count() > 0) return { action: exact.last(), count: 1 };
    const detail = page.locator('button:visible, a:visible').filter({
      hasText: /장바구니\s*담기|add\s*to\s*(?:cart|bag|basket)/i,
    });
    if (await detail.count() === 1) return { action: detail.first(), count: 1 };
  }
  if (pattern === checkout) {
    // Header links such as "주문/배송조회" also contain 주문, but they do
    // not advance the current cart. Prefer the unambiguous cart CTA instead.
    const orderCta = page.getByRole("button", { name: /(?:주문하기|결제하기|checkout|proceed\s+to\s+checkout)/i })
      .or(page.getByRole("link", { name: /(?:주문하기|결제하기|checkout|proceed\s+to\s+checkout)/i }))
      .filter({ visible: true });
    if (await orderCta.count() === 1) return { action: orderCta.first(), count: 1 };
  }
  const candidates = page.getByRole("button", { name: pattern })
    .or(page.getByRole("link", { name: pattern }))
    .filter({ visible: true });
  const roleCount = await candidates.count();
  const inputs = page.locator('input[type="submit"], input[type="button"]');
  const matchingInputIndexes: number[] = [];
  for (let index = 0; roleCount === 0 && index < await inputs.count(); index++) {
    const input = inputs.nth(index);
    if (!await input.isVisible().catch(() => false)) continue;
    const name = (await input.getAttribute("value") ?? "") + " " + (await input.getAttribute("aria-label") ?? "");
    if (pattern.test(name)) matchingInputIndexes.push(index);
  }
  const count = roleCount + matchingInputIndexes.length;
  if (count !== 1) return { action: null, count };
  return roleCount === 1
    ? { action: candidates.first(), count }
    : { action: inputs.nth(matchingInputIndexes[0]), count };
}

async function prepareRequiredOptions(page: Page, stage: Stage): Promise<InteractionEvidence[]> {
  const evidence: InteractionEvidence[] = [];
  // A number of storefronts mark mandatory options visually ("*" or
  // "필수") without emitting the HTML required attribute. Inspect only
  // visible selects with an empty placeholder and a nearby mandatory marker;
  // optional selectors remain untouched.
  const selects = page.locator("select:visible");
  for (let index = 0; index < Math.min(await selects.count(), 12); index++) {
    const select = selects.nth(index);
    const nearbyText = await select.evaluate((node) => {
      const parent = node.parentElement;
      return [parent?.innerText, parent?.parentElement?.innerText].filter(Boolean).join(" ");
    }).catch(() => "");
    const mandatory = await select.getAttribute("required") !== null ||
      /(?:필수|required|\*)/i.test(nearbyText);
    if (!mandatory) continue;
    if (await select.isDisabled() || await select.inputValue()) continue;
    const option = await select.locator("option:not([disabled])").evaluateAll((items) => items
      .map((item) => ({ value: (item as HTMLOptionElement).value, text: item.textContent?.trim() ?? "" }))
      .find((item) => item.value && !/^(?:선택|choose|select)/i.test(item.text)) ?? null);
    if (!option) continue;
    const label = await select.evaluate((node: HTMLSelectElement) =>
      Array.from(node.labels ?? [], (item) => item.innerText.trim()).join(" ") || node.name || "필수 선택");
    await select.selectOption(option.value);
    evidence.push({
      id: `${stage}:required-select:${index}`, stage, kind: "REQUIRED_OPTION_SELECTION",
      capturedAt: new Date().toISOString(), controlLabel: label, beforeSelected: false, afterSelected: true, outcome: "OBSERVED",
    });
  }
  const radios = page.locator('input[type="radio"][required]:visible');
  const handled = new Set<string>();
  for (let index = 0; index < Math.min(await radios.count(), 20); index++) {
    const radio = radios.nth(index);
    const name = await radio.getAttribute("name") ?? `radio-${index}`;
    if (handled.has(name)) continue;
    handled.add(name);
    const group = page.locator(`input[type="radio"][required][name=${JSON.stringify(name)}]`);
    if (await group.evaluateAll((items) => items.some((item) => (item as HTMLInputElement).checked))) continue;
    const choice = group.filter({ visible: true }).first();
    if (!await choice.count() || await choice.isDisabled()) continue;
    const label = await choice.evaluate((node: HTMLInputElement) =>
      Array.from(node.labels ?? [], (item) => item.innerText.trim()).join(" ") || node.value || "필수 선택");
    await choice.check();
    evidence.push({
      id: `${stage}:required-radio:${name}`, stage, kind: "REQUIRED_OPTION_SELECTION",
      capturedAt: new Date().toISOString(), controlLabel: label, beforeSelected: false, afterSelected: true, outcome: "OBSERVED",
    });
  }
  return evidence;
}

async function clickAndSettle(page: Page, action: Locator) {
  const before = page.url();
  const beforeText = await page.locator("body").innerText().catch(() => "");
  await action.click();
  // React storefronts commonly update drawers/modals without navigation.
  // Wait for an actual URL/text change instead of sleeping after every click.
  const changed = await page.waitForFunction(({ url, text }) => location.href !== url || (document.body?.innerText ?? "") !== text,
    { url: before, text: beforeText }, { timeout: 1_200 }).then(() => true).catch(() => false);
  if (changed && page.url() !== before) await page.waitForLoadState("domcontentloaded", { timeout: 1_500 }).catch(() => {});
}

/** Close a blocking modal only when its visible dialog exposes one unambiguous
 * dismiss control. Never press arbitrary overlays or marketing actions. */
async function dismissBlockingDialog(page: Page) {
  const dialogs = page.locator('[role="dialog"]:visible, [aria-modal="true"]:visible, div.fixed.inset-0:visible');
  for (let index = 0; index < Math.min(await dialogs.count(), 3); index++) {
    const dialog = dialogs.nth(index);
    const close = dialog.locator('button:visible, [role="button"]:visible, a:visible')
      .filter({ hasText: /닫기|close|취소|나중에|다음에|건너뛰기|skip|dismiss|×|\bX\b/i })
      .or(dialog.locator('button[aria-label*="닫" i]:visible, button[aria-label*="close" i]:visible, button[title*="닫" i]:visible, button[title*="close" i]:visible, button:has(svg.lucide-x):visible'));
    if (await close.count() !== 1) continue;
    await close.click({ timeout: 3_000 }).catch(() => undefined);
    await page.waitForTimeout(150);
  }
}

async function isCheckoutLike(page: Page) {
  const url = page.url();
  if (/(?:checkout|order|payment|buy)/i.test(new URL(url).pathname)) return true;
  const text = await page.locator("body").innerText().catch(() => "");
  const hasCheckoutCopy = /(?:주문\s*(?:서|결제서|정보)|결제\s*(?:정보|승인)|최종\s*결제\s*금액|배송\s*정보|checkout|payment|place\s+order)/i.test(text);
  const hasCustomerForm = await page.locator('input:not([type="hidden"]), select, textarea').count() > 0;
  return hasCheckoutCopy && hasCustomerForm;
}

async function isCartLike(page: Page) {
  const path = new URL(page.url()).pathname;
  const text = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ");
  if (/(?:장바구니|카트|cart|bag|basket)\s*(?:\(|:)?\s*0\b|(?:장바구니|카트).{0,12}(?:비어|없습니다)|(?:cart|bag|basket).{0,12}(?:empty|no items)/i.test(text)) return false;
  const heading = page.getByRole("heading", { name: /장바구니|카트|cart|bag|basket/i }).filter({ visible: true });
  const surface = /(?:cart|bag|basket)/i.test(path) || await heading.count() > 0;
  if (!surface) return false;
  const checkoutAction = page.getByRole("button", { name: checkout })
    .or(page.getByRole("link", { name: checkout })).filter({ visible: true });
  return await checkoutAction.count() > 0 || /(?:소계|합계|총\s*상품|수량|삭제|subtotal|total|quantity|remove)/i.test(text);
}

async function discoverSurfaceDestinations(page: Page) {
  const origin = new URL(page.url()).origin;
  const links = await page.locator("a[href]").evaluateAll((anchors, expectedOrigin) => anchors.flatMap((anchor) => {
    const text = (anchor.textContent ?? anchor.getAttribute("aria-label") ?? "").replace(/\s+/g, " ").trim();
    const raw = anchor.getAttribute("href") ?? "";
    if (!text || !raw) return [];
    try {
      const parsed = new URL(raw, window.location.href);
      if (parsed.origin !== expectedOrigin || !/^https?:$/.test(parsed.protocol)) return [];
      parsed.hash = "";
      const hints = `${text} ${parsed.pathname} ${parsed.search}`;
      const kind = /로그인|회원가입|sign\s*in|log\s*in|account|sign-?up/i.test(text) || /(?:^|\/)(?:login|signin|signup|account|my-?page)(?:\/|$)/i.test(parsed.pathname) ? "AUTH"
        : /구독\s*(?:해지|취소)|해지|탈퇴|환불|cancel|unsubscribe|withdrawal|account.?delet/i.test(hints) ? "CANCELLATION"
          : /구독|멤버십|정기\s*결제|자동\s*(?:갱신|연장)|subscription|membership|recurring|auto-?renew/i.test(hints) ? "SUBSCRIPTION"
            : /쿠폰|할인코드|프로모션|coupon|promo|discount|event/i.test(hints) ? "COUPON"
              : /추천|인기|베스트|후기|리뷰|recommend|popular|best|review|rating/i.test(hints) ? "RECOMMENDATION"
                : /배송|교환|반품|환불|이용약관|개인정보|policy|shipping|delivery|return|exchange|terms|privacy/i.test(hints) ? "POLICY"
                  : /카테고리|상품목록|전체상품|category|catalog|shop\s*all|collection|search/i.test(hints) ? "CATALOG" : null;
      return kind ? [{ kind, text, href: parsed.href, source: "LINK" as const }] : [];
    } catch { return []; }
  }), origin);
  const buttons = await page.locator("button:visible, [role=button]:visible").evaluateAll((controls) => controls.flatMap((control) => {
    const text = (control.textContent ?? control.getAttribute("aria-label") ?? control.getAttribute("title") ?? "").replace(/\s+/g, " ").trim();
    if (!text) return [];
    const kind = /로그인|회원가입|sign\s*in|log\s*in|account|sign-?up/i.test(text) ? "AUTH"
      : /구독\s*(?:해지|취소)|해지|탈퇴|환불|cancel|unsubscribe/i.test(text) ? "CANCELLATION"
      : /구독|멤버십|정기\s*결제|자동\s*(?:갱신|연장)|subscription|membership/i.test(text) ? "SUBSCRIPTION"
        : /쿠폰|할인코드|프로모션|coupon|promo/i.test(text) ? "COUPON"
          : /추천|인기|베스트|후기|리뷰|recommend|popular|best|review/i.test(text) ? "RECOMMENDATION"
            : /배송|교환|반품|환불|이용약관|개인정보|policy|shipping|return|exchange|terms|privacy/i.test(text) ? "POLICY"
              : /카테고리|상품목록|전체상품|전체\s*보기|검색|가구|키친|패브릭|테크|향\/|category|catalog|shop\s*all|search/i.test(text) ? "CATALOG" : null;
    return kind ? [{ kind, text, href: window.location.href, source: "BUTTON" as const }] : [];
  }));
  return [...links, ...buttons];
}

export type SurfaceObservation = {
  evidenceId: string;
  kind: "AUTH" | "SUBSCRIPTION" | "CANCELLATION" | "COUPON" | "RECOMMENDATION" | "POLICY" | "CATALOG";
  url: string;
  status: number | null;
  title: string;
  text: string;
  source?: "LINK" | "BUTTON";
  outcome: "OBSERVED" | "DISCOVERED" | "FETCH_FAILED" | "CROSS_ORIGIN";
};

async function inspectSurfaceDestinations(page: Page, destinations: { kind: SurfaceObservation["kind"]; href: string; text?: string; source?: SurfaceObservation["source"] }[]): Promise<SurfaceObservation[]> {
  const origin = new URL(page.url()).origin;
  const inspectOne = async (destination: typeof destinations[number], index: number): Promise<SurfaceObservation> => {
    const token = encodeURIComponent(destination.text?.replace(/\s+/g, " ").trim() || new URL(destination.href).pathname).slice(0, 36);
    const evidenceId = `surface:${destination.kind.toLowerCase()}:${index}:${token}`;
    if (destination.source === "BUTTON") {
      const safeReadOnlyControl = destination.kind === "CATALOG" || destination.kind === "RECOMMENDATION" || destination.kind === "POLICY";
      if (!safeReadOnlyControl || !destination.text) return { evidenceId, kind: destination.kind, url: destination.href, status: null, title: destination.text ?? "", text: `버튼형 표면 후보: ${destination.text ?? "이름 없음"}`, source: "BUTTON", outcome: "DISCOVERED" };
      const probe = await page.context().newPage();
      try {
        const response = await probe.goto(destination.href, { waitUntil: "domcontentloaded", timeout: 3_500 });
        if (!response?.ok()) return { evidenceId, kind: destination.kind, url: destination.href, status: response?.status() ?? null, title: destination.text, text: "버튼이 있는 화면을 다시 불러오지 못했습니다.", source: "BUTTON", outcome: "FETCH_FAILED" };
        await waitForDomQuiet(probe);
        const exactText = destination.text.replace(/\s+/g, " ").trim();
        const control = probe.getByRole("button", { name: exactText, exact: true }).or(probe.getByRole("link", { name: exactText, exact: true }));
        if (await control.count() !== 1 || await control.locator("xpath=ancestor::form").count()) {
          return { evidenceId, kind: destination.kind, url: destination.href, status: response.status(), title: exactText, text: `안전한 단일 읽기 동작으로 확정하지 못했습니다: ${exactText}`, source: "BUTTON", outcome: "DISCOVERED" };
        }
        const beforeUrl = probe.url();
        const beforeText = await probe.locator("body").innerText().catch(() => "");
        const beforeState = await control.evaluate((node) => `${node.className}|${node.getAttribute("aria-selected")}|${node.getAttribute("aria-pressed")}|${node.getAttribute("data-state")}`).catch(() => "");
        await control.click({ timeout: 2_000 });
        const changed = await probe.waitForFunction(({ url, text, label, state }) => {
          const target = [...document.querySelectorAll("button,[role=button],a")].find((node) => (node.textContent ?? "").replace(/\s+/g, " ").trim() === label);
          const nextState = target ? `${(target as HTMLElement).className}|${target.getAttribute("aria-selected")}|${target.getAttribute("aria-pressed")}|${target.getAttribute("data-state")}` : "";
          return location.href !== url || (document.body?.innerText ?? "") !== text || (state !== "" && nextState !== state);
        }, { url: beforeUrl, text: beforeText, label: exactText, state: beforeState }, { timeout: 1_000 }).then(() => true).catch(() => false);
        const url = probe.url();
        const text = (await probe.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 1_000);
        return {
          evidenceId, kind: destination.kind, url, status: response.status(), title: await probe.title().catch(() => exactText),
          text: changed ? text : `안전하게 눌렀지만 화면 변화가 확인되지 않았습니다: ${exactText}`,
          source: "BUTTON", outcome: changed ? "OBSERVED" : "DISCOVERED",
        };
      } catch {
        return { evidenceId, kind: destination.kind, url: destination.href, status: null, title: destination.text, text: `읽기 전용 화면을 열지 못했습니다: ${destination.text}`, source: "BUTTON", outcome: "FETCH_FAILED" };
      } finally {
        await probe.close().catch(() => {});
      }
    }
    if (new URL(destination.href).origin !== origin) {
      return { evidenceId: `surface:${destination.kind.toLowerCase()}:${index}`, kind: destination.kind, url: destination.href, status: null, title: "", text: "", source: "LINK", outcome: "CROSS_ORIGIN" };
    }
    const route = new URL(destination.href);
    if (/(?:^|\/)(?:logout|signout|unsubscribe|cancel|delete|withdraw)(?:\/|$)/i.test(route.pathname)) {
      return {
        evidenceId: `surface:${destination.kind.toLowerCase()}:${index}`, kind: destination.kind,
        url: destination.href, status: null, title: destination.text ?? "",
        text: "계정·구독 상태를 바꿀 수 있는 경로라 열지 않았습니다. 경로만 발견했습니다.",
        source: "LINK", outcome: "DISCOVERED",
      };
    }
    const probe = await page.context().newPage();
    try {
      const response = await probe.goto(destination.href, { waitUntil: "domcontentloaded", timeout: 3_500 });
      if (response?.ok()) await waitForDomQuiet(probe);
      return {
        evidenceId: `surface:${destination.kind.toLowerCase()}:${index}`, kind: destination.kind, url: destination.href, status: response?.status() ?? null, source: "LINK",
        title: await probe.title().catch(() => ""),
        text: (await probe.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 1_000),
        outcome: response?.ok() ? "OBSERVED" : "FETCH_FAILED",
      };
    } catch {
      return { evidenceId: `surface:${destination.kind.toLowerCase()}:${index}`, kind: destination.kind, url: destination.href, status: null, title: "", text: "", source: "LINK", outcome: "FETCH_FAILED" };
    } finally {
      await probe.close().catch(() => {});
    }
  };
  const results: SurfaceObservation[] = [];
  // Keep browser resource use bounded while checking more than one candidate
  // when a surface exposes several distinct routes.
  for (let offset = 0; offset < Math.min(destinations.length, 28); offset += 4) {
    results.push(...await Promise.all(destinations.slice(offset, offset + 4).map((item, index) => inspectOne(item, offset + index))));
  }
  return results;
}

export async function waitForDomQuiet(page: Page, quietMs = 100, maxMs = 700) {
  await page.evaluate(`new Promise(resolve => {
    let quietTimer;
    let maxTimer;
    const observer = new MutationObserver(() => { clearTimeout(quietTimer); quietTimer = setTimeout(finish, ${quietMs}); });
    const finish = () => { observer.disconnect(); clearTimeout(quietTimer); clearTimeout(maxTimer); resolve(); };
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
    quietTimer = setTimeout(finish, ${quietMs});
    maxTimer = setTimeout(finish, ${maxMs});
  })`);
}

export type JourneyObservation = {
  stage: Stage;
  url: string;
  action: InteractionEvidence;
};

export type JourneyBlocker = {
  stage: Stage;
  code: "ACTION_NOT_FOUND" | "ACTION_AMBIGUOUS" | "ACTION_FAILED" | "LOGIN_REQUIRED";
  action: "ADD_TO_CART" | "OPEN_CHECKOUT" | "DIRECT_BUY";
  candidateCount: number;
};

async function missingActionBlocker(page: Page, count: number, action: JourneyBlocker["action"]): Promise<JourneyBlocker> {
  const passwordVisible = await page.locator('input[type="password"]:visible').count() > 0;
  const bodyText = await page.locator("body").innerText().catch(() => "");
  const barrierText = await page.locator('[role="dialog"]:visible, [aria-modal="true"]:visible, div.fixed.inset-0:visible')
    .allInnerTexts().then((items) => items.join(" ")).catch(() => "");
  const loginCopy = /(?:로그인|회원가입|sign\s*in|log\s*in|account\s+required|please\s+sign)/i;
  const login = passwordVisible || loginCopy.test(barrierText)
    || (!count && loginCopy.test(bodyText) && /(?:구매|주문|계속|purchase|checkout|continue)/i.test(bodyText));
  return { stage: action === "OPEN_CHECKOUT" ? "cart" : "product", code: login ? "LOGIN_REQUIRED" : count ? "ACTION_AMBIGUOUS" : "ACTION_NOT_FOUND", action, candidateCount: count };
}

/** Explore only as far as the checkout form. It never clicks a final-order action. */
export async function explorePurchaseJourney(
  page: Page, onStage?: (stage: Stage) => Promise<void>, purchasePath: "CART" | "DIRECT" = "CART",
  onSurfacePhase?: (surface: SurfaceObservation["kind"], status: ScanPhaseStatus, details?: { reason?: string; evidenceIds?: string[] }) => Promise<void>,
) {
  let stage: Stage = "product";
  const observations: JourneyObservation[] = [];
  const network: NetworkPriceEvidence[] = [];
  let surfaceDestinations: Awaited<ReturnType<typeof discoverSurfaceDestinations>> = [];
  let surfaceObservations: SurfaceObservation[] = [];
  const refreshSurface = async () => {
    const discovered = await discoverSurfaceDestinations(page);
    const known = new Set(surfaceDestinations.map(({ href, kind, text }) => `${kind}:${href}:${text}`));
    const fresh = discovered.filter(({ href, kind, text }) => !known.has(`${kind}:${href}:${text}`));
    surfaceDestinations = [...surfaceDestinations, ...fresh].slice(0, 64);
    if (fresh.length) {
      // Inspect additional distinct routes when a first candidate has not
      // produced readable evidence. Catalog, recommendation and policy areas
      // get a larger sample because they can contain multiple independent pages.
      const perKindBudget: Record<SurfaceObservation["kind"], number> = {
        CATALOG: 8, RECOMMENDATION: 5, POLICY: 5, AUTH: 3, COUPON: 3, SUBSCRIPTION: 3, CANCELLATION: 3,
      };
      const existingCounts = new Map<SurfaceObservation["kind"], number>();
      for (const item of surfaceObservations) existingCounts.set(item.kind, (existingCounts.get(item.kind) ?? 0) + 1);
      const selectedCounts = new Map<SurfaceObservation["kind"], number>();
      const toInspect = fresh.filter(({ kind }) => {
        const typedKind = kind as SurfaceObservation["kind"];
        const total = (existingCounts.get(typedKind) ?? 0) + (selectedCounts.get(typedKind) ?? 0);
        if (total >= perKindBudget[typedKind]) return false;
        selectedCounts.set(typedKind, (selectedCounts.get(typedKind) ?? 0) + 1);
        return true;
      });
      const freshKinds = [...new Set(toInspect.map(({ kind }) => kind as SurfaceObservation["kind"]))];
      for (const kind of freshKinds) {
        if (!surfaceObservations.some((item) => item.kind === kind && item.outcome === "OBSERVED")) {
          await onSurfacePhase?.(kind, "RUNNING");
        }
      }
      const inspected = await inspectSurfaceDestinations(page, toInspect.map(({ kind, href, text, source }) => ({ kind: kind as SurfaceObservation["kind"], href, text, source })));
      surfaceObservations = [...surfaceObservations, ...inspected].slice(0, 64);
      for (const kind of freshKinds) {
        const items = surfaceObservations.filter((item) => item.kind === kind);
        const observed = items.some((item) => item.outcome === "OBSERVED");
        const discovered = items.some((item) => item.outcome === "DISCOVERED");
        const blocked = items.some((item) => item.outcome === "FETCH_FAILED" || item.outcome === "CROSS_ORIGIN");
        await onSurfacePhase?.(kind, observed ? "COVERED" : discovered ? "DISCOVERED" : blocked ? "BLOCKED" : "NOT_FOUND", {
          reason: observed ? undefined : discovered ? "버튼형 영역을 발견했지만 안전한 내부 화면 확인은 하지 않았습니다." : blocked ? "발견한 경로에 접근할 수 없어 내용을 확인하지 못했습니다." : "후보 화면을 확인하지 못했습니다.",
          evidenceIds: items.map(({ evidenceId }) => evidenceId),
        });
      }
    }
  };
  await refreshSurface();
  const pending = new Set<Promise<void>>();
  page.on("response", (response) => {
    if (new URL(response.url()).origin !== new URL(page.url()).origin) return;
    const task = priceEvidence(response, stage).then((item) => { if (item) network.push(item); });
    pending.add(task);
    void task.finally(() => pending.delete(task));
  });
  await onStage?.(stage);
  observations.push(...(await prepareRequiredOptions(page, stage)).map((action) => ({ stage, url: page.url(), action })));

  if (purchasePath === "DIRECT") {
    const direct = await actionCandidate(page, directBuy);
    if (!direct.action) return {
      observations, network, surfaceDestinations, surfaceObservations, reached: stage,
    blocker: await missingActionBlocker(page, direct.count, "DIRECT_BUY"),
    };
    const before = page.url();
    try { await clickAndSettle(page, direct.action); } catch {
      return { observations, network, surfaceDestinations, surfaceObservations, reached: stage,
        blocker: { stage, code: "ACTION_FAILED", action: "DIRECT_BUY", candidateCount: 1 } satisfies JourneyBlocker };
    }
    observations.push({ stage, url: before, action: {
      id: "product:direct-buy", stage, kind: "NAVIGATION", capturedAt: new Date().toISOString(), outcome: "OBSERVED",
    }});
    if (!await isCheckoutLike(page)) return { observations, network, surfaceDestinations, surfaceObservations, reached: "product" as Stage,
      blocker: { stage: "product", code: "ACTION_FAILED", action: "DIRECT_BUY", candidateCount: 1 } satisfies JourneyBlocker };
    stage = "checkout";
    await refreshSurface();
    await onStage?.(stage);
    await Promise.allSettled([...pending]);
    return { observations, network, surfaceDestinations, surfaceObservations, reached: stage };
  }

  const add = await actionCandidate(page, addCart);
  if (!add.action) {
    const cartGap = await missingActionBlocker(page, add.count, "ADD_TO_CART");
    // A shop may genuinely provide only direct purchase. Preserve the missing
    // cart route as an explicit coverage gap, but continue through one
    // unambiguous direct-buy action so checkout evidence is still collected.
    const fallback = await actionCandidate(page, directBuy);
    if (!fallback.action) return {
      observations, network, surfaceDestinations, surfaceObservations, reached: stage, blocker: cartGap,
    };
    const directUrl = page.url();
    try { await clickAndSettle(page, fallback.action); } catch {
      return { observations, network, surfaceDestinations, surfaceObservations, reached: stage, blocker: cartGap };
    }
    observations.push({ stage, url: directUrl, action: {
      id: "product:direct-buy-fallback", stage, kind: "NAVIGATION", capturedAt: new Date().toISOString(), outcome: "OBSERVED",
    }});
    if (!await isCheckoutLike(page)) return {
      observations, network, surfaceDestinations, surfaceObservations, reached: stage, blocker: cartGap,
    };
    stage = "checkout";
    await refreshSurface();
    await onStage?.(stage);
    await Promise.allSettled([...pending]);
    return { observations, network, surfaceDestinations, surfaceObservations, reached: stage, blocker: cartGap };
  }
  const before = page.url();
  try { await clickAndSettle(page, add.action); } catch {
    return { observations, network, surfaceDestinations, surfaceObservations, reached: stage,
      blocker: { stage, code: "ACTION_FAILED", action: "ADD_TO_CART", candidateCount: 1 } satisfies JourneyBlocker };
  }
  observations.push({ stage, url: before, action: {
    id: "product:add-cart", stage, kind: "NAVIGATION", capturedAt: new Date().toISOString(), outcome: "OBSERVED",
  }});

  if (!await isCartLike(page)) {
    const cartAction = await actionCandidate(page, openCart);
    if (cartAction.action) {
      await dismissBlockingDialog(page);
      await clickAndSettle(page, cartAction.action);
    }
  }
  if (!await isCartLike(page)) return {
    observations, network, surfaceDestinations, surfaceObservations, reached: "product" as Stage,
    blocker: { stage: "product" as Stage, code: "ACTION_FAILED" as const, action: "ADD_TO_CART" as const, candidateCount: 1 },
  };
  stage = "cart";
  await refreshSurface();
  await onStage?.(stage);

  const next = await actionCandidate(page, checkout);
  if (!next.action) return {
    observations, network, surfaceDestinations, surfaceObservations, reached: stage,
    blocker: await missingActionBlocker(page, next.count, "OPEN_CHECKOUT"),
  };
  const cartUrl = page.url();
  try { await clickAndSettle(page, next.action); } catch {
    return { observations, network, surfaceDestinations, surfaceObservations, reached: stage,
      blocker: { stage, code: "ACTION_FAILED", action: "OPEN_CHECKOUT", candidateCount: 1 } satisfies JourneyBlocker };
  }
  observations.push({ stage, url: cartUrl, action: {
    id: "cart:open-checkout", stage, kind: "NAVIGATION", capturedAt: new Date().toISOString(), outcome: "OBSERVED",
  }});
  if (!await isCheckoutLike(page)) return { observations, network, surfaceDestinations, surfaceObservations, reached: "cart" as Stage,
    blocker: { stage: "cart" as Stage, code: "ACTION_FAILED" as const, action: "OPEN_CHECKOUT" as const, candidateCount: 1 } };
  stage = "checkout";
  await refreshSurface();
  await onStage?.(stage);
  await Promise.allSettled([...pending]);
  return { observations, network, surfaceDestinations, surfaceObservations, reached: stage };
}
