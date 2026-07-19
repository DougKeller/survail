import { expect, test } from "@playwright/test";

import { mockRichApi } from "./richDeckMock";

interface CardsBenchmarkResult {
  duration: number;
  longTaskCount: number;
  longestTask: number;
  renderedCards: number;
}

test("large Cards view interaction benchmark stays responsive", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const durations: number[] = [];
    Object.defineProperty(window, "__survailLongTasks", { value: durations });
    new PerformanceObserver((entries) => {
      for (const entry of entries.getEntries()) durations.push(entry.duration);
    }).observe({ entryTypes: ["longtask"] });
  });
  await mockRichApi(page, { cardsetMultiplier: 6 });
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/decks/deck-1?tab=cards&view=grid&group=type");
  await expect(page.locator("[data-cardset-id]").first()).toBeVisible();

  const renderedCards = await page.locator("[data-cardset-id]").count();
  await page.evaluate(() => {
    (
      window as unknown as Window & { __survailLongTasks: number[] }
    ).__survailLongTasks.splice(0);
  });
  const started = await page.evaluate(() => performance.now());
  const groupBy = page.getByLabel("Group by");
  for (const group of ["color", "mana-value", "type", "color", "type"]) {
    await groupBy.selectOption(group);
  }
  await page.getByRole("button", { name: "Text" }).click();
  await page.getByRole("button", { name: "Grid" }).click();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => {
          resolve();
        }),
      ),
  );

  const result = await page.evaluate(
    ({ benchmarkStarted, count }): CardsBenchmarkResult => {
      const tasks = (
        window as unknown as Window & { __survailLongTasks: number[] }
      ).__survailLongTasks;
      return {
        duration: performance.now() - benchmarkStarted,
        longTaskCount: tasks.length,
        longestTask: Math.max(0, ...tasks),
        renderedCards: count,
      };
    },
    { benchmarkStarted: started, count: renderedCards },
  );

  test.info().annotations.push({
    type: "benchmark",
    description: JSON.stringify(result),
  });
  expect(result.renderedCards).toBeGreaterThanOrEqual(250);
  expect(result.duration).toBeLessThan(2500);
  // This is a broad regression ceiling; the printed browser timing is the
  // benchmark result used for before/after comparisons across environments.
  expect(result.longestTask).toBeLessThan(500);
});
