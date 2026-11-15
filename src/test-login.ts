import type { Locator, Page } from "playwright";

import type { TestCredentials } from "./credential-vault";

export async function clickAndWaitForChange(page: Page, action: Locator, timeoutMs = 1_200) {
  const beforeUrl = page.url();
  const beforeText = await page.locator("body").innerText().catch(() => "");
  await action.click({ timeout: 3_000 });
  const changed = await page.waitForFunction(({ url, text }) => location.href !== url || (document.body?.innerText ?? "") !== text,
    { url: beforeUrl, text: beforeText }, { timeout: timeoutMs }).then(() => true).catch(() => false);
  if (changed && page.url() !== beforeUrl) await page.waitForLoadState("domcontentloaded", { timeout: 1_500 }).catch(() => {});
}

const loginName = /로그인|sign\s*in|log\s*in/i;

/** Reveal the login form. Many storefronts keep it inside a modal opened by one
 * header action; open only an unambiguous control and never guess among several. */
export async function openLoginForm(page: Page) {
  if (!await page.locator('input[type="password"]:visible').count()) {
    const loginControl = page.getByRole("button", { name: loginName }).or(page.getByRole("link", { name: loginName }));
    if (await loginControl.count() === 1) await clickAndWaitForChange(page, loginControl);
  }
  return await page.locator('input[type="password"]:visible').count() > 0;
}

/** Submit an already visible login form. Throws when the form stays visible. */
export async function submitLoginForm(page: Page, credentials: TestCredentials) {
  const password = page.locator('input[type="password"]:visible').first();
  const userField = page.locator('input[type="email"], input[name*="id" i], input[name*="user" i], input[name*="login" i], input[autocomplete="username"]').filter({ visible: true }).first();
  if (!await userField.count()) throw new Error("로그인 아이디 입력란을 찾지 못했습니다.");
  await userField.fill(credentials.username);
  await password.fill(credentials.password);
  // The header login trigger often remains in the DOM while the modal is
  // open. Restrict submission to visible controls so we do not click the
  // trigger a second time or reject an otherwise unambiguous form.
  let submit = page.locator('form:visible button[type="submit"], form:visible input[type="submit"], button[type="submit"]:visible, input[type="submit"]:visible');
  if (await submit.count() === 0) submit = page.locator("button:visible").filter({ hasText: loginName });
  if (await submit.count() !== 1) throw new Error("로그인 버튼을 하나로 확정하지 못했습니다.");
  await Promise.all([
    page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => {}),
    submit.click(),
  ]);
  await password.waitFor({ state: "hidden", timeout: 2_000 }).catch(() => {});
  if (await page.locator('input[type="password"]:visible').count()) throw new Error("로그인에 실패했거나 추가 인증이 필요합니다.");
}

/** A freshly loaded page still offers a plain login entry and no logout: the
 * session did not survive navigation (for example in-memory SPA auth state). */
export async function looksLoggedOut(page: Page) {
  const visible = (name: RegExp) => page.getByRole("button", { name }).or(page.getByRole("link", { name })).filter({ visible: true }).count();
  if (await visible(/로그아웃|log\s*out|sign\s*out/i)) return false;
  return await page.locator('input[type="password"]:visible').count() > 0 || await visible(/^\s*(?:로그인|log\s*in|sign\s*in)\s*$/i) > 0;
}
