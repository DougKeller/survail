import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { mockRichApi } from "./richDeckMock";

async function openSolemnTagDialog(page: Page) {
  const tile = page
    .locator(".ds-image-tile")
    .filter({
      has: page.getByRole("button", {
        name: "View details for Solemn Simulacrum",
      }),
    })
    .first();
  await tile.hover();
  await tile
    .getByRole("button", {
      name: "Edit tags and weights for Solemn Simulacrum",
    })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Tags for Solemn Simulacrum",
  });
  await expect(dialog).toBeVisible();
  return { dialog, tile };
}

test.beforeEach(async ({ page }) => {
  await mockRichApi(page);
});

test("hover tag editing escapes the card scrollport and remains compact", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/decks/deck-1?tab=cards&view=grid&group=tags");

  const { dialog, tile } = await openSolemnTagDialog(page);
  expect(await tile.getAttribute("draggable")).toBe("true");
  await expect(
    tile.getByRole("button", {
      name: "Move one Solemn Simulacrum from mainboard",
    }),
  ).toHaveCount(0);
  expect(
    await tile.evaluate((element) =>
      element.contains(document.querySelector('[aria-modal="true"]')),
    ),
  ).toBe(false);

  const bounds = await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  if (bounds === null) throw new Error("Tag dialog has no bounds");
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(1280);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(720);
  const bodyScroll = await dialog
    .locator(".ds-dialog-body")
    .evaluate((body) => body.scrollHeight - body.clientHeight);
  expect(bodyScroll).toBeLessThanOrEqual(1);

  const addCombo = dialog.getByRole("button", {
    name: "Add combo tag to Solemn Simulacrum",
  });
  const tagRequest = page.waitForRequest(
    (request) =>
      request.method() === "PUT" && request.url().endsWith("/tags/combo"),
  );
  await addCombo.click();
  await tagRequest;
  await expect(
    dialog.getByRole("button", {
      name: "Remove combo tag from Solemn Simulacrum",
    }),
  ).toBeVisible();

  const weightRequest = page.waitForRequest(
    (request) =>
      request.method() === "PUT" &&
      request.url().endsWith("/tags/ramp") &&
      request.postDataJSON().weight === 0.5,
  );
  await dialog
    .getByRole("group", {
      name: "Weight for Solemn Simulacrum in ramp",
    })
    .getByRole("radio", { name: "½" })
    .click();
  await weightRequest;
  await expect(dialog).toBeVisible();

  const results = await new AxeBuilder({ page })
    .include(".ds-dialog")
    .analyze();
  expect(results.violations).toEqual([]);
});

test("tag dialog has keyboard focus, layered Escape, and focus restoration", async ({
  page,
}) => {
  await page.goto("/decks/deck-1?tab=cards&view=text&group=tags");
  const quickActions = page
    .getByRole("button", {
      name: "Open quick actions for Solemn Simulacrum",
    })
    .first();
  await quickActions.click();
  const quickMenu = page.getByRole("dialog", {
    name: "Solemn Simulacrum quick actions",
  });
  const tagTrigger = quickMenu.getByRole("button", {
    name: "Edit tags and weights for Solemn Simulacrum",
  });
  await tagTrigger.focus();
  await tagTrigger.press("Enter");

  const dialog = page.getByRole("dialog", {
    name: "Tags for Solemn Simulacrum",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Target contribution");
  expect(
    await dialog.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true);

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(quickMenu).toBeVisible();
  await expect(tagTrigger).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(quickMenu).toHaveCount(0);
});

test("tag dialog stays within a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/decks/deck-1?tab=cards&view=grid&group=tags");
  const { dialog } = await openSolemnTagDialog(page);
  const bounds = await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  if (bounds === null) throw new Error("Tag dialog has no bounds");
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
});
