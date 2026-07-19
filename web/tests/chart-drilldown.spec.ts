import { expect, test } from "@playwright/test";

import { mockRichApi } from "./richDeckMock";

test("chart bars open exact card lists with pointer and keyboard", async ({
  page,
}) => {
  await mockRichApi(page);
  await page.goto("/decks/deck-1?tab=charts");

  for (const label of ["Creature", "White", "Mana value 4", "ramp", "Aggro"]) {
    await expect(
      page.getByRole("button", { name: `Show cards for ${label}` }),
    ).toBeVisible();
  }

  await page.getByRole("button", { name: "Show cards for ramp" }).click();
  const tagDialog = page.getByRole("dialog", { name: "ramp tag cards" });
  await expect(tagDialog).toContainText("Solemn Simulacrum");
  await expect(tagDialog).not.toContainText("Battlefield Forge");
  await tagDialog.getByRole("button", { name: "Close card list" }).click();

  const manaBar = page.getByRole("button", {
    name: "Show cards for Mana value 4",
  });
  await manaBar.focus();
  await manaBar.press("Enter");
  const manaDialog = page.getByRole("dialog", {
    name: "Mana value 4 mana value cards",
  });
  await expect(manaDialog).toContainText("Solemn Simulacrum");
  await page.keyboard.press("Escape");
  await expect(manaDialog).toHaveCount(0);
  await expect(manaBar).toBeFocused();
});
