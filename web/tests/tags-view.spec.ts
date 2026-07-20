import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { mockRichApi } from "./richDeckMock";

test("Tags tab filters with OR semantics, hides tags, and shares chart colors", async ({
  page,
}) => {
  await mockRichApi(page);
  await page.goto("/decks/deck-1?tab=tags");

  await expect(
    page.getByRole("heading", { name: "Tags and card assignments" }),
  ).toBeVisible();
  const table = page.getByRole("table");
  await expect(table.getByRole("button", { name: "Name" })).toBeVisible();
  await expect(table.getByRole("button", { name: "Tags" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  const solemnRow = table.getByRole("row", { name: /Solemn Simulacrum/ });
  const solemnTags = await solemnRow
    .locator(".ds-chip-accent")
    .allTextContents();
  expect(solemnTags).toEqual(["card-draw", "ramp"]);
  const rampColor = await solemnRow
    .locator(".ds-chip-accent", { hasText: "ramp" })
    .evaluate((chip) =>
      chip instanceof HTMLElement
        ? chip.style.getPropertyValue("--ds-chip-accent")
        : "",
    );

  await page.getByRole("button", { name: "Filter cards by ramp" }).click();
  await page.getByRole("button", { name: "Filter cards by combo" }).click();
  await expect(solemnRow).toBeVisible();
  await expect(
    table.getByRole("row", { name: /Combat Celebrant/ }),
  ).toBeVisible();
  await expect(
    table.getByRole("row", { name: /Loyal Retainers/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Filter cards by ramp" }).click();
  await page.getByRole("button", { name: "Filter cards by combo" }).click();

  await page.getByText("Shown tags").click();
  await page.getByRole("checkbox", { name: "ramp" }).click();
  await expect(
    page.getByRole("button", { name: "Filter cards by ramp" }),
  ).toHaveCount(0);
  await expect(solemnRow.getByText("ramp", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Charts" }).click();
  const rampBar = page.getByRole("button", { name: "Show cards for ramp" });
  await expect(rampBar).toBeVisible();
  expect(await rampBar.getAttribute("fill")).toBe(rampColor);
});
