import { createServer } from "node:http";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { decryptCredentials, encryptCredentials } from "../src/credential-vault";
import { buildAiCandidatePayload, restoreAiCandidateIds, toAiProviderCandidates } from "../src/ai-review-payload";

test("테스트 계정은 암호화된 일회성 값으로만 보관한다", () => {
  process.env.BAROMI_CREDENTIAL_KEY = Buffer.alloc(32, 7).toString("base64");
  const ciphertext = encryptCredentials({ username: "test-user", password: "secret-password" });
  expect(ciphertext).not.toContain("secret-password");
  expect(decryptCredentials(ciphertext)).toEqual({ username: "test-user", password: "secret-password" });
});

test("AI를 호출하지 않은 진단은 비용을 0으로 계측한다", async () => {
  const { summarizeAiUsage, estimateAiUsage, exceedsAiCostCap } = await import("../src/ai-cost");
  expect(summarizeAiUsage([])).toMatchObject({ calls: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 });
  expect(estimateAiUsage({ provider: "none", model: "none", purpose: "test", inputTokens: 1000, outputTokens: 500 })).toMatchObject({ estimatedCostUsd: 0 });
  expect(exceedsAiCostCap({ provider: "test", model: "test", purpose: "test", inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0.2 }, "0.1")).toBe(true);
  expect(exceedsAiCostCap({ provider: "test", model: "test", purpose: "test", inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0.2 }, "0.2")).toBe(false);
});

test("AI 후보 payload는 개인정보를 가리고 연결된 구매 증거만 제한해 전달한다", () => {
  const payload = buildAiCandidatePayload({
    reviewCandidates: [{ id: "c1", kind: "EXPLORATION_UNVERIFIED", stage: "surface", text: "문의 test@example.com", reason: "연락처 010-1234-5678", evidenceIds: ["e1", "missing"] }],
    snapshots: [{ evidenceId: "e1", stage: "product", url: "https://shop.test/p/1?token=secret", priceLines: Array.from({ length: 30 }, (_, i) => `${i}원`), options: Array.from({ length: 30 }, () => ({ label: "옵션" })), precheckedSignals: ["signal"], surfaceSignals: ["surface"] }],
  });
  expect(payload).toHaveLength(1);
  expect(payload[0].text).not.toContain("test@example.com");
  expect(payload[0].reason).not.toContain("010-1234-5678");
  expect(payload[0].evidence[0].priceLines).toHaveLength(20);
  expect(payload[0].evidence[0].options).toHaveLength(20);
  expect(payload[0].evidence).toHaveLength(1);
  expect(payload[0].evidence[0].url).toBe("https://shop.test/p/1");
});

test("AI 후보 payload는 크롤링·표면 근거를 연결하고 URL 쿼리와 개인정보를 제거한다", () => {
  const payload = buildAiCandidatePayload({
    reviewCandidates: [
      { id: "crawl", kind: "EXPLORATION_UNVERIFIED", stage: "surface", text: "04:45 특가 종료 test@example.com", reason: "타이머 문구", evidenceIds: ["crawl-1"] },
      { id: "surface", kind: "SURFACE_FLOW", stage: "surface", text: "로그인", reason: "인증 화면", evidenceIds: ["surface-1"] },
    ],
    siteCrawl: { pages: [{
      evidenceId: "crawl-1", url: "https://shop.test/promo?token=secret#top", discoveredFrom: null, depth: 1, statePath: [], status: 200, outcome: "OBSERVED",
      title: "특가 test@example.com", text: "04:45 특가 종료\n문의 010-1234-5678", linksFound: 0, controlsFound: [], productCardsFound: [],
      domText: [{ tag: "p", text: "04:45 특가 종료", visible: true, fontSize: "12px", color: "rgb(0,0,0)", opacity: "1", bounds: { x: 1, y: 2, width: 80, height: 20 } }],
      interactives: [{ tag: "input", label: "VIP 자동결제 동의", role: "", type: "checkbox", visible: true, disabled: false, selected: true }], formsFound: [], elementCount: 1, hiddenTextElementCount: 0,
      outgoingLinks: [], bodyTextLength: 40, anchorCount: 0, interactiveCount: 1, capturedAt: "2026-11-15T00:00:00Z",
    }] },
    surfaceObservations: [{ evidenceId: "surface-1", kind: "AUTH", url: "https://shop.test/login?email=user%40example.com", status: 200, title: "로그인", text: "로그인 test@example.com", source: "LINK", outcome: "OBSERVED" }],
  });
  expect(payload).toHaveLength(2);
  expect(payload[0].evidence[0]).toMatchObject({ source: "crawl_page", url: "https://shop.test/promo", outcome: "OBSERVED" });
  expect(payload[0].evidence[0].text).toContain("04:45 특가 종료");
  expect(payload[0].evidence[0].text).not.toContain("010-1234-5678");
  expect(payload[0].text).not.toContain("test@example.com");
  expect(payload[0].evidence[0].selectedControls).toContain("VIP 자동결제 동의");
  expect(payload[1].evidence[0]).toMatchObject({ source: "surface_observation", url: "https://shop.test/login", text: "로그인 [이메일 가림]" });
});

test("AI 공급자에는 내부 증거 ID를 보내지 않고 응답 후보를 원래 보고서에 연결한다", () => {
  const candidates = buildAiCandidatePayload({
    reviewCandidates: [{ id: "review:private@example.com", kind: "SURFACE_FLOW", stage: "surface", text: "로그인", reason: "검토", evidenceIds: ["surface:/member/private@example.com"] }],
    surfaceObservations: [{ evidenceId: "surface:/member/private@example.com", kind: "AUTH", url: "https://shop.test/member", status: 200, title: "로그인", text: "로그인", outcome: "OBSERVED" }],
  });
  const providerCandidates = toAiProviderCandidates(candidates);
  expect(JSON.stringify(providerCandidates)).not.toContain("private@example.com");
  expect(providerCandidates[0]).toMatchObject({ id: "candidate-1", evidence: [{ evidenceId: "evidence-1-1" }] });
  expect(restoreAiCandidateIds([{ candidateId: "candidate-1" }], candidates)).toEqual([{ candidateId: "review:private@example.com" }]);
});
import { scanDemo } from "../src/scan";
import { paidOptionFromText } from "../src/price-text";
import { detect } from "../src/rules";
import { buildRuleCoverage } from "../src/rule-coverage";
import { initialScanPhases, parseScanPhases, updateScanPhase } from "../src/scan-phases";

test("진단 단계 상태는 시작·종료 시간과 증거를 보존하고 바로구매의 장바구니는 건너뛴다", () => {
  const initial = initialScanPhases("DIRECT", true);
  expect(initial.cart?.status).toBe("SKIPPED");
  expect(initial["surface:CATALOG"]?.status).toBe("PENDING");
  expect(initial["site-crawl"]?.status).toBe("PENDING");
  const started = updateScanPhase(initial, "product", { status: "RUNNING" }, new Date("2026-11-15T00:00:00.000Z"));
  const finished = updateScanPhase(started, "product", { status: "COVERED", evidenceIds: ["e-product"] }, new Date("2026-11-15T00:00:02.500Z"));
  expect(finished.product).toMatchObject({ status: "COVERED", durationMs: 2500, evidenceIds: ["e-product"] });
  expect(parseScanPhases(JSON.stringify(finished))).toEqual(finished);
});

test("전체 크롤러는 사이트맵과 내부 링크를 큐가 빌 때까지 방문하고 위험 경로는 실행하지 않는다", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const requested: string[] = [];
  await context.route("https://shop.test/**", async (route) => {
    const url = new URL(route.request().url());
    requested.push(url.href);
    if (url.pathname === "/robots.txt") return route.fulfill({ contentType: "text/plain", body: "User-agent: *\nSitemap: https://shop.test/sitemap.xml" });
    if (url.pathname === "/sitemap.xml") return route.fulfill({ contentType: "application/xml", body: "<urlset><url><loc>https://shop.test/sitemap-product</loc></url></urlset>" });
    const pages: Record<string, string> = {
      "/start": '<h1>시작</h1><nav><button onclick="document.querySelector(\'#panel\').textContent=\'추천 탭 화면\'">추천</button></nav><div id="panel">기본 패널</div><a href="/category">카테고리</a><a href="/category?utm_source=x">중복 링크</a><a href="/cart">장바구니</a><a href="/checkout">주문서</a><a href="/payment">카드 결제</a><a href="/membership/cancel">해지</a><a href="/return-policy">취소 및 반품 유의사항 규정 확인하기</a><a href="https://outside.test/policy">외부</a>',
      "/": '<h1>쇼핑몰</h1><a href="/policy">배송 정책</a>',
      "/category": '<h1>상품 목록</h1><a href="/category?page=2">다음</a><a href="/coupon">쿠폰</a>',
      "/category?page=2": '<h1>상품 2페이지</h1><a href="/">홈</a>',
      "/policy": "<h1>배송 및 교환 정책</h1>",
      "/return-policy": "<h1>취소 및 반품 규정</h1>",
      "/coupon": "<h1>쿠폰 안내</h1>",
      "/cart": "<h1>장바구니 (비어 있음)</h1>",
      "/checkout": "<h1>주문서</h1>",
      "/sitemap-product": "<h1>상품 상세</h1>",
    };
    return route.fulfill({ contentType: "text/html; charset=utf-8", body: pages[url.pathname + url.search] ?? pages[url.pathname] ?? "<h1>없음</h1>" });
  });
  try {
    await page.goto("https://shop.test/start");
    const { crawlShopSite } = await import("../src/site-crawler");
    const result = await crawlShopSite(page, page.url(), undefined, undefined, { concurrency: 1, maxPages: 20, maxDurationMs: 45_000 });
    expect(result.complete, JSON.stringify({ stopReason: result.stopReason, durationMs: result.durationMs, pendingUrls: result.pendingUrls, unexploredControls: result.unexploredControls, failedUrlCount: result.failedUrlCount, pages: result.pages.map(({ url, statePath, failureReason }) => ({ url, statePath, failureReason })) })).toBe(true);
    expect(result.pages.map(({ url }) => new URL(url).pathname + new URL(url).search)).toEqual(expect.arrayContaining([
      "/start", "/", "/category", "/category?page=2", "/policy", "/return-policy", "/coupon", "/cart", "/checkout", "/sitemap-product",
    ]));
    expect(requested.some((url) => new URL(url).pathname === "/sitemap.xml")).toBe(true);
    expect(result.pages.some(({ url }) => new URL(url).pathname.endsWith("sitemap.xml"))).toBe(false);
    expect(result.pages).toEqual(expect.arrayContaining([expect.objectContaining({ url: "https://shop.test/start", statePath: ["추천"] })]));
    expect(new Set(result.pages.map(({ evidenceId }) => evidenceId)).size).toBe(result.pages.length);
    expect(result.pages.filter(({ url }) => url === "https://shop.test/start")).toHaveLength(2);
    expect(result.skippedLinks.map(({ reason }) => reason)).toEqual(expect.arrayContaining([
      "PURCHASE_FLOW_CHECKED_SEPARATELY", "STATE_CHANGE_URL_NOT_OPENED", "OUT_OF_SHOP_DOMAIN",
    ]));
    expect(requested.some((url) => /\/cart(?:\?|$)/.test(url))).toBe(true);
    expect(requested.some((url) => /\/checkout(?:\?|$)/.test(url))).toBe(true);
    expect(requested.some((url) => /\/payment(?:\?|$)/.test(url))).toBe(false);
    expect(requested.some((url) => /\/membership\/cancel/.test(url))).toBe(false);
    expect(requested.some((url) => /outside\.test/.test(url))).toBe(false);
  } finally {
    await context.close();
  }
});

test("전체 크롤러는 아이콘 메뉴를 열고 GET 검색 결과 경로도 읽는다", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await context.route("https://menu-search.test/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/robots.txt") return route.fulfill({ contentType: "text/plain", body: "" });
    if (url.pathname === "/search") return route.fulfill({ contentType: "text/html; charset=utf-8", body: `<h1>검색 결과</h1><p>검색어: ${url.searchParams.get("q") ?? "없음"}</p>` });
    return route.fulfill({ contentType: "text/html; charset=utf-8", body: `<!doctype html><meta charset="utf-8"><header><button type="button" aria-expanded="false" onclick="this.setAttribute('aria-expanded','true');document.querySelector('#menu').innerHTML='<a href=/coupon>쿠폰 안내</a>'"><svg aria-hidden="true"></svg></button></header><div id="menu"></div><form method="get" action="/search"><input type="search" name="q" placeholder="상품 검색"></form><main><h1>상품 목록</h1></main>` });
  });
  try {
    await page.goto("https://menu-search.test/");
    const { crawlShopSite } = await import("../src/site-crawler");
    const result = await crawlShopSite(page, page.url(), undefined, undefined, { concurrency: 1, maxPages: 20, maxDurationMs: 15_000 });
    expect(result.pages).toEqual(expect.arrayContaining([
      expect.objectContaining({ statePath: ["아이콘 메뉴 열기"] }),
      expect.objectContaining({ url: "https://menu-search.test/search?q=%EC%83%81%ED%92%88" }),
      expect.objectContaining({ url: "https://menu-search.test/coupon" }),
    ]));
  } finally {
    await context.close();
  }
});

test("robots.txt에 사이트맵 선언이 없어도 표준 sitemap.xml에서 고립된 내부 페이지를 발견한다", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await context.route("https://sitemap-fallback.test/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/robots.txt") return route.fulfill({ contentType: "text/plain", body: "User-agent: *" });
    if (url.pathname === "/sitemap.xml") return route.fulfill({ contentType: "application/xml", body: "<urlset><url><loc>https://sitemap-fallback.test/hidden-category</loc></url></urlset>" });
    if (url.pathname === "/hidden-category") return route.fulfill({ contentType: "text/html; charset=utf-8", body: "<h1>사이트맵 전용 상품 분류</h1>" });
    return route.fulfill({ contentType: "text/html; charset=utf-8", body: "<main><h1>상점 첫 화면</h1><p>분류 링크는 없는 화면입니다.</p></main>" });
  });
  try {
    await page.goto("https://sitemap-fallback.test/");
    const { crawlShopSite } = await import("../src/site-crawler");
    const result = await crawlShopSite(page, page.url(), undefined, undefined, { concurrency: 1, maxPages: 10, maxDurationMs: 10_000 });
    expect(result.pages.map(({ url }) => url)).toContain("https://sitemap-fallback.test/hidden-category");
    expect(result.complete).toBe(true);
  } finally {
    await context.close();
  }
});

test("앱 셸이 sitemap.xml 경로에 반환돼도 크롤링 실패 페이지로 세지 않는다", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await context.route("https://sitemap-fallback-html.test/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/robots.txt") return route.fulfill({ contentType: "text/plain", body: "User-agent: *" });
    if (url.pathname === "/sitemap.xml") return route.fulfill({ contentType: "text/html; charset=utf-8", body: "<!doctype html><html><body><main><h1>쇼핑몰</h1><script>const example = '<urlset><loc>/not-a-real-route</loc></urlset>';</script></main></body></html>" });
    return route.fulfill({ contentType: "text/html; charset=utf-8", body: "<main><h1>쇼핑몰 첫 화면</h1><p>사이트맵은 제공하지 않습니다.</p></main>" });
  });
  try {
    await page.goto("https://sitemap-fallback-html.test/");
    const { crawlShopSite } = await import("../src/site-crawler");
    const result = await crawlShopSite(page, page.url(), undefined, undefined, { concurrency: 1, maxPages: 10, maxDurationMs: 10_000 });
    expect(result.complete).toBe(true);
    expect(result.failedUrlCount).toBe(0);
    expect(result.pages.map(({ url }) => new URL(url).pathname)).toEqual(["/"]);
  } finally {
    await context.close();
  }
});

test("전체 크롤러는 안전한 내부 새 창 경로를 큐에 넣어 방문한다", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await context.route("https://popup-policy.test/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/robots.txt") return route.fulfill({ contentType: "text/plain", body: "" });
    if (url.pathname === "/policy") return route.fulfill({ contentType: "text/html; charset=utf-8", body: "<h1>배송 및 반품 정책</h1>" });
    return route.fulfill({ contentType: "text/html; charset=utf-8", body: `<!doctype html><html><body><nav><button type="button" onclick="window.open('/policy', '_blank')">배송 및 반품 정책</button></nav><main><h1>상품몰</h1></main></body></html>` });
  });
  try {
    await page.goto("https://popup-policy.test/");
    const { crawlShopSite } = await import("../src/site-crawler");
    const result = await crawlShopSite(page, page.url(), undefined, undefined, { concurrency: 1, maxPages: 10, maxDurationMs: 10_000 });
    expect(result.pages.map(({ url }) => url)).toContain("https://popup-policy.test/policy");
    expect(result.pages.find(({ url }) => url.endsWith("/policy"))?.text).toContain("배송 및 반품 정책");
    expect(result.unexploredControls).toEqual([]);
  } finally {
    await context.close();
  }
});

test("전체 크롤러는 현재 SPA 화면을 연 버튼을 다시 눌러 미완료 경로로 만들지 않는다", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await context.route("https://modal-policy.test/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/robots.txt") return route.fulfill({ contentType: "text/plain", body: "" });
    return route.fulfill({ contentType: "text/html; charset=utf-8", body: `<!doctype html><html><body>
      <nav><button type="button" onclick="document.querySelector('#policy').hidden=false">배송 및 반품 정책</button></nav>
      <main><h1>상품몰</h1></main>
      <section id="policy" hidden><h2>배송 및 반품 정책 안내</h2><button type="button" onclick="document.querySelector('#policy').hidden=true">배송 및 반품 정책</button></section>
    </body></html>` });
  });
  try {
    await page.goto("https://modal-policy.test/");
    const { crawlShopSite } = await import("../src/site-crawler");
    const result = await crawlShopSite(page, page.url(), undefined, undefined, { concurrency: 1, maxPages: 10, maxDurationMs: 10_000 });
    expect(result.pages).toEqual(expect.arrayContaining([
      expect.objectContaining({ statePath: ["배송 및 반품 정책"], text: expect.stringContaining("배송 및 반품 정책 안내") }),
    ]));
    expect(result.unexploredControls).toEqual([]);
    expect(result.complete).toBe(true);
  } finally {
    await context.close();
  }
});

test("전체 크롤러는 form이 없는 SPA 검색창에 상품 검색을 실행하고 결과 상태를 읽는다", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await context.route("https://spa-search.test/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/robots.txt") return route.fulfill({ contentType: "text/plain", body: "" });
    const body = String.raw`<!doctype html><html><body><header><input id="query" placeholder="상품 검색" onkeydown="if(event.key==='Enter')document.querySelector('#results').innerHTML='<h1>검색 결과</h1><p>검색어: '+this.value+'</p><article>검색 결과 상품</article>'"><main id="results"><h1>상품 목록</h1><p>오늘의 상품 목록입니다.</p></main></body></html>`;
    return route.fulfill({ contentType: "text/html; charset=utf-8", body });
  });
  try {
    await page.goto("https://spa-search.test/");
    await page.locator("#query").fill("상품");
    await page.locator("#query").press("Enter");
    await expect(page.locator("#results")).toContainText("검색어: 상품");
    await page.reload();
    const { crawlShopSite } = await import("../src/site-crawler");
    const result = await crawlShopSite(page, page.url(), undefined, undefined, { concurrency: 1, maxPages: 10, maxDurationMs: 10_000 });
    expect(result.pages, JSON.stringify({ nonNavigating: result.nonNavigatingControls, unexplored: result.unexploredControls })).toEqual(expect.arrayContaining([
      expect.objectContaining({ statePath: [expect.stringContaining("__SUBMIT_READ_ONLY_SEARCH__:")] }),
    ]));
    expect(result.pages.find(({ statePath }) => statePath.some((state) => state.startsWith("__SUBMIT_READ_ONLY_SEARCH__:")))?.text).toContain("검색어: 상품");
  } finally {
    await context.close();
  }
});

test("크롤 보고서는 주문 즉시 취소와 반품 컨트롤을 취소 영역으로 분류한다", async () => {
  const { classifyCrawledSurfaceKinds } = await import("../src/dynamic-public-scan");
  expect(classifyCrawledSurfaceKinds("주문/배송조회 · 주문 즉시 취소 · 원클릭 반품 신청")).toEqual(expect.arrayContaining(["CANCELLATION", "POLICY"]));
});

test("로그인 제출 전 화면은 크롤 증거로 남기고 계정정보는 가린다", async ({ page }) => {
  await page.setContent(`<main><h1>MEGA 로그인</h1><p>VIP 체험 후 자동 연장</p>
    <label><input type="checkbox" checked> 광고 수신에 동의</label>
    <label><input type="checkbox" checked> 무료 체험 익월 자동 결제 동의</label>
    <input name="email" value="private@example.com"><input type="password" value="secret-pass">
  </main>`);
  const { captureCurrentPageAsCrawlEvidence } = await import("../src/site-crawler");
  const evidence = await captureCurrentPageAsCrawlEvidence(page, {
    status: 200, secrets: ["private@example.com", "secret-pass"],
  });
  expect(evidence.statePath).toEqual(["로그인 화면 (인증 전)"]);
  expect(evidence.text).toContain("무료 체험 익월 자동 결제 동의");
  expect(evidence.text).not.toContain("private@example.com");
  expect(evidence.text).not.toContain("secret-pass");
  expect(evidence.interactives.filter(({ type, selected, label }) => type === "checkbox" && selected && /동의/.test(label))).toHaveLength(2);
});

test("페이지 예산에 도달하면 미방문 경로를 보존하고 전체 크롤링 완료로 표시하지 않는다", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await context.route("https://budget.test/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ contentType: "text/html", body: path === "/robots.txt" ? "" : `<a href="/a">a</a><a href="/b">b</a><a href="/c">c</a>` });
  });
  try {
    await page.goto("https://budget.test/");
    const { crawlShopSite } = await import("../src/site-crawler");
    const result = await crawlShopSite(page, page.url(), undefined, undefined, { concurrency: 1, maxPages: 1, maxDurationMs: 5_000 });
    expect(result.complete).toBe(false);
    expect(result.stopReason).toBe("PAGE_BUDGET_REACHED");
    expect(result.pendingUrls.length).toBeGreaterThan(0);
  } finally {
    await context.close();
  }
});

test("같은 이름의 다음 화면 동작도 서로 다른 카테고리에서 각각 탐색한다", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await context.route("https://category-scope.test/**", async (route) => {
    const url = new URL(route.request().url());
    const bodies: Record<string, string> = {
      "/robots.txt": "",
      "/": '<h1>쇼핑몰</h1><a href="/category-a">분류 A</a><a href="/category-b">분류 B</a>',
      "/category-a": '<h1>분류 A</h1><nav><button onclick="location.href=\'/category-a/page-2\'">다음</button></nav>',
      "/category-b": '<h1>분류 B</h1><nav><button onclick="location.href=\'/category-b/page-2\'">다음</button></nav>',
      "/category-a/page-2": "<h1>분류 A 다음 페이지</h1>",
      "/category-b/page-2": "<h1>분류 B 다음 페이지</h1>",
    };
    return route.fulfill({ contentType: "text/html; charset=utf-8", body: bodies[url.pathname] ?? "<h1>없는 화면</h1>" });
  });
  try {
    await page.goto("https://category-scope.test/");
    const { crawlShopSite } = await import("../src/site-crawler");
    const result = await crawlShopSite(page, page.url(), undefined, undefined, { concurrency: 1, maxPages: 30, maxDurationMs: 20_000 });
    const paths = result.pages.map(({ url }) => new URL(url).pathname);
    expect(paths, JSON.stringify({ paths, complete: result.complete, stopReason: result.stopReason, pending: result.pendingUrls, unexplored: result.unexploredControls, pages: result.pages.map(({ url, statePath, controlsFound }) => ({ url, statePath, controlsFound })) })).toEqual(expect.arrayContaining(["/category-a/page-2", "/category-b/page-2"]));
    expect(result.uniqueVisitedUrlCount).toBe(new Set(result.pages.map(({ url }) => url)).size);
    expect(result.visitedStateCount).toBe(result.pages.length);
  } finally {
    await context.close();
  }
});

test("카테고리 안 상품 카드 상태를 복원해 상품 상세 탭까지 별도 방문한다", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await context.route("https://spa-product.test/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/robots.txt") return route.fulfill({ contentType: "text/plain", body: "" });
    const body = String.raw`<!doctype html><html><body>
      <h1>공예 쇼핑몰</h1><nav><button id="category" type="button">도자기</button></nav>
      <main id="catalog"></main><div id="detail"></div>
      <script>
        document.querySelector('#category').addEventListener('click', () => {
          document.querySelector('#catalog').innerHTML = '<div class="cursor-pointer" style="height:240px"><h2>수제 도자기 찻잔</h2><p>18,000원</p><button type="button">장바구니 담기</button></div>';
        });
        document.addEventListener('click', (event) => {
          if (event.target.closest('.cursor-pointer') && !event.target.closest('button')) {
            document.querySelector('#detail').innerHTML = '<button id="detail-tab" type="button">상품 상세정보</button><button id="review-tab" type="button">구매 리뷰 (3)</button><p id="detail-copy">상품 기본 정보</p>';
          }
          if (event.target.closest('#detail-tab')) document.querySelector('#detail-copy').textContent = '상세 설명 탭을 열었습니다';
          if (event.target.closest('#review-tab')) document.querySelector('#detail-copy').textContent = '구매 리뷰 목록 세 건';
        });
      </script></body></html>`;
    return route.fulfill({ contentType: "text/html; charset=utf-8", body });
  });
  try {
    await page.goto("https://spa-product.test/");
    const { crawlShopSite } = await import("../src/site-crawler");
    const result = await crawlShopSite(page, page.url(), undefined, undefined, { concurrency: 1, maxPages: 20, maxDurationMs: 20_000 });
    expect(result.pages).toEqual(expect.arrayContaining([
      expect.objectContaining({ statePath: ["도자기", expect.stringContaining("__OPEN_PRODUCT_CARD__:"), "상품 상세정보"] }),
      expect.objectContaining({ statePath: ["도자기", expect.stringContaining("__OPEN_PRODUCT_CARD__:"), "구매 리뷰 (3)"] }),
    ]));
    expect(result.pages.some(({ statePath }) => statePath.at(-1) === "상품 상세정보")).toBe(true);
  } finally {
    await context.close();
  }
});

test("눌러도 URL·화면·선택 상태가 바뀌지 않는 컨트롤은 미검사와 구분한다", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await context.route("https://no-change.test/**", async (route) => route.fulfill({
    contentType: "text/html; charset=utf-8",
    body: new URL(route.request().url()).pathname === "/robots.txt" ? "" : '<h1>상품 상세</h1><button type="button">상품 상세정보</button>',
  }));
  try {
    await page.goto("https://no-change.test/");
    const { crawlShopSite } = await import("../src/site-crawler");
    const result = await crawlShopSite(page, page.url(), undefined, undefined, { concurrency: 1, maxPages: 10, maxDurationMs: 10_000 });
    expect(result.complete).toBe(true);
    expect(result.unexploredControls).toEqual([]);
    expect(result.nonNavigatingControls).toEqual([
      expect.objectContaining({ label: "상품 상세정보", reason: expect.stringContaining("화면") }),
    ]);
  } finally {
    await context.close();
  }
});

test("전체 크롤러는 안쪽 스크롤·숫자 페이지·해시 경로·푸터·GET 검색과 숨겨진 문구를 수집한다", async ({ browser }) => {
  test.setTimeout(90_000);
  const context = await browser.newContext();
  const page = await context.newPage();
  const requested: string[] = [];
  await context.route("https://everything.test/**", async (route) => {
    const url = new URL(route.request().url());
    requested.push(url.href);
    if (url.pathname === "/robots.txt") return route.fulfill({ contentType: "text/plain", body: "" });
    const body = String.raw`<!doctype html><html><body>
      <h1>전체 읽기 쇼핑몰</h1>
      <nav aria-label="페이지"><button type="button" onclick="document.querySelector('#panel').textContent='카테고리 A 전체'">카테고리</button><button type="button" onclick="document.querySelector('#panel').textContent='카테고리 B 전체'">카테고리</button>
        <button type="button" onclick="document.querySelector('#panel').textContent='페이지 2 상품'">2</button></nav>
      <div style="display:none">작은 글씨로 숨긴 자동갱신 안내</div>
      <div id="panel"></div>
      <div id="list" style="height:180px;overflow-y:auto"><div style="height:420px"><a href="/product/1">첫 상품 10,000원</a><div style="height:300px"></div><a href="/product/2">두 번째 상품 12,000원</a></div></div>
      <form method="get" action="/search"><input name="q" placeholder="상품 검색"></form>
      <button id="cart" type="button" onclick="window.cartWasClicked=true">장바구니 담기</button>
      <a href="#/account">마이페이지</a>
      <footer><a href="/policy">교환 반품 정책</a></footer>
      <script>
        const list = document.querySelector('#list');
        list.addEventListener('scroll', () => { if (list.scrollTop + list.clientHeight >= list.scrollHeight - 2 && !document.querySelector('#lazy')) { const lazy=document.createElement('a'); lazy.id='lazy'; lazy.href='/lazy-product'; lazy.textContent='지연 로딩 상품 13,000원'; document.body.append(lazy); } });
        function renderHash(){ if(location.hash==='#/account') document.querySelector('#panel').textContent='계정 주문 내역'; }
        window.addEventListener('hashchange',renderHash); renderHash();
      </script>
    </body></html>`;
    const pages: Record<string, string> = {
      "/": body,
      "/search": "<h1>검색 결과 안내</h1>",
      "/policy": "<h1>교환 반품 정책</h1>",
      "/product/1": "<h1>첫 상품 상세</h1>",
      "/product/2": "<h1>두 번째 상품 상세</h1>",
      "/lazy-product": "<h1>지연 상품 상세</h1>",
    };
    return route.fulfill({ contentType: "text/html; charset=utf-8", body: pages[url.pathname] ?? "<h1>다른 화면</h1>" });
  });
  try {
    await page.goto("https://everything.test/");
    const { crawlShopSite } = await import("../src/site-crawler");
    const result = await crawlShopSite(page, page.url(), undefined, undefined, { concurrency: 4, maxPages: 40, maxDurationMs: 60_000 });
    const pageTexts = result.pages.map(({ text }) => text).join("\n");
    const paths = result.pages.map(({ url }) => url);
    expect(paths, JSON.stringify({ paths, complete: result.complete, stopReason: result.stopReason, pendingUrls: result.pendingUrls, formsFound: result.pages.map(({ url, formsFound }) => ({ url, formsFound })) })).toEqual(expect.arrayContaining([
      "https://everything.test/search", "https://everything.test/policy", "https://everything.test/product/1",
      "https://everything.test/product/2", "https://everything.test/lazy-product", "https://everything.test/#/account",
    ]));
    expect(result.pages.filter(({ url, statePath }) => url === "https://everything.test/" && statePath.join("/") === "카테고리")).toHaveLength(2);
    expect(pageTexts).toContain("카테고리 A 전체");
    expect(pageTexts).toContain("카테고리 B 전체");
    expect(pageTexts).toContain("계정 주문 내역");
    expect(result.pages.some(({ domText }) => domText.some((item) => item.text.includes("자동갱신 안내") && !item.visible))).toBe(true);
    expect(result.pages.some(({ formsFound }) => formsFound.some(({ method }) => method === "GET"))).toBe(true);
    expect(result.pages.every(({ elementCount }) => elementCount > 0)).toBe(true);
    expect(result.pages.some(({ url, interactives }) => url === "https://everything.test/" && interactives.length >= 5)).toBe(true);
    expect(result.skippedControls).toEqual(expect.arrayContaining([expect.objectContaining({ label: "장바구니 담기" })]));
    expect(requested.some((url) => /\/cart(?:\?|$)/.test(url))).toBe(false);
  } finally {
    await context.close();
  }
});

const origin = "http://127.0.0.1:3100";

test("위험 데모에서 두 규칙과 증거를 기록한다", async ({ browser }, info) => {
  const directory = info.outputPath("evidence");
  const report = await scanDemo(browser, origin, "risky", directory);

  expect(report.scanStatus).toBe("COMPLETED");
  expect(report.priceLedger.firstPriceExposure.status).toBe("NOT_VERIFIED");
  expect(report.priceLedger.stages.map(({ evidence, verification }) => [evidence.id, verification])).toEqual([
    ["page:product", "SCREEN_ONLY"], ["page:cart", "SCREEN_ONLY"], ["page:checkout", "SCREEN_ONLY"],
  ]);
  expect(report.priceLedger.stages[2].fees.some((fee) => fee.won === 3000 && fee.required)).toBe(true);

  expect(report.snapshots.map(({ stage }) => stage)).toEqual(["product", "cart", "checkout"]);
  expect(report.snapshots.every(({ surfaceSignals }) => Array.isArray(surfaceSignals))).toBe(true);
  expect(report.interactions).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: "INITIAL_STATE", stage: "product" }),
    expect.objectContaining({ kind: "PAID_OPTION_TOGGLE", controlLabel: expect.stringContaining("선물 포장") }),
  ]));
  expect(report.findings.map(({ type, stage }) => [type, stage])).toEqual([
    ["PRESELECTION", "product"],
    ["DRIP_PRICING", "checkout"],
  ]);
  expect(report.findings[1].evidence.map(({ screenshot }) => screenshot)).toEqual(["product.png", "checkout.png"]);
  expect(report.snapshots[1].url).toContain("gift=yes");
  expect(JSON.parse(await readFile(join(directory, "report.json"), "utf8"))).toEqual(report);
  for (const { screenshot } of report.snapshots) {
    expect((await readFile(join(directory, screenshot))).subarray(1, 4).toString()).toBe("PNG");
  }
});

test("정상 데모의 미선택 옵션과 사전 공개 비용은 탐지하지 않는다", async ({ browser }, info) => {
  const report = await scanDemo(browser, origin, "clean", info.outputPath("evidence"));

  expect(report.snapshots[0].options[0].selected).toBe(false);
  expect(report.snapshots.every(({ fees }) => fees[0]?.won === 3000)).toBe(true);
  expect(report.findings).toEqual([]);
});

test("선택 옵션은 라벨 문구가 아닌 구조화된 양수 금액으로 판정한다", async () => {
  const product = {
    evidenceId: "gift-product", stage: "product" as const, url: "https://shop.test/p/1", screenshot: "",
    priceLines: ["10,000원"], textLines: [], fees: [], options: [{
      label: "무료 사은품 증정", won: 1_000, selected: true,
      bounds: { x: 0, y: 0, width: 10, height: 10 },
    }],
  };
  expect(detect([product])).toEqual([expect.objectContaining({ type: "PRESELECTION", status: "SUSPECTED", evidenceIds: ["gift-product"] })]);
});

test("선택된 동의 문구는 고정 키워드만으로 사전선택 위반 판정을 만들지 않는다", async () => {
  const { collectReviewCandidates } = await import("../src/review-candidates");
  const product = {
    stage: "product" as const, url: "https://shop.test/p/1", screenshot: "", priceLines: [], textLines: [], fees: [], options: [],
    precheckedSignals: [{ label: "VIP 멤버십 자동 연장 결제 동의", bounds: { x: 0, y: 0, width: 10, height: 10 } }],
  };
  expect(detect([product])).toEqual([]);
  expect(collectReviewCandidates([product])[0].text).toContain("VIP 멤버십 자동 연장 결제 동의");
});

test("가격비교 방해 문구는 규칙 유형을 하드코딩하지 않고 원문 근거로 보존한다", async () => {
  const { collectReviewCandidates } = await import("../src/review-candidates");
  const product = {
    evidenceId: "comparison-product", stage: "product" as const, url: "https://shop.test/p/1", screenshot: "",
    priceLines: [], textLines: ["월 납부 금액과 총 비용은 결제 단계에서 확인하세요"], fees: [], options: [],
  };
  expect(detect([product])).toEqual([]);
  expect(collectReviewCandidates([product])[0].text).toContain("월 납부 금액과 총 비용은 결제 단계에서 확인하세요");
});

test("위험 데모의 바로구매 경로는 장바구니를 선택 경로에서 제외한다", async ({ browser }, info) => {
  const report = await scanDemo(browser, origin, "risky", info.outputPath("direct"), undefined, "DESKTOP", "DIRECT");
  expect(report.purchasePath).toBe("DIRECT");
  expect(report.snapshots.map(({ stage }) => stage)).toEqual(["product", "checkout"]);
  expect(report.scanStatus).toBe("COMPLETED");
});

test("모바일 진단은 고정된 모바일 화면 조건을 보고서와 증거에 보존한다", async ({ browser }, info) => {
  const report = await scanDemo(browser, origin, "clean", info.outputPath("mobile"), undefined, "MOBILE");
  expect(report.viewport).toBe("MOBILE");
  expect(report.snapshots[0].screenshotArea?.width).toBe(390);
  expect(report.snapshots[0].screenshotArea?.height).toBeGreaterThanOrEqual(844);
});

test("외부 주소를 거부한다", async ({ browser }, info) => {
  await expect(scanDemo(browser, "https://example.invalid", "risky", info.outputPath("evidence")))
    .rejects.toThrow("로컬 서버만 지원합니다");
});

test("정상 데모에서 사용자가 포장을 선택하면 주문서에 선택 금액이 유지된다", async ({ page }) => {
  await page.goto(origin + "/demo/clean/product");
  await page.getByRole("checkbox", { name: /선물 포장/ }).check();
  await page.getByRole("button", { name: "장바구니에 담기" }).click();
  await expect(page.getByText("표시 합계 23,000원")).toBeVisible();
  await page.getByRole("link", { name: "주문서 보기" }).click();
  await expect(page.getByRole("heading", { name: "주문서" })).toBeVisible();
  await expect(page.getByText("표시 합계 23,000원")).toBeVisible();
});

test("주문서 접근 실패 시 앞 단계의 증거와 사전선택 발견을 유지한다", async ({ browser }, info) => {
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    const path = new URL(request.url!, origin).pathname;
    if (path.endsWith("/product")) {
      response.end(`<main data-stage="product">
        <label><input type="checkbox" checked data-option-won="2000">유료 포장</label>
        <form action="/demo/risky/cart"><button>장바구니에 담기</button></form>
      </main>`);
    } else if (path.endsWith("/cart")) {
      response.end(`<main data-stage="cart"><a href="/demo/risky/checkout">주문서 보기</a></main>`);
    } else {
      response.writeHead(403).end("주문서 접근 제한");
    }
  });
  const listening = once(server, "listening");
  server.listen(0, "127.0.0.1");
  await listening;
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("로컬 테스트 서버 시작 실패");
  try {
    const report = await scanDemo(browser, "http://127.0.0.1:" + address.port, "risky", info.outputPath("evidence"));
    expect(report.scanStatus).toBe("PARTIAL");
    expect(report.snapshots.map(({ stage }) => stage)).toEqual(["product", "cart"]);
    expect(report.findings.map(({ type }) => type)).toEqual(["PRESELECTION"]);
    expect(report.snapshots[0].options[0].bounds.width).toBeGreaterThan(0);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("외부 쇼핑몰 형식의 상품을 로컬 증거로 검사하고 후속 단계는 남겨 둔다", async ({ browser }, info) => {
  const { scanPublicShop } = await import("../src/public-scan");
  const visited: string[] = [];
  const target = "https://store.example.com/";
  const report = await scanPublicShop(browser, target, info.outputPath("public"), async () => {}, async (url) => {
    visited.push(url);
    return {
      url,
      html: url === target
        ? '<a href="https://other.example.com/products/no">다른 상점</a><a href="/product/search.html?keyword=">상품검색</a><a href="/products/category-landing">기획전</a><article><a href="/products/gift">상품 상세</a><span>20,000원 · 필수 처리비 3,000원</span></article>'
        : url.endsWith("category-landing")
          ? "<h1>기획전</h1>"
          : '<meta property="og:type" content="product"><meta property="product:price:amount" content="20000"><label><input type="checkbox" checked>선물 포장 (+2,000원)</label>',
    };
  });
  expect(visited).toEqual([target, target + "products/category-landing", target + "products/gift"]);
  expect(report.scanStatus).toBe("PARTIAL");
  expect(report.snapshots.map(({ stage }) => stage)).toEqual(["product"]);
  expect(report.priceLedger.firstPriceExposure).toMatchObject({
    status: "OBSERVED", productUrl: target + "products/gift", screenshot: "listing.png", amounts: [20000, 3000],
    feeMentions: [{ key: "처리비", won: 3000 }],
  });
  expect(report.findings.map(({ type }) => type)).toEqual(["PRESELECTION"]);
});

test("상품 링크가 JSON-LD에만 있어도 구조화된 URL로 상세를 찾는다", async ({ browser }, info) => {
  const { scanPublicShop } = await import("../src/public-scan");
  const target = "https://structured.example.com/";
  const visited: string[] = [];
  const report = await scanPublicShop(browser, target, info.outputPath("jsonld"), async () => {}, async (url) => {
    visited.push(url);
    return { url, html: url === target
      ? '<script type="application/ld+json">[{"@type":"Organization","url":"/about"},{"@type":"ItemList","itemListElement":[{"item":{"url":"/opaque?id=7"}}]}]</script>'
      : '<h1>상품 7</h1><meta property="og:type" content="product"><meta property="product:price:amount" content="12000"><button>장바구니에 담기</button>' };
  });
  expect(visited).toEqual([target, target + "opaque?id=7"]);
  expect(report.snapshots[0].url).toBe(target + "opaque?id=7");
});

test("canonical 상품 URL만 노출된 목록에서도 상세를 확인한다", async ({ browser }, info) => {
  const { scanPublicShop } = await import("../src/public-scan");
  const target = "https://canonical.example.com/";
  const visited: string[] = [];
  const report = await scanPublicShop(browser, target, info.outputPath("canonical"), async () => {}, async (url) => {
    visited.push(url);
    return { url, html: url === target
      ? '<link rel="canonical" href="/opaque-product?sku=9">'
      : '<h1>상품 9</h1><meta property="og:type" content="product"><meta property="product:price:amount" content="9000"><button>구매하기</button>' };
  });
  expect(visited).toEqual([target, target + "opaque-product?sku=9"]);
  expect(report.snapshots[0].url).toBe(target + "opaque-product?sku=9");
});

test("외부 첫 화면을 읽지 못하면 진단 실패 대신 부분 완료와 원인을 기록한다", async ({ browser }, info) => {
  const { scanPublicShop } = await import("../src/public-scan");
  const report = await scanPublicShop(browser, "https://store.example.com/", info.outputPath("unavailable"), async () => {}, async () => {
    throw new Error("network blocked");
  });
  expect(report.scanStatus).toBe("PARTIAL");
  expect(report.snapshots).toEqual([]);
  expect(report.collectionFailure).toContain("첫 화면");
  expect(report.collectionFailureCode).toBe("FETCH_FAILED");
  expect(JSON.parse(await readFile(join(info.outputPath("unavailable"), "report.json"), "utf8"))).toEqual(report);
});

test("외부 대상 검사는 사설 주소나 혼합 DNS 응답을 거부한다", async () => {
  const { publicAddress } = await import("../src/public-html");
  const { scanTarget } = await import("../src/targets");
  for (const url of ["http://store.example.com", "https://127.0.0.1/", "https://[::1]/", "https://a.local/", "https://store.example.com:9443/", "https://user@store.example.com/"]) {
    expect(scanTarget(url)).toBeNull();
  }
  expect(publicAddress(["8.8.8.8", "169.254.169.254"])).toBeNull();
  expect(publicAddress(["192.168.0.1"])).toBeNull();
  expect(publicAddress(["8.8.8.8"])).toBe("8.8.8.8");
  expect(publicAddress(["2606:4700::1111"])).toBe("2606:4700::1111");
  for (const address of ["::1", "::ffff:127.0.0.1", "64:ff9b::7f00:1", "fc00::1", "fe80::1", "2002:7f00:1::", "invalid"]) {
    expect(publicAddress(["8.8.8.8", address])).toBeNull();
  }
  expect(scanTarget("https://store.example.com/products/1")?.scenario).toBe("public");
});

test("재진단은 같은 항목의 변화만 비교하고 누락된 단계는 비교 불가로 표시한다", async () => {
  const { compareScans } = await import("../src/scan-comparison");
  const targetUrl = "https://shop.example.com/products/1";
  const before = {
    comparisonVersion: 2, scenario: "public", targetUrl,
    snapshots: [{ stage: "product" as const, url: targetUrl }],
    findings: [{ type: "PRESELECTION" as const, stage: "product" as const, ruleVersion: "3" as const, reason: "유료 포장" }],
  };
  const after = {
    ...before,
    findings: [{ ...before.findings[0], reason: "추가 보증" }],
  };
  expect(compareScans(before, after)).toMatchObject({
    status: "COMPARED", repeated: [], added: after.findings, notObserved: before.findings,
  });
  expect(compareScans(before, { ...after, snapshots: [] }).status).toBe("UNAVAILABLE");
  expect(compareScans(before, { ...after, comparisonVersion: undefined }).status).toBe("UNAVAILABLE");
});

test("동적 탐색은 주문서까지만 이동하고 가격 API의 비식별 숫자만 수집한다", async ({ page }) => {
  const { explorePurchaseJourney } = await import("../src/purchase-journey");
  await page.context().route("https://journey.example/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/cart") return route.fulfill({
      contentType: "application/json", body: JSON.stringify({ cart: { total: 21000 }, email: "private@example.com" }),
    });
    if (path === "/login") return route.fulfill({
      contentType: "text/html; charset=utf-8", body: "<h1>로그인</h1><form><input type='email' /></form>",
    });
    if (path === "/membership") return route.fulfill({
      contentType: "text/html; charset=utf-8", body: "<h1>멤버십</h1><p>무료 체험 후 자동 갱신</p>",
    });
    const html = path === "/product"
      ? `<a href="/login">로그인</a><a href="/membership">멤버십</a><select required><option value="">선택해 주세요</option><option value="regular">기본형</option></select><button onclick="fetch('/api/cart').then(()=>setTimeout(()=>location='/cart',100))">장바구니에 담기</button>`
      : path === "/cart"
        ? `<a href="/checkout">주문하기</a>`
        : `<h1>주문서</h1><button onclick="window.ordered=true">주문 확정</button>`;
    return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
  });
  await page.goto("https://journey.example/product");
  const visited: string[] = [];
  const surfacePhases: { surface: string; status: string }[] = [];
  const result = await explorePurchaseJourney(page, async (stage) => { visited.push(stage); }, "CART", async (surface, status) => {
    surfacePhases.push({ surface, status });
  });
  await page.waitForTimeout(50);
  expect(result.reached).toBe("checkout");
  expect(visited).toEqual(["product", "cart", "checkout"]);
  expect(result.observations.map(({ action }) => action.kind)).toContain("REQUIRED_OPTION_SELECTION");
  expect(await page.evaluate(() => (window as typeof window & { ordered?: boolean }).ordered)).toBeUndefined();
  expect(result.network.flatMap(({ values }) => values)).toContainEqual({ path: "$.cart.total", won: 21000 });
  expect(JSON.stringify(result.network)).not.toContain("private@example.com");
  expect(result.surfaceDestinations).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: "AUTH", href: "https://journey.example/login" }),
    expect.objectContaining({ kind: "SUBSCRIPTION", href: "https://journey.example/membership" }),
  ]));
  expect(result.surfaceObservations).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: "AUTH", outcome: "OBSERVED", status: 200 }),
  ]));
  expect(surfacePhases).toEqual(expect.arrayContaining([
    { surface: "AUTH", status: "RUNNING" }, { surface: "AUTH", status: "COVERED" },
    { surface: "SUBSCRIPTION", status: "RUNNING" }, { surface: "SUBSCRIPTION", status: "COVERED" },
  ]));
});

test("별도 탐색 7개 영역은 같은 출처의 각 화면을 실제로 열어 기록한다", async ({ page }) => {
  const { explorePurchaseJourney } = await import("../src/purchase-journey");
  const surfaces = [
    ["CATALOG", "카테고리", "/category"], ["AUTH", "로그인", "/login"],
    ["COUPON", "쿠폰", "/coupon"], ["RECOMMENDATION", "인기 상품", "/popular"],
    ["SUBSCRIPTION", "멤버십", "/membership"], ["CANCELLATION", "구독 해지", "/unsubscribe"],
    ["POLICY", "배송·반품 정책", "/shipping"],
  ] as const;
  await page.context().route("https://surfaces.example/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const main = path === "/product"
      ? `${surfaces.map(([, label, href]) => `<a href="${href}">${label}</a>`).join("")}<button onclick="location='/cart'">장바구니 담기</button>`
      : path === "/cart" ? `<h1>장바구니 (1)</h1><button onclick="location='/checkout'">주문하기</button>`
        : path === "/checkout" ? `<h1>주문서</h1><label>배송 정보<input /></label>`
          : `<h1>${path}</h1><p>화면 내용 확인</p>`;
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: main });
  });
  await page.goto("https://surfaces.example/product");
  const result = await explorePurchaseJourney(page);
  expect(result.surfaceObservations).toHaveLength(7);
  for (const [kind, , href] of surfaces) {
    expect(result.surfaceObservations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind, url: `https://surfaces.example${href}`, status: href === "/unsubscribe" ? null : 200, outcome: href === "/unsubscribe" ? "DISCOVERED" : "OBSERVED" }),
    ]));
  }
});

test("읽기 전용 후기·정책 버튼은 격리 탭에서 확인하고 쿠폰 적용 버튼은 누르지 않는다", async ({ page }) => {
  const { explorePurchaseJourney } = await import("../src/purchase-journey");
  await page.context().route("https://buttons.example/**", async (route) => route.fulfill({
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: `<h1>상품</h1>
      <button type="button" onclick="document.body.innerHTML='<h1>구매 리뷰</h1><p>구매자 후기</p>'">구매 리뷰 보기</button>
      <button type="button" onclick="document.body.innerHTML='<h1>배송 안내</h1><p>교환·반품 조건</p>'">배송 안내</button>
      <button type="button" onclick="window.couponApplied=true">쿠폰 받기</button>`,
  }));
  await page.goto("https://buttons.example/product");
  const result = await explorePurchaseJourney(page);
  expect(result.surfaceObservations).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: "RECOMMENDATION", outcome: "OBSERVED", text: expect.stringContaining("구매자 후기") }),
    expect.objectContaining({ kind: "POLICY", outcome: "OBSERVED", text: expect.stringContaining("교환·반품 조건") }),
    expect.objectContaining({ kind: "COUPON", outcome: "DISCOVERED" }),
  ]));
  expect(await page.evaluate(() => (window as typeof window & { couponApplied?: boolean }).couponApplied)).toBeUndefined();
});

test("경로 이름으로 구독 화면을 찾고 해지 실행 URL은 열지 않는다", async ({ page }) => {
  const { explorePurchaseJourney } = await import("../src/purchase-journey");
  let cancellationRequests = 0;
  await page.context().route("https://surface-probe.example/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/membership/cancel") {
      cancellationRequests++;
      await route.fulfill({ contentType: "text/html", body: "<h1>해지가 처리되었습니다</h1>" });
      return;
    }
    const body = path === "/membership"
      ? "<h1>정기 구독 관리</h1><p>매월 자동 갱신</p>"
      : '<a href="/membership">정기 결제 관리</a><a href="/membership/cancel">구독 해지</a>';
    await route.fulfill({ contentType: "text/html; charset=utf-8", body });
  });
  await page.goto("https://surface-probe.example/product");
  const result = await explorePurchaseJourney(page);
  expect(result.surfaceObservations).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: "SUBSCRIPTION", outcome: "OBSERVED", text: expect.stringContaining("자동 갱신") }),
    expect.objectContaining({ kind: "CANCELLATION", outcome: "DISCOVERED", text: expect.stringContaining("열지 않았습니다") }),
  ]));
  expect(cancellationRequests).toBe(0);
});

test("동적 탐색은 행동 후보가 여러 개면 임의로 클릭하지 않고 이유를 기록한다", async ({ page }) => {
  const { explorePurchaseJourney } = await import("../src/purchase-journey");
  await page.setContent(`<button onclick="window.clicked=true">장바구니에 담기</button><button onclick="window.clicked=true">장바구니에 담기</button>`);
  const result = await explorePurchaseJourney(page);
  expect(result.blocker).toEqual({
    stage: "product", code: "ACTION_AMBIGUOUS", action: "ADD_TO_CART", candidateCount: 2,
  });
  expect(await page.evaluate(() => (window as typeof window & { clicked?: boolean }).clicked)).toBeUndefined();
});

test("구매 경로 단계가 실패한 채 우회 주문서에 도달하면 부분 완료로 남긴다", async () => {
  const { dynamicScanStatus } = await import("../src/dynamic-public-scan");
  expect(dynamicScanStatus("checkout", null, true)).toBe("COMPLETED");
  expect(dynamicScanStatus("checkout", null, false)).toBe("PARTIAL");
  expect(dynamicScanStatus("checkout", {
    stage: "product", code: "ACTION_NOT_FOUND", action: "ADD_TO_CART", candidateCount: 0,
  }, true)).toBe("PARTIAL");
});

test("동적 탐색은 로그인 화면을 별도 미검사 사유로 기록한다", async ({ page }) => {
  const { explorePurchaseJourney } = await import("../src/purchase-journey");
  await page.setContent("<main><h1>로그인</h1><p>구매하려면 로그인해 주세요.</p></main>");
  const result = await explorePurchaseJourney(page);
  expect(result.blocker).toMatchObject({ code: "LOGIN_REQUIRED", action: "ADD_TO_CART", stage: "product" });
});

test("동적 탐색은 input submit 구매 동작도 의미 이름으로 인식한다", async ({ page }) => {
  const { explorePurchaseJourney } = await import("../src/purchase-journey");
  await page.route("https://input.example/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const html = path === "/product"
      ? '<input type="submit" value="장바구니에 담기" onclick="location=\'/cart\'">'
      : '<h1>장바구니 (1)</h1><button>수량 1</button>';
    return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
  });
  await page.goto("https://input.example/product");
  const result = await explorePurchaseJourney(page);
  expect(result.blocker?.action).toBe("OPEN_CHECKOUT");
  expect(result.blocker?.code).toBe("ACTION_NOT_FOUND");
});

test("HTML required 없이 필수 표식을 가진 상품 옵션도 먼저 선택한다", async ({ page }) => {
  const { explorePurchaseJourney } = await import("../src/purchase-journey");
  await page.setContent(`
    <label>색상 선택 *</label>
    <select><option value="">선택하세요</option><option value="black">블랙</option></select>
    <button onclick="location.href='/cart'">장바구니에 담기</button>
  `);
  const result = await explorePurchaseJourney(page);
  expect(await page.locator("select").inputValue()).toBe("black");
  expect(result.observations.some(({ action }) => action.kind === "REQUIRED_OPTION_SELECTION")).toBe(true);
});

test("장바구니 담기 뒤 실제 장바구니가 비어 있으면 완료로 표시하지 않는다", async ({ page }) => {
  const { explorePurchaseJourney } = await import("../src/purchase-journey");
  await page.setContent(`
    <button onclick="document.querySelector('#cart').hidden=false">장바구니에 담기</button>
    <section id="cart" hidden><h2>장바구니 (0)</h2><p>장바구니가 비어 있습니다.</p></section>
  `);
  const result = await explorePurchaseJourney(page);
  expect(result.reached).toBe("product");
  expect(result.blocker).toMatchObject({ stage: "product", code: "ACTION_FAILED", action: "ADD_TO_CART" });
});

test("바로구매 경로는 장바구니를 거치지 않고 주문서 직전에서 멈춘다", async ({ page }) => {
  const { explorePurchaseJourney } = await import("../src/purchase-journey");
  await page.route("https://direct.example/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const html = path === "/product"
      ? `<button>장바구니에 담기</button><button onclick="location='/checkout'">바로구매</button>`
      : `<h1>주문서</h1><button>주문 확정</button>`;
    return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
  });
  await page.goto("https://direct.example/product");
  const visited: string[] = [];
  const result = await explorePurchaseJourney(page, async (stage) => { visited.push(stage); }, "DIRECT");
  expect(result.reached).toBe("checkout");
  expect(visited).toEqual(["product", "checkout"]);
  expect(result.observations.map(({ action }) => action.id)).toContain("product:direct-buy");
  expect(await page.locator("h1").innerText()).toBe("주문서");
});

test("구매 버튼이 일반 안내 화면으로 이동하면 주문서 도달로 과장하지 않는다", async ({ page }) => {
  const { explorePurchaseJourney } = await import("../src/purchase-journey");
  await page.route("https://redirect.example/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const html = path === "/product"
      ? `<button onclick="location='/notice'">바로구매</button>`
      : `<h1>구매 안내</h1><p>재고 문의 후 구매할 수 있습니다.</p>`;
    return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
  });
  await page.goto("https://redirect.example/product");
  const result = await explorePurchaseJourney(page, undefined, "DIRECT");
  expect(result.reached).toBe("product");
  expect(result.blocker).toMatchObject({ code: "ACTION_FAILED", action: "DIRECT_BUY" });
});

test("경로명이 평범해도 주문·배송 정보와 입력 폼이 있으면 주문서로 확인한다", async ({ page }) => {
  const { explorePurchaseJourney } = await import("../src/purchase-journey");
  await page.route("https://copy.example/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const html = path === "/product"
      ? `<button onclick="location='/basket'">담기</button>`
      : path === "/basket"
        ? `<button onclick="location='/next-step'">결제하기</button>`
        : `<h1>배송 정보</h1><label>이메일<input type="email"></label>`;
    return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
  });
  await page.goto("https://copy.example/product");
  const result = await explorePurchaseJourney(page);
  expect(result.reached).toBe("checkout");
});

test("사이트 확인 메타 태그는 속성 순서와 따옴표가 달라도 검증하고 위조 값은 거부한다", async () => {
  const { createSiteVerification, matchesVerification, verificationName } = await import("../src/site-verification");
  const verification = createSiteVerification();
  expect(matchesVerification(`<meta content='${verification.token}' data-x="1" name='${verificationName}'>`, verification.hash)).toBe(true);
  expect(matchesVerification(`<meta name="${verificationName}" content="forged">`, verification.hash)).toBe(false);
  expect(matchesVerification(`<script>${verification.token}</script>`, verification.hash)).toBe(false);
});

test("동적 수집 실패는 추가 인증과 일반 탐색 실패를 구분한다", async () => {
  const { classifyDynamicFailure } = await import("../src/scan-failure");
  expect(classifyDynamicFailure("로그인에 실패했거나 추가 인증이 필요합니다.")).toBe("AUTH_CHALLENGE");
  expect(classifyDynamicFailure("page.goto: net::ERR_EMPTY_RESPONSE")).toBe("FETCH_FAILED");
  expect(classifyDynamicFailure("동적 구매 흐름 시간 초과(120000ms)")).toBe("DYNAMIC_JOURNEY_FAILED");
});

test("로그용 URL 정규화는 쿼리와 해시를 제거한다", async () => {
  const { safeUrl } = await import("../src/safe-url");
  expect(safeUrl("https://shop.example/item?session=secret#checkout")).toBe("https://shop.example/item");
});

test("가격 원장은 화면과 API 금액의 일치·불일치를 값별로 보존한다", async () => {
  const { buildPriceLedger } = await import("../src/price-ledger");
  const snapshot = {
    stage: "cart" as const, url: "https://shop.example.com/cart", screenshot: "cart.png",
    priceLines: ["상품 18,000원", "합계 21,000원"], options: [], fees: [],
  };
  const ledger = buildPriceLedger([snapshot], [{
    id: "network:cart:1", stage: "cart", url: "https://shop.example.com/api/cart", capturedAt: new Date().toISOString(),
    values: [{ path: "$.total", won: 21000 }, { path: "$.hiddenFee", won: 3000 }],
  }]);
  expect(ledger.stages[0].verification).toBe("SCREEN_NETWORK_PARTIAL");
  expect(ledger.stages[0].networkValues).toEqual([
    expect.objectContaining({ path: "$.total", matchedScreen: true }),
    expect.objectContaining({ path: "$.hiddenFee", matchedScreen: false }),
  ]);
});

test("일반적인 상품 옵션 문구의 명시적 추가금을 유료 옵션으로 읽는다", async () => {
  expect(paidOptionFromText("각인 서비스 +2,500원")).toBe(2500);
  expect(paidOptionFromText("프리미엄 케어 +2,500원 파손 시 교환을 지원합니다")).toBe(2500);
  expect(paidOptionFromText("색상 블랙 (+1,000원)")).toBeNull();
  expect(paidOptionFromText("무료 배송")).toBeNull();
});

test("주문서의 유료 사전선택은 판정하고 동의 문구는 의미를 추정하지 않은 근거로 남긴다", async () => {
  const { collectReviewCandidates } = await import("../src/review-candidates");
  const bounds = { x: 0, y: 0, width: 100, height: 20 };
  const product = { stage: "product" as const, url: "https://shop.example.com/product", screenshot: "product.png", priceLines: ["19,900원"], options: [], fees: [] };
  const checkout = {
    stage: "checkout" as const, url: "https://shop.example.com/checkout", screenshot: "checkout.png", priceLines: ["22,400원"], fees: [],
    precheckedSignals: [{ label: "멤버십 월 9,900원 자동 갱신", bounds }],
    options: [{ label: "프리미엄 케어 +2,500원", won: 2500, selected: true, bounds }],
  };
  const finding = detect([product, checkout]).find(({ type }) => type === "PRESELECTION");
  expect(finding).toMatchObject({ status: "SUSPECTED", stage: "checkout" });
  expect(finding?.reason).toContain("프리미엄 케어");
  expect(collectReviewCandidates([checkout])[0].text).toContain("멤버십 월 9,900원 자동 갱신");
});

test("긴급성 문구는 하드코딩 규칙으로 유형 판정하지 않고 원문 근거로 보존한다", async () => {
  const { collectReviewCandidates } = await import("../src/review-candidates");
  const product = {
    evidenceId: "evidence:product", stage: "product" as const, url: "https://shop.example.com/", screenshot: "product.png",
    priceLines: [], textLines: ["선착순 마감 임박", "마지막 재고 2개"], options: [], fees: [],
  };
  const candidates = collectReviewCandidates([product]);
  expect(candidates).toHaveLength(1);
  expect(candidates[0]).toMatchObject({ kind: "SEMANTIC_REVIEW", evidenceIds: ["evidence:product"] });
  expect(candidates[0]).not.toHaveProperty("ruleType");
  expect(candidates[0].text).toContain("선착순 마감 임박");
  expect(candidates[0].text).toContain("마지막 재고 2개");
});

test("표현 변형도 규칙 유형을 강제하지 않고 원문을 보존한다", async () => {
  const { collectReviewCandidates } = await import("../src/review-candidates");
  const product = {
    evidenceId: "evidence:product", stage: "product" as const, url: "https://shop.example.com/", screenshot: "product.png",
    priceLines: [], textLines: ["특가 종료까지 02:59", "남은 재고 단 2개 (주문 폭주)"], options: [], fees: [],
  };
  expect(collectReviewCandidates([product])[0].text).toContain("남은 재고 단 2개");
});

test("동의 문구는 고정 어휘로 유형을 붙이지 않고 전체 화면 근거로 남긴다", async () => {
  const { collectReviewCandidates } = await import("../src/review-candidates");
  const checkout = {
    evidenceId: "evidence:checkout", stage: "checkout" as const, url: "https://shop.example.com/checkout", screenshot: "checkout.png",
    priceLines: [], textLines: ["[필수/선택 통합] 야간 광고성 정보 수신 및 제3자 마케팅 정보제공 전체동의"], options: [], fees: [],
  };
  expect(collectReviewCandidates([checkout])[0]).toMatchObject({ kind: "SEMANTIC_REVIEW", evidenceIds: ["evidence:checkout"] });
  expect(collectReviewCandidates([checkout])[0]).not.toHaveProperty("ruleType");
});

test("격리 장바구니에 한 번 담은 뒤 여러 품목이 보이면 몰래 추가로 판정한다", () => {
  const product = { stage: "product" as const, url: "https://shop.example.com/product", screenshot: "product.png", priceLines: [], textLines: [], options: [], fees: [] };
  const cart = { stage: "cart" as const, url: "https://shop.example.com/cart", screenshot: "cart.png", priceLines: [], textLines: ["장바구니 (2)"], options: [], fees: [], cartItemCount: 2 };
  expect(detect([product, cart])).toEqual(expect.arrayContaining([expect.objectContaining({ type: "SNEAKY_CART_ADD", status: "SUSPECTED" })]));
});

test("격리 장바구니에 요청한 한 품목만 있으면 몰래 추가 신호가 없고 검사 완료로 남긴다", () => {
  const product = { stage: "product" as const, url: "https://shop.example.com/product", screenshot: "product.png", priceLines: [], textLines: [], options: [], fees: [] };
  const cart = { stage: "cart" as const, url: "https://shop.example.com/cart", screenshot: "cart.png", priceLines: [], textLines: ["장바구니 (1)"], options: [], fees: [], cartItemCount: 1 };
  expect(detect([product, cart]).some(({ type }) => type === "SNEAKY_CART_ADD")).toBe(false);
  expect(buildRuleCoverage({ findings: [], snapshots: [product, cart], surfaceObservations: [] }).SNEAKY_CART_ADD.status).toBe("NOT_OBSERVED");
});

test("확장 가이드라인 문구만으로 유형을 판정하지 않고 구매 화면 증거를 보존한다", async () => {
  const { collectReviewCandidates } = await import("../src/review-candidates");
  const product = {
    evidenceId: "evidence:product", stage: "product" as const, url: "https://shop.example.com/", screenshot: "product.png",
    priceLines: ["최저가 19,900원", "정가 29,000원"],
    textLines: ["무료 체험 후 자동 갱신", "혜택을 포기하고 닫기", "광고 포함 추천 상품", "로그인 후 구매 가능"], options: [], fees: [],
  };
  expect(detect([product])).toEqual([]);
  expect(collectReviewCandidates([product])).toEqual([expect.objectContaining({ kind: "SEMANTIC_REVIEW", evidenceIds: ["evidence:product"] })]);
});

test("문구 신호는 확정 유형에 연결하지 않고 화면 검토 후보로 보존한다", async () => {
  const { collectReviewCandidates } = await import("../src/review-candidates");
  const product = {
    evidenceId: "evidence:all-types", stage: "product" as const, url: "https://shop.example.com/", screenshot: "product.png",
    priceLines: [], textLines: [
      "추천 상품 · 구매자 추천", "함께 담기 자동으로 추가", "최저가 상품 품절 임박",
      "아니요, 혜택을 받지 않겠습니다", "구매 버튼은 크게, 거절은 작게", "회원 탈퇴",
      "개당 가격 · 총 비용",
    ], options: [], fees: [],
  };
  expect(collectReviewCandidates([product])).toMatchObject([expect.objectContaining({ kind: "SEMANTIC_REVIEW", evidenceIds: ["evidence:all-types"] })]);
  expect(collectReviewCandidates([product])[0]).not.toHaveProperty("ruleType");
});

test("모호한 비용 문구는 자동 판정 대신 제한된 검토 후보로 보존한다", async () => {
  const { collectReviewCandidates } = await import("../src/review-candidates");
  const candidates = collectReviewCandidates([{
    evidenceId: "evidence:product", stage: "product", url: "https://shop.example.com/", screenshot: "product.png",
    priceLines: ["배송비 3,000원"], textLines: ["배송비 3,000원"], options: [], fees: [],
  }]);
  expect(candidates).toEqual([expect.objectContaining({ kind: "SEMANTIC_REVIEW", evidenceIds: ["evidence:product"] })]);
});

test("크롤된 시각 측정은 문구 기반 계층 판정 없이 원본 화면 근거로 보존한다", async () => {
  const { collectCrawlRuleCandidates } = await import("../src/review-candidates");
  const { buildRuleCoverage } = await import("../src/rule-coverage");
  const page = {
    evidenceId: "site-page:header", url: "https://shop.example.com/", outcome: "OBSERVED",
    interactives: [{ tag: "button", label: "로그아웃", role: "", type: "", visible: true, disabled: false }],
    domText: [{ tag: "button", text: "로그아웃", visible: true, fontSize: "10px", color: "rgb(163,163,163)", opacity: "1", bounds: { x: 100, y: 20, width: 39, height: 13 } }],
  } as import("../src/site-crawler").CrawledSitePage;
  const candidates = collectCrawlRuleCandidates([page]);
  expect(candidates).toMatchObject([expect.objectContaining({ kind: "SEMANTIC_REVIEW", evidenceIds: ["site-page:header"] })]);
  expect(candidates[0]).not.toHaveProperty("ruleType");
  expect(buildRuleCoverage({ findings: [], snapshots: [], reviewCandidates: candidates }).MISDIRECTED_HIERARCHY).toEqual(expect.objectContaining({
    status: "NOT_TESTED", evidenceIds: [], reason: expect.stringContaining("checkout 화면"),
  }));
});

test("크롤한 MEGA 유형별 화면 증거가 16개 규칙 보고서의 검토 상태와 근거 ID에 연결된다", async () => {
  const { collectCrawlRuleCandidates } = await import("../src/review-candidates");
  const page = {
    evidenceId: "site-page:mega-checkout", url: "https://shop.test/", outcome: "OBSERVED",
    text: [
      "[선착순 타임특가 마감임박 02:58] 지금 결제하지 않으면 쿠폰이 소멸됩니다",
      "실시간 54명 동시 조회중 · 구매자 추천",
      "시중 정상가 198,000원 · 역대 최저가 90% 18,900원",
      "VIP 프라임 멤버십 첫달 무료 체험, 익월부터 매월 9,900원 자동결제 연장",
      "필수 특수 완충 포장비 +3,500원",
      "아니오, 배송 중 파손이나 분실이 발생하더라도 제 책임으로 손해를 감수하겠습니다.",
      "전화 취소는 평일 14~15시 고객센터로 접수",
    ].join("\n"),
    domText: [
      { tag: "small", text: "익월부터 매월 9,900원 자동결제", visible: true, fontSize: "9px", color: "rgb(160,160,160)", opacity: "1", bounds: { x: 0, y: 0, width: 90, height: 10 } },
    ],
    interactives: [
      { tag: "input", label: "VIP 프라임 멤버십 무료 체험 및 익월 자동 연장 동의", role: "", type: "checkbox", visible: true, disabled: false, selected: true },
      { tag: "input", label: "[필수/선택 통합] 야간 광고성 정보 수신 및 제3자 마케팅 정보제공 전체동의", role: "", type: "checkbox", visible: true, disabled: false, selected: true },
    ],
  } as import("../src/site-crawler").CrawledSitePage;
  const candidates = collectCrawlRuleCandidates([page]);
  const coverage = buildRuleCoverage({ findings: [], snapshots: [], siteCrawlComplete: true, reviewCandidates: candidates });
  for (const type of ["URGENCY_SCARCITY", "FALSE_RECOMMENDATION", "FALSE_DISCOUNT", "HIDDEN_SUBSCRIPTION", "PRESELECTION", "DRIP_PRICING", "CONFIRM_SHAMING", "TRICK_QUESTION", "HIDDEN_INFO"] as const) {
    expect(coverage[type], type).toMatchObject({ status: "NOT_TESTED" });
  }
  expect(candidates).toEqual([expect.objectContaining({ kind: "SEMANTIC_REVIEW", evidenceIds: ["site-page:mega-checkout"] })]);
});

test("실패한 해지 경로는 구독이 있어도 미검사 검토 후보로 남긴다", async () => {
  const { collectSurfaceReviewCandidates } = await import("../src/review-candidates");
  const candidates = collectSurfaceReviewCandidates([
    { evidenceId: "surface:subscription:0", kind: "SUBSCRIPTION", url: "https://shop.example.com/membership", status: 200, title: "멤버십", text: "자동 갱신", outcome: "OBSERVED" },
    { evidenceId: "surface:cancellation:1", kind: "CANCELLATION", url: "https://shop.example.com/cancel", status: 403, title: "", text: "", outcome: "FETCH_FAILED" },
  ]);
  expect(candidates.some(({ id }) => id === "review:surface:cancellation:missing")).toBe(true);
});

test("목록에서 이미 같은 필수 비용을 공개했다면 뒤늦은 가격 공개로 오탐하지 않는다", async () => {
  const { detect } = await import("../src/rules");
  const bounds = { x: 0, y: 0, width: 100, height: 20 };
  const product = { stage: "product" as const, url: "https://shop.example.com/product", screenshot: "product.png", priceLines: ["18,000원"], options: [], fees: [] };
  const checkout = {
    stage: "checkout" as const, url: "https://shop.example.com/checkout", screenshot: "checkout.png", priceLines: ["21,000원"], options: [],
    fees: [{ id: "text:처리비", label: "필수 처리비 3,000원", won: 3000, required: true, bounds }],
  };
  expect(detect([product, checkout]).map(({ type }) => type)).toEqual(["DRIP_PRICING"]);
  expect(detect([product, checkout], [{ key: "처리비", won: 3000 }])).toEqual([]);
});

test("주문서에서 처음 나타난 여러 필수 비용을 하나의 완전한 근거로 묶는다", () => {
  const bounds = { x: 0, y: 0, width: 100, height: 20 };
  const product = { stage: "product" as const, url: "https://shop.example.com/product", screenshot: "product.png", priceLines: ["19,900원"], options: [], fees: [] };
  const checkout = {
    stage: "checkout" as const, url: "https://shop.example.com/checkout", screenshot: "checkout.png", priceLines: ["29,700원"], options: [],
    fees: [
      { id: "text:포장비", label: "필수 특수 완충 포장비 +3,500원", won: 3500, required: true, bounds },
      { id: "text:이용료", label: "결제 보안 시스템 이용료 +1,800원", won: 1800, required: true, bounds },
      { id: "text:배송비", label: "기본 안전 배송비 +4,500원", won: 4500, required: true, bounds },
    ],
  };
  const findings = detect([product, checkout]).filter(({ type }) => type === "DRIP_PRICING");
  expect(findings).toHaveLength(1);
  expect(findings[0].reason).toContain("포장비");
  expect(findings[0].reason).toContain("이용료");
  expect(findings[0].reason).toContain("배송비");
});

test("16개 유형별 상태는 증거가 없는 항목을 미발견이 아닌 미검사로 남긴다", () => {
  const snapshots = [
    { evidenceId: "evidence:product", stage: "product" as const, url: "https://shop.example.com/product", screenshot: "product.png", priceLines: [], textLines: [], options: [], fees: [] },
    { evidenceId: "evidence:checkout", stage: "checkout" as const, url: "https://shop.example.com/checkout", screenshot: "checkout.png", priceLines: [], textLines: [], options: [], fees: [] },
  ];
  const coverage = buildRuleCoverage({ findings: [], snapshots, surfaceObservations: [] });
  expect(coverage.PRESELECTION.status).toBe("NOT_OBSERVED");
  expect(coverage.DRIP_PRICING.status).toBe("NOT_OBSERVED");
  expect(coverage.MISDIRECTED_HIERARCHY.status).toBe("NOT_TESTED");
  expect(coverage.CANCELLATION_OBSTRUCTION.status).toBe("NOT_TESTED");
});

test("수락·거부 문구와 실제 크기는 유형을 추정하지 않고 검토 근거로 보존한다", async () => {
  const { collectReviewCandidates } = await import("../src/review-candidates");
  const { buildRuleCoverage } = await import("../src/rule-coverage");
  const snapshot = {
    evidenceId: "evidence:checkout", stage: "checkout" as const, url: "https://shop.example.com/checkout",
    screenshot: "checkout.png", priceLines: [], textLines: [], options: [], fees: [],
    decisionControls: [
      { kind: "BUTTON" as const, label: "혜택 받고 계속하기", bounds: { x: 0, y: 0, width: 300, height: 60 } },
      { kind: "BUTTON" as const, label: "아니요, 혜택을 포기할게요", bounds: { x: 0, y: 70, width: 80, height: 20 } },
    ],
  };
  const candidates = collectReviewCandidates([snapshot]);
  expect(candidates).toHaveLength(1);
  expect(candidates[0].text).toContain("아니요, 혜택을 포기할게요");
  const coverage = buildRuleCoverage({ findings: [], snapshots: [snapshot], reviewCandidates: candidates });
  for (const type of ["CONFIRM_SHAMING", "MISDIRECTED_HIERARCHY", "TRICK_QUESTION"] as const) {
    expect(coverage[type]).toMatchObject({ status: "NOT_TESTED", evidenceIds: ["evidence:checkout"] });
  }
});

test("로그인 차단은 강제행동 확정이 아니라 근거가 있는 검토 신호로 남긴다", async () => {
  const { detectForcedAction } = await import("../src/detectors/interaction-patterns");
  const snapshot = {
    evidenceId: "evidence:product", stage: "product" as const, url: "https://shop.example.com/product",
    screenshot: "product.png", priceLines: [], options: [], fees: [],
  };
  const blocker = { stage: "product" as const, code: "LOGIN_REQUIRED" as const, action: "ADD_TO_CART" as const, candidateCount: 0 };
  expect(detectForcedAction(blocker, [snapshot])).toEqual([
    expect.objectContaining({ type: "FORCED_ACTION", status: "REVIEW_NEEDED", evidenceIds: ["evidence:product"] }),
  ]);
  expect(detectForcedAction({ ...blocker, code: "ACTION_NOT_FOUND" }, [snapshot])).toEqual([]);
});

test("선택지 구조를 실제 검사한 깨끗한 주문서는 계층·강제행동 유형의 미발견 근거가 된다", () => {
  const checkout = {
    evidenceId: "evidence:checkout", stage: "checkout" as const, url: "https://shop.example.com/checkout",
    screenshot: "checkout.png", priceLines: [], textLines: [], options: [], fees: [], decisionControls: [],
  };
  const coverage = buildRuleCoverage({ findings: [], snapshots: [checkout], surfaceObservations: [] });
  expect(coverage.CONFIRM_SHAMING.status).toBe("NOT_OBSERVED");
  expect(coverage.TRICK_QUESTION.status).toBe("NOT_OBSERVED");
  expect(coverage.MISDIRECTED_HIERARCHY.status).toBe("NOT_OBSERVED");
  expect(coverage.FORCED_ACTION.status).toBe("NOT_TESTED");
});

test("표면 문구 신호는 해당 영역 증거와 연결하고 자동 미발견으로 뭉개지 않는다", () => {
  const observations = [
    { evidenceId: "surface:recommendation:1", kind: "RECOMMENDATION" as const, url: "https://shop.example.com/reviews", status: 200, title: "인기 상품", text: "스폰서 추천 상품 · 구매자 추천", outcome: "OBSERVED" as const },
    { evidenceId: "surface:catalog:1", kind: "CATALOG" as const, url: "https://shop.example.com/category", status: 200, title: "상품 목록", text: "품절 · 구매 불가", outcome: "OBSERVED" as const },
    { evidenceId: "surface:subscription:1", kind: "SUBSCRIPTION" as const, url: "https://shop.example.com/membership", status: 200, title: "멤버십", text: "정기 결제", outcome: "OBSERVED" as const },
    { evidenceId: "surface:cancellation:1", kind: "CANCELLATION" as const, url: "https://shop.example.com/cancel", status: 200, title: "해지", text: "해지 신청", outcome: "OBSERVED" as const },
  ];
  const coverage = buildRuleCoverage({ findings: [], snapshots: [], surfaceObservations: observations });
  expect(coverage.DISGUISED_AD).toMatchObject({ status: "NOT_TESTED", evidenceIds: ["surface:recommendation:1"] });
  expect(coverage.FALSE_RECOMMENDATION.status).toBe("NOT_TESTED");
  expect(coverage.BAIT_SELLING).toMatchObject({ status: "NOT_TESTED", evidenceIds: ["surface:catalog:1"] });
  expect(coverage.CANCELLATION_OBSTRUCTION).toMatchObject({
    status: "REVIEW_NEEDED", evidenceIds: ["surface:subscription:1", "surface:cancellation:1"],
  });
});

test("크롤링 큐가 끝났다는 이유만으로 미방문 표면 유형을 미발견 처리하지 않는다", () => {
  const coverage = buildRuleCoverage({ findings: [], snapshots: [], surfaceObservations: [], siteCrawlComplete: true });
  expect(coverage.DISGUISED_AD).toMatchObject({ status: "NOT_TESTED", reason: expect.stringContaining("RECOMMENDATION 영역") });
  expect(coverage.HIDDEN_SUBSCRIPTION).toMatchObject({ status: "NOT_TESTED", reason: expect.stringContaining("SUBSCRIPTION 영역") });
  expect(coverage.CANCELLATION_OBSTRUCTION).toMatchObject({ status: "NOT_TESTED", reason: expect.stringContaining("CANCELLATION 영역") });
});

test("실제 판정과 검토 신호는 유형별 상태에서 미검사보다 우선한다", () => {
  const snapshot = { evidenceId: "evidence:checkout", stage: "checkout" as const, url: "https://shop.example.com/checkout", screenshot: "checkout.png", priceLines: [], textLines: [], options: [], fees: [] };
  const findings = [
    { type: "PRESELECTION" as const, status: "SUSPECTED" as const, ruleVersion: "3" as const, stage: "checkout" as const, reason: "기본 선택", evidence: [snapshot], evidenceIds: [snapshot.evidenceId] },
    { type: "HIDDEN_SUBSCRIPTION" as const, status: "REVIEW_NEEDED" as const, ruleVersion: "1" as const, stage: "checkout" as const, reason: "자동 갱신 문구", evidence: [snapshot], evidenceIds: [snapshot.evidenceId] },
  ];
  const coverage = buildRuleCoverage({ findings, snapshots: [snapshot], surfaceObservations: [] });
  expect(coverage.PRESELECTION).toMatchObject({ status: "SUSPECTED", reason: "기본 선택" });
  expect(coverage.HIDDEN_SUBSCRIPTION).toMatchObject({ status: "REVIEW_NEEDED", reason: "자동 갱신 문구" });
});

test("브라우저 연결은 검증된 공개 주소로 고정하고 내부망·혼합 DNS·다른 포트를 거부한다", async () => {
  const { safeConnectTarget } = await import("../src/safe-browser-proxy");
  await expect(safeConnectTarget("cdn.shop.example.com:443", async () => ["93.184.216.34"]))
    .resolves.toEqual({ hostname: "cdn.shop.example.com", address: "93.184.216.34", port: 443 });
  for (const [authority, addresses] of [
    ["cdn.shop.example.com:443", ["127.0.0.1"]],
    ["cdn.shop.example.com:443", ["93.184.216.34", "10.0.0.1"]],
    ["cdn.shop.example.com:80", ["93.184.216.34"]],
    ["127.0.0.1:443", ["127.0.0.1"]],
  ] as const) {
    await expect(safeConnectTarget(authority, async () => [...addresses])).rejects.toThrow();
  }
});

test("동적 브라우저 요청은 검증된 쇼핑몰 출처만 허용한다", async () => {
  const { isAllowedDynamicRequest } = await import("../src/dynamic-public-scan");
  expect(isAllowedDynamicRequest("https://shop.example.com/", "https://shop.example.com/assets/app.js")).toBe(true);
  expect(isAllowedDynamicRequest("https://www.shop.example.com/", "https://shop.example.com/api/cart")).toBe(true);
  expect(isAllowedDynamicRequest("https://shop.example.com/", "https://cdn.example.net/app.js")).toBe(false);
  expect(isAllowedDynamicRequest("https://shop.example.com/", "http://shop.example.com/app.js")).toBe(false);
  expect(isAllowedDynamicRequest("https://shop.example.com/", "not-a-url")).toBe(false);
});
