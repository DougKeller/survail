// Screenshot capture used for UI design iterations. Run with
// SCREENSHOT_LABEL=<label> to write labeled PNGs to test-results/ui-screenshots.
import { test } from "@playwright/test";

import { mockRichApi } from "./richDeckMock";

const OUT_DIR = process.env["SCREENSHOT_DIR"] ?? "test-results/ui-screenshots";
const LABEL = process.env["SCREENSHOT_LABEL"] ?? "current";

test.beforeEach(async ({ page }) => {
  await mockRichApi(page);
});

test("library screenshot", async ({ page }) => {
  await page.goto("/decks");
  await page.getByRole("heading", { name: "Your decks" }).waitFor();
  await page.waitForTimeout(750);
  await page.screenshot({ path: `${OUT_DIR}/${LABEL}-library.png` });
});

test("editor stacks screenshot", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/decks/deck-1");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT_DIR}/${LABEL}-editor-stacks.png` });
});

test("editor text view screenshot", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/decks/deck-1");
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Text" }).click();
  await page.waitForTimeout(750);
  await page.screenshot({ path: `${OUT_DIR}/${LABEL}-editor-text.png` });
  await page.screenshot({
    path: `${OUT_DIR}/${LABEL}-editor-text-full.png`,
    fullPage: true,
  });
});
