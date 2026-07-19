import { expect, test } from "@playwright/test";

import { mockRichApi } from "./richDeckMock";

for (const configuration of [
  { label: "S", limit: 9, size: "small", visibleColumns: 10 },
  { label: "M", limit: 5, size: "medium", visibleColumns: 6 },
  { label: "L", limit: 3, size: "large", visibleColumns: 4 },
] as const) {
  test(`${configuration.label} columns fill one row without horizontal overflow`, async ({
    page,
  }) => {
    await mockRichApi(page, { deckTagLimit: configuration.limit });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(
      `/decks/deck-1?tab=cards&view=grid&group=tags&columns=${configuration.size}`,
    );

    const row = page.locator('[data-zone-scroll="mainboard"]');
    const columns = row.locator(".ds-cards-zone-columns > section");
    await expect(columns).toHaveCount(configuration.visibleColumns);
    const metrics = await row.evaluate((element) => {
      const grid = element.querySelector<HTMLElement>(".ds-cards-zone-columns");
      if (grid === null) throw new Error("Column grid is missing");
      const first = grid.querySelector<HTMLElement>(":scope > section");
      if (first === null) throw new Error("First column is missing");
      return {
        columnGap: getComputedStyle(grid).columnGap,
        columnWidth: first.getBoundingClientRect().width,
        viewportWidth: element.clientWidth,
        overflow: element.scrollWidth - element.clientWidth,
      };
    });
    expect(metrics.columnGap).toBe("0px");
    expect(metrics.overflow).toBeLessThanOrEqual(1);
    expect(metrics.columnWidth).toBeCloseTo(
      metrics.viewportWidth / configuration.visibleColumns,
      0,
    );
  });
}

test("visual cards stay inside percentage columns at responsive widths", async ({
  page,
}) => {
  await mockRichApi(page, { deckTagLimit: 9 });
  for (const width of [701, 1024, 1280, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(
      "/decks/deck-1?tab=cards&view=grid&group=tags&columns=small",
    );
    const columns = page.locator(
      '[data-zone-scroll="mainboard"] .ds-cards-zone-columns > section',
    );
    await expect(columns).toHaveCount(10);
    const fits = await columns.evaluateAll((items) =>
      items.every((column) => {
        const grid = column.querySelector<HTMLElement>(".ds-image-grid");
        if (grid === null) return true;
        const columnBounds = column.getBoundingClientRect();
        const gridBounds = grid.getBoundingClientRect();
        return (
          gridBounds.left >= columnBounds.left - 1 &&
          gridBounds.right <= columnBounds.right + 1
        );
      }),
    );
    expect(fits).toBe(true);
  }
});
