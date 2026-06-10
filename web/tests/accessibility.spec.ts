import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

const card = {
  id: "printing-1",
  oracle_id: "oracle-1",
  name: "Arcane Signet",
  mana_cost: "{2}",
  type_line: "Artifact",
  oracle_text: "{T}: Add one mana of any color in your commander's color identity.",
  set: "cmm",
  set_name: "Commander Masters",
  collector_number: "1",
  rarity: "uncommon",
  finishes: ["nonfoil"],
  image_uris: null,
  card_faces: [],
  legalities: { commander: "legal" },
  colors: [],
  color_identity: [],
  cmc: 2,
  prices: {
    usd: "1.00",
    usd_foil: null,
    usd_etched: null,
    eur: null,
    eur_foil: null,
    tix: null,
  },
  released_at: "2023-08-04",
  border_color: "black",
  frame: "2015",
  universes_beyond: false,
};

const cardset = {
  id: "cardset-1",
  quantity: 1,
  zone: "mainboard",
  finish: "nonfoil",
  printing_id: card.id,
  oracle_id: card.oracle_id,
  card_name: card.name,
  set_code: card.set,
  collector_number: card.collector_number,
  tags: [],
  scryfall: card,
};

const commanderCardset = {
  ...cardset,
  id: "cardset-commander",
  zone: "commander",
};

const deck = {
  id: "deck-1",
  title: "Accessible Commander",
  format: "commander",
  description: "A browser-test deck",
  metadata: { kind: "commander", commander_oracle_ids: [] },
  cardsets: [cardset, commanderCardset],
  is_sample: false,
  revision: 0,
  created_at: "2026-06-10T00:00:00Z",
  updated_at: "2026-06-10T00:00:00Z",
};

async function fulfillJson(route: Route, body: object): Promise<void> {
  await route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function mockApi(page: Page): Promise<void> {
  await page.route("http://localhost:8000/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/auth/me") {
      await fulfillJson(route, { username: "local-developer", display_name: "Local Developer" });
    } else if (url.pathname === "/decks") {
      await fulfillJson(route, [deck]);
    } else if (url.pathname === "/decks/deck-1") {
      await fulfillJson(route, deck);
    } else if (url.pathname === "/decks/deck-1/validation") {
      await fulfillJson(route, { valid: true, card_count: 100, errors: [] });
    } else if (url.pathname === "/decks/deck-1/operations") {
      await fulfillJson(route, []);
    } else if (url.pathname === "/decks/deck-1/generate-description") {
      await fulfillJson(route, {
        deck_id: deck.id,
        revision: deck.revision,
        description: "This deck uses [[Arcane Signet]] to develop its mana.",
        cached: false,
      });
    } else if (url.pathname === "/cards/search") {
      await fulfillJson(route, { cards: [card], total_cards: 1, has_more: false });
    } else {
      await route.fulfill({ status: 204 });
    }
  });
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test("deck library has no automatically detectable accessibility violations", async ({ page }) => {
  await page.goto("/decks");
  await expect(page.getByRole("heading", { name: "Your decks" })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();

  expect(results.violations).toEqual([]);
});

test("editor has no automatically detectable accessibility violations", async ({ page }) => {
  await page.goto("/decks/deck-1");
  await expect(page.locator(".deck-readonly-details strong")).toHaveText("Accessible Commander");

  const results = await new AxeBuilder({ page }).analyze();

  expect(results.violations).toEqual([]);
});

test("dialogs close with Escape and restore focus", async ({ page }) => {
  await page.goto("/decks");
  const addDeck = page.getByRole("button", { name: "Add Deck" });
  await addDeck.focus();
  await addDeck.click();
  await expect(page.getByRole("dialog", { name: "Add Deck" })).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(page.getByRole("dialog", { name: "Add Deck" })).toBeHidden();
  await expect(addDeck).toBeFocused();
});

test("valid deck uses an accessible icon-only indicator", async ({ page }) => {
  await page.goto("/decks/deck-1");

  const validation = page.getByLabel("Valid deck, 100 cards");
  await expect(validation).toBeVisible();
  await expect(validation).toContainText("check");
  await expect(validation).not.toContainText("Valid");
});

test("search defaults to the deck format and drawer dismisses with Escape", async ({ page }) => {
  let searchQuery = "";
  await page.route("http://localhost:8000/cards/search", async (route) => {
    const requestBody = route.request().postDataJSON() as { query: string };
    searchQuery = requestBody.query;
    await fulfillJson(route, { cards: [card], total_cards: 1, has_more: false });
  });
  await page.goto("/decks/deck-1");
  const search = page.getByRole("textbox", { name: "Card search" });
  await search.fill("arcane");
  await search.press("Enter");

  await expect(page.getByRole("dialog", { name: "Search results" })).toBeVisible();
  expect(searchQuery).toBe("arcane legal:commander");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Search results" })).toBeHidden();
  await expect(search).toBeFocused();
});

test("generated deck overview is displayed and persisted without a save action", async ({ page }) => {
  let refreshRequested = false;
  await page.route("http://localhost:8000/decks/deck-1/generate-description**", async (route) => {
    refreshRequested = new URL(route.request().url()).searchParams.get("refresh") === "true";
    await fulfillJson(route, {
      deck_id: deck.id,
      revision: deck.revision,
      description: "This deck uses [[Arcane Signet]] to develop its mana.",
      cached: false,
    });
  });
  await page.route("http://localhost:8000/decks/deck-1", async (route) => {
    if (route.request().method() === "PATCH") {
      await fulfillJson(route, {
        ...deck,
        description: "This deck uses [[Arcane Signet]] to develop its mana.",
      });
      return;
    }
    await fulfillJson(route, deck);
  });
  await page.goto("/decks/deck-1");
  await page.getByRole("button", { name: "Deck overview" }).click();
  const dialog = page.getByRole("dialog", { name: "Deck overview" });

  await dialog.getByRole("button", { name: "Refresh overview" }).click();

  const citation = dialog.locator(".card-citation", { hasText: "Arcane Signet" });
  await expect(citation).toHaveText(/Arcane Signet/);
  await expect(dialog.locator(".generated-description")).toContainText("develop its mana.");
  await citation.focus();
  await expect(citation.getByRole("tooltip")).toBeVisible();
  await expect(dialog.getByRole("button", { name: /save/i })).toHaveCount(0);
  expect(refreshRequested).toBe(true);
});

test("command zone is displayed before mainboard", async ({ page }) => {
  await page.goto("/decks/deck-1");
  const zoneHeadings = page.locator(".zone > h2");

  await expect(zoneHeadings.nth(0)).toContainText("Command zone");
  await expect(zoneHeadings.nth(1)).toContainText("Mainboard");
});
