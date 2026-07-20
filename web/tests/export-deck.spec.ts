import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { mockRichApi } from "./richDeckMock";

test("exports a formatted decklist per zone and copies one zone", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://127.0.0.1:4173",
  });
  await mockRichApi(page);
  await page.goto("/decks/deck-1");

  await page.getByRole("button", { name: "More deck actions" }).click();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Export decklist" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox")).toHaveCount(2);

  const commander = dialog.getByRole("textbox", {
    name: "Command zone decklist",
  });
  await expect(commander).toHaveValue("1 Aurelia, the Warleader #wincon");

  const mainboard = dialog.getByRole("textbox", {
    name: "Mainboard decklist",
  });
  await expect(mainboard).toHaveValue(
    /1 Solemn Simulacrum #card-draw #ramp/,
  );
  expect(await mainboard.inputValue()).not.toContain("(CMM)");

  await dialog
    .getByRole("button", { name: "Copy Mainboard decklist" })
    .click();
  await expect(dialog.getByText("Copied Mainboard decklist.")).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("1 Solemn Simulacrum #card-draw #ramp");

  expect(
    (await new AxeBuilder({ page }).include(".ds-dialog").analyze()).violations,
  ).toEqual([]);
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);
});
