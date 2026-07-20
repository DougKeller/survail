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
  const destinationTagId = await destination.getAttribute(
    "data-reorder-tag-id",
  );
  expect(cardsetId).not.toBeNull();
  expect(destinationTagId).toMatch(/^[0-9a-f-]{36}$/);
  if (cardsetId === null || destinationTagId === null)
    throw new Error("Dragged cardset or destination tag id is missing");

  const mutation = page.waitForRequest((request) =>
    request
      .url()
      .endsWith(
        `/decks/deck-1/cardsets/${cardsetId}/tags/${destinationTagId}`,
      ),
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
  await mockRichApi(page, { format: "modern" });
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/decks/deck-1?tab=cards&view=grid&group=tags");

  const blockerHandle = page
    .getByRole("button", { name: "Move blocker tag column" })
    .first();
  const rampColumn = page.locator('[data-zone-scroll="mainboard"] section', {
    has: page.getByRole("heading", { name: "ramp", exact: true }),
  });
  const sourceBox = await blockerHandle.boundingBox();
  const targetBox = await rampColumn.boundingBox();
  const rampId = await rampColumn.getAttribute("data-reorder-tag-id");
  const blockerId = await blockerHandle.evaluate(
    (handle) =>
      handle.closest<HTMLElement>("[data-reorder-tag-id]")?.dataset[
        "reorderTagId"
      ] ?? null,
  );
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  expect(rampId).toMatch(/^[0-9a-f-]{36}$/);
  expect(blockerId).toMatch(/^[0-9a-f-]{36}$/);
  if (sourceBox === null || targetBox === null)
    throw new Error("Tag reorder controls are missing");
  const targetPoint = {
    x: targetBox.x + targetBox.width - 4,
    y: targetBox.y + 80,
  };
  expect(
    await page.evaluate(
      ({ x, y }) =>
        document
          .elementFromPoint(x, y)
          ?.closest<HTMLElement>("[data-reorder-tag-id]")?.dataset[
          "reorderTagId"
        ],
      targetPoint,
    ),
  ).toBe(rampId);
  const mutation = page.waitForRequest(
    (request) =>
      request.method() === "PUT" &&
      request.url().endsWith("/decks/deck-1/tags/order"),
  );
  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(targetPoint.x, targetPoint.y, { steps: 12 });
  await expect(blockerHandle).toHaveAttribute("aria-pressed", "true");
  await page.mouse.up();
  const request = await mutation;
  const payload = request.postDataJSON() as { tag_ids: string[] };
  expect(payload.tag_ids.indexOf(rampId ?? "")).toBeLessThan(
    payload.tag_ids.indexOf(blockerId ?? ""),
  );

  for (const zone of [
    "Mainboard cards",
    "Sideboard cards",
    "Considering cards",
  ]) {
    await expect
      .poll(async () => {
        const labels = await page
          .locator(`[role="region"][aria-label="${zone}"]`)
          .locator(".ds-cards-zone-columns > section")
          .evaluateAll((columns) =>
            columns.map((column) => column.getAttribute("aria-label")),
          );
        return {
          rampBeforeBlocker:
            labels.findIndex((label) => label?.startsWith("ramp,")) <
            labels.findIndex((label) => label?.startsWith("blocker,")),
          untaggedFirst: labels[0]?.startsWith("Untagged,") === true,
        };
      })
      .toEqual({ rampBeforeBlocker: true, untaggedFirst: true });
  }
});

test("tag columns support keyboard persistence and keep Untagged pinned", async ({
  page,
}) => {
  await mockRichApi(page);
  await page.goto("/decks/deck-1?tab=cards&view=grid&group=tags");
  const handle = page
    .getByRole("button", { name: "Move blocker tag column" })
    .first();
  const mutation = page.waitForRequest((request) =>
    request.url().endsWith("/decks/deck-1/tags/order"),
  );
  await handle.focus();
  await handle.press("ArrowRight");
  await mutation;
  await expect(handle).toBeFocused();
  await page.reload();

  const columns = page.locator(
    '[data-zone-scroll="mainboard"] .ds-cards-zone-columns > section',
  );
  await expect(columns.first()).toBeVisible();
  const labels = await columns.evaluateAll((items) =>
    items.map((column) => column.getAttribute("aria-label")),
  );
  expect(labels[0]).toMatch(/^Untagged,/);
  expect(labels.findIndex((label) => label?.startsWith("ramp,"))).toBeLessThan(
    labels.findIndex((label) => label?.startsWith("blocker,")),
  );
  await expect(
    page.getByRole("button", { name: /Move Untagged tag column/ }),
  ).toHaveCount(0);
});

test("tag column header separates move, title, and options", async ({
  page,
}) => {
  await mockRichApi(page);
  await page.goto("/decks/deck-1?tab=cards&view=grid&group=tags");
  const column = page.locator('[data-zone-scroll="mainboard"] section', {
    has: page.getByRole("heading", { name: "ramp", exact: true }),
  });
  const move = column.getByRole("button", {
    name: "Move ramp tag column",
  });
  const options = column.getByRole("button", {
    name: "Options for ramp tag column",
  });
  const [moveBox, optionsBox] = await Promise.all([
    move.boundingBox(),
    options.boundingBox(),
  ]);
  expect(moveBox).not.toBeNull();
  expect(optionsBox).not.toBeNull();
  if (moveBox === null || optionsBox === null)
    throw new Error("Column header controls are missing");
  expect(moveBox.x).toBeLessThan(optionsBox.x);
  await expect(
    column.getByRole("button", { name: "Edit ramp tag" }),
  ).toHaveCount(0);
  await expect(
    column.getByRole("button", { name: "Delete ramp tag" }),
  ).toHaveCount(0);

  await options.click();
  const menu = column.getByRole("menu");
  await expect(menu.getByRole("menuitem")).toHaveCount(2);
  await expect(menu.getByRole("menuitem", { name: "Edit tag" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(options).toBeFocused();
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
  const rowStyle = await row.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      borderRadius: style.borderRadius,
      paddingBlock: parseFloat(style.paddingBlockStart),
      paddingInline: parseFloat(style.paddingInlineStart),
    };
  });
  expect(rowStyle.borderRadius).toBe("0px");
  expect(rowStyle.paddingBlock).toBeLessThanOrEqual(2);
  expect(rowStyle.paddingInline).toBeLessThanOrEqual(4);
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
      name: "Tag options for Solemn Simulacrum",
    }),
  ).toBeVisible();
  await expect(
    menu.getByRole("button", {
      name: "Remove ramp tag from Solemn Simulacrum",
    }),
  ).toBeVisible();
});
