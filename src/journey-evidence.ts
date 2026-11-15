import type { Locator, Page } from "playwright";
import type { InteractionEvidence } from "./rules";
import type { Stage } from "./demo";

const won = (text: string) => [...text.matchAll(/(?:₩\s*|)(\d[\d,]*)\s*원/g)]
  .map((match) => Number(match[1].replaceAll(",", "")))
  .filter(Number.isFinite);

async function visibleTotal(main: Locator) {
  const preferred = main.locator('[data-total], [class*="total" i], [id*="total" i]').filter({ visible: true });
  const texts = await preferred.allInnerTexts();
  const amounts = texts.flatMap(won);
  return amounts.length ? Math.max(...amounts) : null;
}

/**
 * Reversibly toggles already-selected, visibly priced checkbox options. Radio
 * groups are intentionally left untouched because a selected radio cannot be
 * safely unchecked without choosing a different value; initial radio state is
 * captured by the preselection detector instead.
 */
export async function observePaidOptionChanges(page: Page, main: Locator, stage: Stage): Promise<InteractionEvidence[]> {
  // Keep a stable locator while toggling. A `:checked` locator would stop
  // referring to the control immediately after it is unchecked.
  const controls = main.locator('input[type="checkbox"]');
  const count = Math.min(await controls.count(), 8);
  const evidence: InteractionEvidence[] = [{
    id: `${stage}:initial`, stage, kind: "INITIAL_STATE", capturedAt: new Date().toISOString(), outcome: "OBSERVED",
  }];
  for (let index = 0; index < count; index++) {
    const control = controls.nth(index);
    if (!await control.isVisible() || await control.isDisabled() || !await control.isChecked()) continue;
    const label = await control.evaluate((node: HTMLInputElement) => {
      const labelled = Array.from(node.labels ?? [], (item) => item.innerText.trim()).join(" ");
      if (labelled) return labelled;
      // Unlabelled custom rows: use the closest ancestor text that names an amount.
      for (let current = node.parentElement, depth = 0; current && depth < 4; current = current.parentElement, depth++) {
        const text = current.innerText.trim();
        if (/\d[\d,]*\s*원/.test(text)) return text.slice(0, 300);
      }
      return "";
    });
    if (!won(label).some((amount) => amount > 0)) continue;
    const before = await visibleTotal(main);
    const beforeText = await page.locator("body").innerText().catch(() => "");
    try {
      // Click instead of uncheck(): some shops keep the box checked and open a
      // decline confirmation instead. Record what actually happened; never
      // press a button inside that confirmation.
      await control.click({ timeout: 2_000 });
      await page.waitForTimeout(250);
      const afterSelected = await control.isChecked();
      const revealedText = (await page.locator("body").innerText().catch(() => "")).split("\n")
        .map((line) => line.trim()).filter((line) => line && !beforeText.includes(line)).slice(0, 12);
      if (revealedText.length) await page.keyboard.press("Escape").catch(() => {});
      const after = await visibleTotal(main);
      evidence.push({
        id: `${stage}:paid-option:${index}`, stage, kind: "PAID_OPTION_TOGGLE", capturedAt: new Date().toISOString(),
        controlLabel: label, beforeSelected: true, afterSelected, ...(revealedText.length ? { revealedText } : {}),
        beforeTotalWon: before, afterTotalWon: after,
        amountDeltaWon: before !== null && after !== null ? before - after : null,
        outcome: before !== null && after !== null && before !== after ? "OBSERVED" : "NO_LIVE_CHANGE",
      });
    } catch {
      // Evidence enrichment must never turn a successfully reached purchase
      // stage into a failed journey. Reactive storefronts may replace the
      // checkbox or its modal immediately after the click; the initial checked
      // state remains available in the snapshot even when reversible toggling
      // cannot be completed safely.
    } finally {
      await control.check({ timeout: 2_000 }).catch(() => {});
    }
  }
  return evidence;
}
