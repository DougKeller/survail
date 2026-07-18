// Experience contract for the deck editor, grounded in Laws of UX and the
// Organic design direction (Deck Builder wireframes; docs/design/).
// These tests encode the experience as executable assertions: warm Organic
// ground with Caprasimo/Figtree, a data-dense board of pill card rows, an
// always-informative right rail, and instant quick actions. If one fails,
// the experience regressed — not just a style.
import { expect, test, type Page } from "@playwright/test";

import { mockRichApi } from "./richDeckMock";

test.beforeEach(async ({ page }) => {
  await mockRichApi(page);
});

async function openBoard(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/decks/deck-1");
  await page.getByRole("button", { name: "Text" }).click();
  await expect(page.locator(".ds-card-row").first()).toBeVisible();
}

test("cognitive load: a 100-card deck reads as a dense board — 25+ rows in view, single-fixation tall", async ({
  page,
}) => {
  await openBoard(page);
  const rows = await page.locator(".ds-card-row").all();
  let visible = 0;
  for (const row of rows) {
    const box = await row.boundingBox();
    if (box !== null && box.y >= 0 && box.y + box.height <= 1000) visible += 1;
  }
  expect(visible).toBeGreaterThanOrEqual(25);

  const sample = await page
    .locator(".ds-card-row", { hasText: "Deflecting Swat" })
    .boundingBox();
  expect(sample).not.toBeNull();
  if (sample !== null) expect(sample.height).toBeLessThanOrEqual(44);
});

test("chunking: quantity and mana cost live inline — no clicks to read the list", async ({
  page,
}) => {
  await openBoard(page);
  await expect(
    page
      .locator(".ds-card-row", { hasText: "Plains" })
      .locator(".ds-card-row-qty"),
  ).toHaveText("12");
  await expect(
    page
      .locator(".ds-card-row", { hasText: "Deflecting Swat" })
      .getByRole("img", { name: /Mana cost/ }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("aesthetic-usability: the Organic ground — warm ground, Caprasimo headings, pill rows", async ({
  page,
}) => {
  await openBoard(page);
  const styles = await page.evaluate(() => {
    const row = document.querySelector(".ds-card-row");
    const brand = document.querySelector(".ds-nav-brand");
    if (row === null || brand === null) throw new Error("Missing anchors");
    return {
      ground: getComputedStyle(document.body).backgroundColor,
      bodyFont: getComputedStyle(document.body).fontFamily,
      brandFont: getComputedStyle(brand).fontFamily,
      rowRadius: parseFloat(getComputedStyle(row).borderRadius),
    };
  });
  expect(styles.ground).toBe("rgb(245, 234, 216)");
  expect(styles.bodyFont).toContain("Figtree");
  expect(styles.brandFont).toContain("Caprasimo");
  expect(styles.rowRadius).toBeGreaterThanOrEqual(99);
});

test("doherty threshold: quick actions open in one click and dismiss instantly", async ({
  page,
}) => {
  await openBoard(page);
  const caret = page.getByRole("button", {
    name: "Open quick actions for Deflecting Swat",
  });
  await caret.click();
  const popover = page.getByRole("dialog", {
    name: "Deflecting Swat quick actions",
  });
  await expect(popover).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(popover).toHaveCount(0);

  await caret.click();
  await expect(popover).toBeVisible();
  await page.getByRole("heading", { name: "Command zone" }).click();
  await expect(popover).toHaveCount(0);
});

test("selective attention: the rail keeps deck health in view — completion, curve, identity, legality", async ({
  page,
}) => {
  await openBoard(page);
  await expect(page.getByRole("progressbar").first()).toBeVisible();
  await expect(page.getByText("Deck completion")).toBeVisible();
  await expect(page.getByText("Mana curve")).toBeVisible();
  await expect(page.getByText("Color identity")).toBeVisible();
  await expect(page.getByText(/Legal · 70 \/ 100/)).toBeVisible();
});

test("flow: the page never scrolls sideways — the board scrolls inside itself", async ({
  page,
}) => {
  for (const width of [1600, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/decks/deck-1");
    await page.getByRole("button", { name: "Text" }).click();
    await expect(page.locator(".ds-card-row").first()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  }
});
