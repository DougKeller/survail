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

test("dragging tag headers reorders that column in every zone", async ({
  page,
}) => {
  await mockRichApi(page);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/decks/deck-1?tab=cards&view=grid&group=tags");

  const blockerHandle = page
    .getByRole("button", { name: "Move blocker tag column" })
    .first();
  const rampHandle = page
    .getByRole("button", { name: "Move ramp tag column" })
    .first();
  const rampHeader = rampHandle.locator("..");
  const rampBox = await rampHeader.boundingBox();
  expect(rampBox).not.toBeNull();
  if (rampBox === null) throw new Error("Ramp header is missing");
  const mutation = page.waitForRequest(
    (request) =>
      request.method() === "PUT" &&
      request.url().endsWith("/decks/deck-1/tags/order"),
  );
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await blockerHandle.dispatchEvent("dragstart", { dataTransfer: transfer });
  const dragPosition = {
    clientX: rampBox.x + rampBox.width - 2,
    clientY: rampBox.y + rampBox.height / 2,
    dataTransfer: transfer,
  };
  await rampHeader.dispatchEvent("dragenter", dragPosition);
  await rampHeader.dispatchEvent("dragover", dragPosition);
  await rampHeader.dispatchEvent("drop", dragPosition);
  await blockerHandle.dispatchEvent("dragend", { dataTransfer: transfer });
  await mutation;

  for (const zone of ["Mainboard cards", "Considering cards"]) {
    const labels = await page
      .locator(`[role="region"][aria-label="${zone}"]`)
      .locator(".ds-cards-zone-columns > section")
      .evaluateAll((columns) =>
        columns.map((column) => column.getAttribute("aria-label")),
      );
    expect(labels[0]).toMatch(/^Untagged,/);
    expect(
      labels.findIndex((label) => label?.startsWith("ramp,")),
    ).toBeLessThan(labels.findIndex((label) => label?.startsWith("blocker,")));
  }
});

test("text tag actions stay in the quick menu and the move handle leads", async ({
  page,
}) => {
  await mockRichApi(page);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/decks/deck-1?tab=cards&view=text&group=tags");

  const row = page
    .locator('section[aria-label^="ramp,"] .ds-card-row', {
      hasText: "Solemn Simulacrum",
    })
    .first();
  await expect(row).toBeVisible();
  expect(
    await row.evaluate((element) =>
      element.firstElementChild?.classList.contains(
        "ds-card-row-leading-action",
      ),
    ),
  ).toBe(true);
  await expect(
    row.getByRole("button", {
      name: "Move one Solemn Simulacrum from mainboard",
    }),
  ).toBeVisible();
  await expect(
    row.getByRole("button", {
      name: "Edit tags and weights for Solemn Simulacrum",
    }),
  ).toHaveCount(0);

  await row
    .getByRole("button", {
      name: "Open quick actions for Solemn Simulacrum",
    })
    .click();
  const menu = page.getByRole("dialog", {
    name: "Solemn Simulacrum quick actions",
  });
  await expect(
    menu.getByRole("button", {
      name: "Edit tags and weights for Solemn Simulacrum",
    }),
  ).toBeVisible();
  await expect(
    menu.getByRole("button", {
      name: "Remove ramp tag from Solemn Simulacrum",
    }),
  ).toBeVisible();
});
