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
  await expect(
    table.getByRole("columnheader", { name: "Actions" }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  const solemnRow = table.getByRole("row", { name: /Solemn Simulacrum/ });
  await expect(
    solemnRow.getByRole("button", {
      name: "Tag options for Solemn Simulacrum",
    }),
  ).toBeVisible();
  await expect(
    solemnRow.getByRole("button", { name: "Add note for Solemn Simulacrum" }),
  ).toBeVisible();
  await expect(
    solemnRow.getByRole("button", { name: "Add one Solemn Simulacrum" }),
  ).toBeVisible();
  await solemnRow
    .getByRole("button", { name: "Tag options for Solemn Simulacrum" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Tag options for Solemn Simulacrum" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await solemnRow
    .getByRole("button", { name: "Add note for Solemn Simulacrum" })
    .click();
  await expect(page.getByRole("dialog", { name: "Card note" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  const zones = page.getByRole("group", { name: /Zones/ });
  await zones.getByRole("button", { name: "Select none" }).click();
  await expect(table.getByRole("row")).toHaveCount(1);
  await zones.getByRole("checkbox", { name: "Command zone" }).click();
  await expect(
    table.getByRole("row", { name: /Aurelia, the Warleader/ }),
  ).toBeVisible();
  await expect(solemnRow).toHaveCount(0);
  await zones.getByRole("button", { name: "Select all" }).click();
  await expect(solemnRow).toBeVisible();
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

  const filterMenu = page.locator("details").filter({
    has: page.getByText("Filter cards · match any", { exact: true }),
  });
  await expect(filterMenu.locator(".ds-disclosure-count")).toContainText(
    /^\d+\/\d+$/,
  );
  await filterMenu.getByText("Filter cards · match any", { exact: true }).click();
  await filterMenu.getByRole("button", { name: "Select none" }).click();
  await expect(table.getByRole("row")).toHaveCount(1);
  await filterMenu.getByRole("checkbox", { name: "ramp" }).click();
  await filterMenu.getByRole("checkbox", { name: "combo" }).click();
  await expect(solemnRow).toBeVisible();
  await expect(
    table.getByRole("row", { name: /Combat Celebrant/ }),
  ).toBeVisible();
  await expect(
    table.getByRole("row", { name: /Loyal Retainers/ }),
  ).toHaveCount(0);
  await filterMenu.getByRole("button", { name: "Select all" }).click();

  await page.getByText("Shown tags").click();
  await page.getByRole("checkbox", { name: "ramp" }).click();
  await expect(solemnRow.getByText("ramp", { exact: true })).toHaveCount(0);
  await filterMenu.getByText("Filter cards · match any", { exact: true }).click();
  await expect(filterMenu.getByRole("checkbox", { name: "ramp" })).toBeChecked();

  await page.getByRole("button", { name: "Charts" }).click();
  const rampBar = page.getByRole("button", { name: "Show cards for ramp" });
  await expect(rampBar).toBeVisible();
  expect(await rampBar.getAttribute("fill")).toBe(rampColor);
});
