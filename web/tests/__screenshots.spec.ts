// Screenshot capture used for UI design iterations. Run with
// SCREENSHOT_LABEL=<label> to write labeled PNGs to test-results/ui-screenshots.
import { test } from "@playwright/test";

import judgeReferenceFixture from "./judgeReferenceFixture.json" with { type: "json" };
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

test("design library screenshot", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/design");
  await page.getByRole("heading", { name: "Design library" }).waitFor();
  await page.waitForTimeout(750);
  await page.screenshot({ path: `${OUT_DIR}/${LABEL}-design.png` });
  await page.screenshot({
    path: `${OUT_DIR}/${LABEL}-design-full.png`,
    fullPage: true,
  });
});

test("judge golden screenshot", async ({ page }) => {
  const artifacts = judgeReferenceFixture as Record<string, unknown>;
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.route(
    "http://localhost:8000/evaluations/judge-reference",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(artifacts),
      });
    },
  );
  await page.goto("/judge");
  await page.getByText("target", { exact: false }).first().waitFor();
  await page.waitForTimeout(750);
  await page.screenshot({ path: `${OUT_DIR}/${LABEL}-judge.png` });
  await page.screenshot({
    path: `${OUT_DIR}/${LABEL}-judge-full.png`,
    fullPage: true,
  });
});
