import { scanComparisonVersion } from "./scan-comparison";
import { buildPriceLedger } from "./price-ledger";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type Browser, type Locator, type Page } from "playwright";
import { stages, type Scenario, type Stage } from "./demo";
import { isVariantOptionLabel, mandatoryFeeFromText, paidOptionFromText } from "./price-text";
import { detect, type Snapshot } from "./rules";
import { observePaidOptionChanges } from "./journey-evidence";
import { collectReviewCandidates, collectRuleReviewCandidates } from "./review-candidates";

export async function capture(page: Page, stage: Stage, directory: string, main: Locator, url = page.url(), fullPage = true): Promise<Snapshot> {
  await main.waitFor({ state: "visible" });

  const optionSelector = [
    'input:is([type="checkbox"], [type="radio"])',
    'select',
    '[role="switch"]',
    '[role="checkbox"]',
    '[role="radio"]',
  ].join(", ");
  const optionControls = await main.locator(optionSelector).evaluateAll((nodes) =>
    nodes.filter((node) => node.checkVisibility({ opacityProperty: true, visibilityProperty: true })).flatMap<{
      label: string; amount?: string; selected: boolean; kind: "CHECKBOX" | "RADIO" | "SELECT" | "SWITCH";
      bounds: { x: number; y: number; width: number; height: number };
      location: { frame: string; visible: boolean; source: "dom" };
    }>((node) => {
      const control = node as HTMLElement;
      const { x, y, width, height } = control.getBoundingClientRect();
      const bounds = { x: x + window.scrollX, y: y + window.scrollY, width, height };
      if (control instanceof HTMLSelectElement) {
        return Array.from(control.options)
          .filter((option) => option.selected || option.dataset.optionWon !== undefined)
          .map((option) => ({
            label: option.label.trim(), amount: option.dataset.optionWon, selected: option.selected, kind: "SELECT" as const, bounds,
            location: { frame: "main", visible: true, source: "dom" as const },
          }));
      }
      const native = control instanceof HTMLInputElement;
      const labelledBy = (control.getAttribute("aria-labelledby") ?? "").split(/\s+/).filter(Boolean)
        .map((id) => document.getElementById(id)?.innerText.trim() ?? "").filter(Boolean).join(" ");
      const nativeLabel = native ? Array.from(control.labels ?? [], (item) => item.innerText.trim()).join(" ") : "";
      const label = native
        ? nativeLabel || control.getAttribute("aria-label") || ""
        : control.getAttribute("aria-label") || labelledBy || control.closest("label")?.innerText.trim() || control.innerText.trim();
      return [{
        label,
        amount: control.dataset.optionWon,
        selected: native ? control.checked : control.getAttribute("aria-checked") === "true",
        kind: native ? control.type.toUpperCase() as "CHECKBOX" | "RADIO"
          : control.getAttribute("role")?.toUpperCase() === "CHECKBOX" ? "CHECKBOX"
            : control.getAttribute("role")?.toUpperCase() === "RADIO" ? "RADIO" : "SWITCH" as const,
        location: { frame: "main", visible: true, source: "dom" as const },
        bounds,
      }];
    }),
  );
  const options = optionControls.flatMap(({ amount, ...control }) => {
    if (isVariantOptionLabel(control.label)) return [];
    const won = amount === undefined ? paidOptionFromText(control.label) : Number(amount);
    return won === null || !Number.isFinite(won) ? [] : [{ ...control, won }];
  });
  const choiceControls = optionControls.map(({ label, amount, selected, kind }) => ({
    label: label.replace(/\s+/g, " ").trim(), selected, kind,
    ...(amount === undefined ? {} : { amount: Number(amount) }),
  }));
  const structuredFees = await main.locator("[data-fee-id]").evaluateAll((nodes) =>
    nodes.filter((node) => node.checkVisibility({ opacityProperty: true, visibilityProperty: true })).map((node) => {
      const row = node as HTMLElement;
      const { x, y, width, height } = row.getBoundingClientRect();
      return {
        id: row.dataset.feeId!,
        label: row.innerText.trim(),
        won: Number(row.dataset.won),
        required: row.dataset.required === "true",
        location: { frame: "main", visible: true, source: "dom" as const },
        bounds: { x: x + window.scrollX, y: y + window.scrollY, width, height },
      };
    }),
  );
  const feeRows = await main.locator("div, p, li, tr, dd").evaluateAll((nodes) =>
    nodes.filter((node) =>
      !node.closest("[data-fee-id]") && !node.querySelector("[data-fee-id], div, p, li, tr, dd") &&
      node.checkVisibility({ opacityProperty: true, visibilityProperty: true }),
    ).map((node) => {
      const row = node as HTMLElement;
      const { x, y, width, height } = row.getBoundingClientRect();
      return { label: row.innerText.trim(), location: { frame: "main", visible: true, source: "dom" as const }, bounds: { x: x + window.scrollX, y: y + window.scrollY, width, height } };
    }),
  );
  const structuredKeys = new Set(structuredFees.flatMap((fee) => {
    const parsed = mandatoryFeeFromText(fee.label);
    return parsed ? [parsed.key] : [];
  }));
  const textFees = feeRows.flatMap((row) => {
    const parsed = mandatoryFeeFromText(row.label);
    return !parsed || structuredKeys.has(parsed.key) ? [] : [{
      ...row, id: "text:" + parsed.key, won: parsed.won, required: true,
    }];
  });
  const fees = [...structuredFees, ...textFees];
  const displayedPrices = await main.locator('[aria-label="가격 내역"] li, [data-total]').allInnerTexts();
  // Some storefronts render totals without a dedicated price attribute. Keep
  // normalized visible price lines as evidence, while leaving rule decisions to
  // structured fields and the price ledger.
  const bodyText = await main.innerText().catch(() => "");
  const textLines = bodyText.split(/\n+/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 300);
  const cartCountMatch = bodyText.match(/(?:장바구니|카트|cart|bag|basket)\s*[(:：]?\s*(\d+)\s*(?:개|items?)?\s*\)?/i);
  const cartItemCount = cartCountMatch ? Number(cartCountMatch[1]) : undefined;
  const requestedQuantity = stage === "product" ? await main.evaluate((root) => {
    const values = [...root.querySelectorAll('input[type="number"], input[role="spinbutton"], [role="spinbutton"]')]
      .filter((node) => (node as HTMLElement).checkVisibility()).map((node) => {
      const control = node as HTMLInputElement;
      const raw = control.value || control.getAttribute("aria-valuenow") || "";
      const value = Number(raw);
      return Number.isInteger(value) && value > 0 ? value : null;
    }).filter((value): value is number => value !== null);
    if (values.length === 1) return values[0];
    const buttons = [...root.querySelectorAll("button")].filter((node) => {
      const button = node as HTMLButtonElement;
      return button.checkVisibility() && /^(?:\+|−|-)$/u.test(button.innerText.trim());
    });
    for (const decrement of buttons.filter((button) => /^(?:−|-)$/u.test(button.innerText.trim()))) {
      const group = decrement.parentElement;
      if (!group || !buttons.some((button) => /^(?:\+)$/u.test(button.innerText.trim()) && button.parentElement === group)) continue;
      const numbers = [...group.querySelectorAll("span, output, [aria-live]")]
        .filter((node) => node.checkVisibility()).map((node) => node.textContent?.trim() ?? "")
        .filter((value) => /^\d+$/.test(value)).map(Number).filter((value) => Number.isInteger(value) && value > 0);
      if (numbers.length === 1) return numbers[0];
    }
    return undefined;
  },) : undefined;
  const productIdentity = stage === "product" ? await main.evaluate((root, sourceUrl) => {
    const ids = [...root.querySelectorAll("[data-product-id], [data-sku], [itemprop='sku']")]
      .map((node) => node.getAttribute("data-product-id") ?? node.getAttribute("data-sku") ?? node.getAttribute("content") ?? node.textContent ?? "")
      .map((value) => value.replace(/\s+/g, " ").trim()).filter(Boolean);
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 1) return `item:${uniqueIds[0]}`;
    const route = new URL(sourceUrl);
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
    if (canonical) {
      const canonicalUrl = new URL(canonical, route);
      if (canonicalUrl.origin === route.origin && canonicalUrl.pathname !== "/") return `url:${canonicalUrl.pathname.replace(/\/$/, "")}`;
    }
    const names = [...root.querySelectorAll("[itemprop='name'], [data-product-name], h1, h2, h3, h4, [role='heading']")]
      .filter((element) => {
        const style = getComputedStyle(element);
        return (element as HTMLElement).checkVisibility() && style.visibility !== "hidden" && style.display !== "none";
      }).map((node) => (node.getAttribute("content") ?? node.getAttribute("data-product-name") ?? node.textContent ?? "").replace(/\s+/g, " ").trim())
      .filter((name) => name.length >= 2 && name.length <= 180 && !/^(?:상품\s*상세|product\s*details?)$/i.test(name));
    const uniqueNames = [...new Set(names.map((value) => value.normalize("NFKC").toLocaleLowerCase()
      .replace(/[\p{P}\p{S}\s]+/gu, " ").trim().slice(0, 180)).filter(Boolean))];
    if (uniqueNames.length === 1) return `name:${uniqueNames[0]}`;
    return `url:${route.pathname.replace(/\/$/, "") || "/"}`;
  }, url) : undefined;
  const cartLines = stage === "cart" ? await main.evaluate((root) => {
    const selectors = "[data-cart-item], [data-product-id], [data-sku], [data-testid*='cart-item' i], [data-testid*='cart-product' i], [role='row'], tr, [class*='cart-item' i], [class*='cart-row' i], [class*='line-item' i], [class*='product-item' i]";
    const panelTitles = [...root.querySelectorAll("*")].filter((node) => {
      if (!(node as HTMLElement).checkVisibility({ opacityProperty: true, visibilityProperty: true }) || node.children.length || node.textContent!.trim().length > 80) return false;
      return /(?:장바구니|쇼핑백|카트|cart|basket|shopping\s*bag)/i.test(node.textContent ?? "");
    });
    let cartPanel: Element | null = null;
    for (const title of panelTitles) {
      for (let ancestor = title.parentElement; ancestor && root.contains(ancestor); ancestor = ancestor.parentElement) {
        const text = ancestor.innerText ?? "";
        const hasPrice = /(?:[₩$£€]\s*\d[\d,.]*|\d[\d,.]*\s*원)/.test(text);
        const controls = [...ancestor.querySelectorAll("input, select, button, [role='spinbutton']")]
          .filter((node) => (node as HTMLElement).checkVisibility({ opacityProperty: true, visibilityProperty: true }));
        const hasQuantity = controls.some((node) => node.matches('input[type="number"], input[role="spinbutton"], select, [role="spinbutton"]')
          || /(?:수량|quantity|increase|decrease)/i.test(`${node.getAttribute("aria-label") ?? ""} ${node.getAttribute("title") ?? ""}`))
          || controls.filter((node) => /^(?:\+|−|-)$/u.test(node.textContent?.trim() ?? "")).length >= 2;
        const hasItemName = ancestor.querySelector("[itemprop='name'], [data-product-name], h1, h2, h3, h4");
        if (hasPrice && hasQuantity && hasItemName && (!cartPanel || text.length < (cartPanel.textContent?.length ?? Infinity))) {
          cartPanel = ancestor;
          break;
        }
        if (ancestor === root) break;
      }
    }
    const scope = cartPanel ?? root;
    const rows = [...scope.querySelectorAll(selectors)].filter((node) => (node as HTMLElement).checkVisibility({ opacityProperty: true, visibilityProperty: true }));
    const identities = rows.map((row) => {
      const id = row.getAttribute("data-product-id") ?? row.getAttribute("data-sku")
        ?? row.querySelector("[data-product-id], [data-sku], [itemprop='sku']")?.getAttribute("data-product-id")
        ?? row.querySelector("[data-product-id], [data-sku], [itemprop='sku']")?.getAttribute("data-sku")
        ?? row.querySelector("[itemprop='sku']")?.getAttribute("content");
      if (id?.trim()) return `item:${id.trim()}`;
      const anchor = row.matches("a[href]") ? row as HTMLAnchorElement : row.querySelector("a[href]");
      if (anchor) {
        try {
          const route = new URL((anchor as HTMLAnchorElement).href, window.location.href);
          if (route.origin === window.location.origin && route.pathname !== "/") return `url:${route.pathname.replace(/\/$/, "")}`;
        } catch { /* Use a visible item name only when no stable same-site path exists. */ }
      }
      const nameNode = row.querySelector("[itemprop='name'], [data-product-name], [class*='product-name' i], [class*='goods-name' i], [class*='item-name' i], h1, h2, h3, h4");
      const imageAlt = row.querySelector("img[alt]")?.getAttribute("alt") ?? "";
      const name = (nameNode?.getAttribute("content") ?? nameNode?.getAttribute("data-product-name") ?? nameNode?.textContent ?? imageAlt).replace(/\s+/g, " ").trim();
      const normalized = name.normalize("NFKC").toLocaleLowerCase().replace(/[\p{P}\p{S}\s]+/gu, " ").trim().slice(0, 180);
      return normalized.length >= 2 ? `name:${normalized}` : null;
    });
    const headings = [...scope.querySelectorAll("[itemprop='name'], [data-product-name], h1, h2, h3, h4")]
      .filter((node) => (node as HTMLElement).checkVisibility({ opacityProperty: true, visibilityProperty: true }))
      .filter((node) => !/(?:장바구니|쇼핑백|카트|cart|basket|shopping\s*bag)/i.test(node.textContent ?? ""));
    const inferredRows = headings.map((heading) => {
      let line: Element | null = null;
      for (let ancestor = heading.parentElement; ancestor && scope.contains(ancestor); ancestor = ancestor.parentElement) {
        const text = ancestor.textContent ?? "";
        const hasPrice = /(?:[₩$£€]\s*\d[\d,.]*|\d[\d,.]*\s*원)/.test(text);
        const controls = [...ancestor.querySelectorAll("input, select, button, [role='spinbutton']")]
          .filter((node) => (node as HTMLElement).checkVisibility({ opacityProperty: true, visibilityProperty: true }));
        const hasQuantity = controls.some((node) => node.matches('input[type="number"], input[role="spinbutton"], select, [role="spinbutton"]')
          || /(?:수량|quantity|increase|decrease)/i.test(`${node.getAttribute("aria-label") ?? ""} ${node.getAttribute("title") ?? ""}`))
          || controls.filter((node) => /^(?:\+|−|-)$/u.test(node.textContent?.trim() ?? "")).length >= 2;
        if (hasPrice && hasQuantity) { line = ancestor; break; }
        if (ancestor === scope) break;
      }
      if (!line) return null;
      const value = (heading.getAttribute("content") ?? heading.getAttribute("data-product-name") ?? heading.textContent ?? "")
        .replace(/\s+/g, " ").trim();
      const normalized = value.normalize("NFKC").toLocaleLowerCase().replace(/[\p{P}\p{S}\s]+/gu, " ").trim().slice(0, 180);
      return normalized.length >= 2 ? `name:${normalized}` : null;
    });
    const completeInferredRows = headings.length > 0 && inferredRows.length === headings.length && inferredRows.every(Boolean);
    if (!rows.length && completeInferredRows) identities.push(...inferredRows);
    const unique = [...new Set(identities.filter((identity): identity is string => Boolean(identity)))];
    return { identities: unique, complete: rows.length > 0 ? identities.every(Boolean) : completeInferredRows };
  }) : undefined;
  const textPrices = textLines.filter((line) =>
    /(?:[₩$£€]\s*\d[\d,.]*|\d[\d,.]*\s*원)/.test(line),
  ).slice(0, 100);
  const priceLines = [...new Set([...displayedPrices, ...textPrices, ...textFees.map(({ label }) => label)])];
  const payableCandidates = await main.locator("span, p, strong, b, button").evaluateAll((nodes) => {
    const amounts = new Set<number>();
    for (const node of nodes) {
      const element = node as HTMLElement;
      if (element.children.length || !element.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const value = element.innerText.replace(/\s+/g, " ").trim();
      if (/배송|포장|수수료|이용료|정상가|정가|할인 전|원래 가격/i.test(value)) continue;
      if (element.closest("s, del, strike")) continue;
      let crossedOut = false;
      for (let ancestor: Element | null = element; ancestor && ancestor !== element.ownerDocument.body; ancestor = ancestor.parentElement) {
        if (getComputedStyle(ancestor).textDecorationLine.includes("line-through")) { crossedOut = true; break; }
      }
      if (crossedOut) continue;
      const match = value.match(/^([₩]?\s*\d[\d,]*)\s*원(?:\s*(?:안전\s*)?(?:결제|주문)하기)?$/);
      if (!match) continue;
      const amount = Number(match[1].replace(/[^\d]/g, ""));
      if (Number.isSafeInteger(amount) && amount > 0) amounts.add(amount);
    }
    return [...amounts];
  });
  const payableAmount = payableCandidates.length === 1 ? payableCandidates[0] : undefined;
  const precheckedSignals = await main.locator('input[type="checkbox"]:checked, [role="checkbox"][aria-checked="true"], [role="switch"][aria-checked="true"]').evaluateAll((nodes) => nodes.flatMap((node) => {
    const control = node as HTMLElement;
    const labelledBy = (control.getAttribute("aria-labelledby") ?? "").split(/\s+/).filter(Boolean)
      .map((id) => document.getElementById(id)?.innerText.trim() ?? "").filter(Boolean).join(" ");
    const nativeLabel = control instanceof HTMLInputElement ? Array.from(control.labels ?? [], (item) => item.innerText.trim()).join(" ") : "";
    const label = control instanceof HTMLInputElement
      ? nativeLabel || control.getAttribute("aria-label") || ""
      : control.getAttribute("aria-label") || labelledBy || control.innerText.trim();
    if (!/(?:마케팅|광고|정보\s*수신|자동\s*연장|자동\s*결제|멤버십|newsletter|marketing|auto.?renew)/i.test(label)) return [];
    const { x, y, width, height } = control.getBoundingClientRect();
    return [{ label, bounds: { x: x + window.scrollX, y: y + window.scrollY, width, height }, location: { frame: "main", visible: true, source: "dom" as const } }];
  }));
  const decisionControls = await main.locator('button:visible, a:visible, [role="button"]:visible, input[type="checkbox"]:visible, input[type="radio"]:visible, [role="checkbox"]:visible, [role="radio"]:visible').evaluateAll((nodes) => nodes.slice(0, 120).flatMap((node) => {
    const control = node as HTMLElement;
    const native = control instanceof HTMLInputElement;
    const role = native ? control.type.toUpperCase() : control.matches('a') ? "LINK" : control.getAttribute("role")?.toUpperCase() ?? "BUTTON";
    const kind: "BUTTON" | "LINK" | "CHECKBOX" | "RADIO" = role === "CHECKBOX" ? "CHECKBOX"
      : role === "RADIO" ? "RADIO" : role === "LINK" ? "LINK" : "BUTTON";
    const label = (native ? Array.from(control.labels ?? [], (item) => item.innerText.trim()).join(" ")
      : control.getAttribute("aria-label") ?? control.getAttribute("title") ?? control.innerText)
      .replace(/\s+/g, " ").trim().slice(0, 240);
    if (!label) return [];
    const { x, y, width, height } = control.getBoundingClientRect();
    const style = window.getComputedStyle(control);
    const groupNode = control.closest("fieldset, [role='group'], [role='dialog'], form");
    const group = groupNode ? `${groupNode.tagName.toLowerCase()}:${Array.from(document.querySelectorAll("fieldset, [role='group'], [role='dialog'], form")).indexOf(groupNode)}` : undefined;
    const href = control instanceof HTMLAnchorElement ? control.href : undefined;
    const selected = native ? control.checked : control.getAttribute("aria-checked") === "true";
    return [{ label, kind, bounds: { x: x + window.scrollX, y: y + window.scrollY, width, height },
      color: style.color, backgroundColor: style.backgroundColor, opacity: Number(style.opacity), tabIndex: control.tabIndex, ...(group ? { group } : {}),
      ...(kind === "CHECKBOX" || kind === "RADIO" ? { selected } : {}), ...(href ? { href } : {}) }];
  }));
  const surfaceSignals = await main.locator('a, button, [role="button"], label, [role="dialog"]').evaluateAll((nodes) => {
    const signals: { kind: "AUTH" | "SUBSCRIPTION" | "CANCELLATION" | "MARKETING_CONSENT" | "POPUP"; label: string; source: "link" | "button" | "text"; href?: string }[] = [];
    for (const node of nodes) {
      if (!(node as HTMLElement).checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const label = (node.textContent ?? node.getAttribute("aria-label") ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
      if (!label) continue;
      const source = node.matches("a") ? "link" : node.matches("button, [role=button]") ? "button" : "text";
      const rawHref = node.matches("a") ? (node.getAttribute("href") ?? "") : "";
      let href: string | undefined;
      try {
        const parsed = rawHref ? new URL(rawHref, window.location.href) : null;
        href = parsed && parsed.origin === window.location.origin ? parsed.href : undefined;
      } catch { href = undefined; }
      const kind = /로그인|회원가입|sign\s*in|log\s*in|account/i.test(label) ? "AUTH"
        : /구독|멤버십|정기\s*결제|자동\s*(?:갱신|연장)|subscription|membership/i.test(label) ? "SUBSCRIPTION"
        : /해지|탈퇴|환불|구독\s*취소|cancel|unsubscribe/i.test(label) ? "CANCELLATION"
        : /마케팅|광고성|정보\s*수신|newsletter|marketing/i.test(label) ? "MARKETING_CONSENT"
        : /팝업|모달|닫기|오늘\s*하루|popup|modal/i.test(label) ? "POPUP" : null;
      if (kind && !signals.some((item) => item.kind === kind && item.label === label && item.href === href)) signals.push({ kind, label, source, href });
      if (signals.length >= 80) break;
    }
    return signals;
  });
  const screenshot = stage + ".png";
  const origin = fullPage ? { x: 0, y: 0 } : await page.evaluate(() => ({ x: scrollX, y: scrollY }));
  const sensitiveFields = page.locator([
    'input[type="password"]', 'input[type="email"]', 'input[type="tel"]',
    'input[autocomplete*="email" i]', 'input[autocomplete*="tel" i]',
    'input[autocomplete*="street" i]', 'input[autocomplete*="postal" i]',
    'textarea',
  ].join(", "));
  const png = await page.screenshot({
    path: join(directory, screenshot), fullPage, scale: "css",
    mask: [sensitiveFields], maskColor: "#111827",
  });
  // PNG IHDR stores the rendered width and height as unsigned big-endian integers.
  const screenshotArea = { ...origin, width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
  const capturedAt = new Date().toISOString();
  return { evidenceId: `evidence:${stage}`, stage, url, screenshot, screenshotArea, capturedAt, priceLines, payableAmount, payableCandidates, textLines, options, choiceControls, fees, precheckedSignals, surfaceSignals, decisionControls, cartItemCount, requestedQuantity, productIdentity,
    ...(cartLines ? { cartLineIdentities: cartLines.identities, cartLinesComplete: cartLines.complete } : {}),
    inspection: {
      visibleText: "COMPLETE", controls: "COMPLETE", choiceControls: choiceControls.every(({ label }) => label.length > 0) ? "COMPLETE" : "INCOMPLETE", prices: "COMPLETE", feeRows: "COMPLETE",
      cartCount: stage !== "cart" ? "NOT_APPLICABLE" : cartItemCount === undefined ? "UNAVAILABLE" : "OBSERVED",
    },
  };
}

export async function scanDemo(
  browser: Browser, origin: string, scenario: Scenario, directory: string,
  onStage?: (snapshot: Snapshot) => Promise<void>, viewport: "DESKTOP" | "MOBILE" = "DESKTOP",
  purchasePath: "CART" | "DIRECT" = "CART",
) {
  const base = new URL(origin);
  if (base.protocol !== "http:" || base.hostname !== "127.0.0.1" || base.href !== base.origin + "/") {
    throw new Error("데모는 http://127.0.0.1의 로컬 서버만 지원합니다.");
  }

  const path = "/demo/" + scenario + "/";
  const targetUrl = base.origin + path + "product";
  const selectedStages: Stage[] = purchasePath === "DIRECT" ? ["product", "checkout"] : [...stages];
  const routes = new Set<string>(selectedStages.map((stage) => path + stage));
  await mkdir(directory, { recursive: true });
  const mobile = viewport === "MOBILE";
  const contextOptions = {
    serviceWorkers: "block" as const, javaScriptEnabled: true, locale: "ko-KR", timezoneId: "Asia/Seoul",
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, acceptDownloads: false,
  };
  let context;
  try {
    context = await browser.newContext(contextOptions);
  } catch (error) {
    if (!/Target\.createBrowserContext|browser has been closed|Failed to create browser context/i.test(error instanceof Error ? error.message : "")) throw error;
    // Some macOS/container combinations close a headless browser while creating
    // an incognito context. Persistent context avoids that protocol call while
    // retaining the same isolated profile for this scan.
    context = await chromium.launchPersistentContext(join(directory, ".browser-profile"), {
      ...contextOptions, headless: true, args: ["--disable-dev-shm-usage"],
    });
  }
  try {
    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const isAsset = url.pathname.startsWith("/_next/static/");
      if (request.method() !== "GET" || url.origin !== base.origin ||
          !(request.isNavigationRequest() ? routes.has(url.pathname) : isAsset)) {
        await route.abort();
        return;
      }

      // Disable automatic redirect following so a redirect cannot escape the allowlist.
      const response = await route.fetch({ maxRedirects: 0, timeout: 10_000 }).catch(() => null);
      if (!response || (response.status() >= 300 && response.status() < 400)) {
        await route.abort();
        return;
      }
      // The page may navigate or the context may close while a late static asset
      // is being proxied. That request is no longer evidence-critical.
      await route.fulfill({ response }).catch(() => route.abort().catch(() => {}));
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    const snapshots: Snapshot[] = [];
    const interactions = [];
    for (const stage of selectedStages) {
      let snapshot: Snapshot;
      try {
        if (stage === "product") {
          const response = await page.goto(targetUrl);
          if (!response?.ok()) throw new Error("데모 상품 페이지를 불러오지 못했습니다.");
        } else if (stage === "cart") {
          await page.getByRole("button", { name: "장바구니에 담기", exact: true }).click();
        } else {
          await page.getByRole("link", { name: purchasePath === "DIRECT" ? "바로구매" : "주문서 보기", exact: true }).click();
        }
        const root = page.locator('main[data-stage="' + stage + '"]');
        snapshot = await capture(page, stage, directory, root);
        if (stage === "product" || stage === "checkout") {
          interactions.push(...await observePaidOptionChanges(page, root, stage));
        }
      } catch (error) {
        if (snapshots.length === 0) throw error;
        break;
      }
      snapshots.push(snapshot);
      await onStage?.(snapshot);
    }
    const report = {
      comparisonVersion: scanComparisonVersion,
      scanStatus: snapshots.length === selectedStages.length ? "COMPLETED" : "PARTIAL",
      executionMode: "DEMO" as const,
      authContext: "ANONYMOUS" as const,
      viewport,
      purchasePath,
      scenario,
      targetUrl,
      snapshots,
      interactions,
      priceLedger: buildPriceLedger(snapshots),
      reviewCandidates: [...collectRuleReviewCandidates({ snapshots, surfaces: [], crawlPages: [], interactions }), ...collectReviewCandidates(snapshots)],
      findings: detect(snapshots, [], interactions),
    } as const;
    await writeFile(join(directory, "report.json"), JSON.stringify(report, null, 2) + "\n");
    return report;
  } finally {
    await context.close();
  }
}
