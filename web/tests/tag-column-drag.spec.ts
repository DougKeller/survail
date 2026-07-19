import { expect, test } from "@playwright/test";

import { mockRichApi } from "./richDeckMock";

test("dragging between tag columns adds the destination tag", async ({
  page,
}) => {
  await mockRichApi(page);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/decks/deck-1?tab=cards&view=grid&group=tags");

  const ramp = page.locator('section[aria-label^="ramp,"]').first();
  const destination = page.locator('section[aria-label^="blocker,"]').first();
  const source = ramp.locator("[data-cardset-id]").first();
  await expect(source).toBeVisible();
  await expect(destination).toBeVisible();
  const cardsetId = await source.getAttribute("data-cardset-id");
  expect(cardsetId).not.toBeNull();
  if (cardsetId === null) throw new Error("Dragged cardset id is missing");

  const mutation = page.waitForRequest((request) =>
    request.url().endsWith(`/decks/deck-1/cardsets/${cardsetId}/tags/blocker`),
  );
  await source.dragTo(destination);
  await mutation;

  await expect(
    destination.locator(`[data-cardset-id="${cardsetId}"]`),
  ).toBeVisible();
  await expect(source).toBeVisible();
});
