import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type Page,
  type Route,
  type TestInfo,
} from "@playwright/test";
import type { CardSet, Deck } from "../src/modules/decks/contracts";

const card = {
  id: "printing-1",
  oracle_id: "oracle-1",
  name: "Arcane Signet",
  mana_cost: "{2}",
  type_line: "Artifact",
  oracle_text:
    "{T}: Add one mana of any color in your commander's color identity.",
  set: "cmm",
  set_name: "Commander Masters",
  collector_number: "1",
  rarity: "uncommon",
  finishes: ["nonfoil"],
  image_uris: {
    normal:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='488' height='680'%3E%3C/svg%3E",
  },
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

const secondCard = {
  ...card,
  id: "printing-2",
  oracle_id: "oracle-2",
  name: "Sol Ring",
  mana_cost: "{1}",
  oracle_text: "{T}: Add {C}{C}.",
  collector_number: "2",
  cmc: 1,
};

const cardset: CardSet = {
  id: "cardset-1",
  quantity: 2,
  zone: "mainboard",
  finish: "nonfoil",
  printing_id: card.id,
  oracle_id: card.oracle_id,
  card_name: card.name,
  set_code: card.set,
  collector_number: card.collector_number,
  core: false,
  note: "",
  tags: [],
  scryfall: card,
};

const commanderCardset: CardSet = {
  ...cardset,
  quantity: 1,
  id: "cardset-commander",
  printing_id: secondCard.id,
  oracle_id: secondCard.oracle_id,
  card_name: secondCard.name,
  collector_number: secondCard.collector_number,
  scryfall: secondCard,
  zone: "commander",
};

const secondCardset: CardSet = {
  ...commanderCardset,
  id: "cardset-2",
  zone: "mainboard",
};

const deck = {
  id: "deck-1",
  title: "Accessible Commander",
  format: "commander",
  description: "A browser-test deck",
  generated_description: null,
  goal: "Cast the commander quickly and protect the winning turn.",
  metadata: { kind: "commander", commander_oracle_ids: [] },
  cardsets: [cardset, secondCardset, commanderCardset],
  is_sample: false,
  revision: 0,
  created_at: "2026-06-10T00:00:00Z",
  updated_at: "2026-06-10T00:00:00Z",
} satisfies Deck & { created_at: string };

const operation = {
  id: "operation-1",
  deck_id: deck.id,
  actor_id: "user-1",
  client_operation_id: "client-1",
  reason: "Added interaction",
  revision_before: 0,
  revision_after: 1,
  created_at: "2026-06-10T00:00:00Z",
  changes: [
    {
      printing_id: card.id,
      oracle_id: card.oracle_id,
      card_name: card.name,
      set_code: card.set,
      collector_number: card.collector_number,
      quantity_delta: 1,
      quantity_before: 0,
      quantity_after: 1,
      zone: "mainboard",
      finish: "nonfoil",
      tags_before: [],
      tags_after: [],
    },
  ],
};

const secondCardScore = {
  oracle_id: secondCard.oracle_id,
  deck_revision: deck.revision,
  evaluator_version: "roles-v2",
  overall_score: 90,
  overall_comment: "An efficient source of acceleration for this deck.",
  roles: [
    {
      role: "mana_ramp",
      score: 90,
      description: "Provides fast acceleration at low cost.",
      answers: [{ criterion_id: "speed", rating: "very_high", score: 100 }],
    },
  ],
  cached: false,
};

const cardScore = {
  oracle_id: card.oracle_id,
  deck_revision: deck.revision,
  evaluator_version: "roles-v2",
  overall_score: 60,
  overall_comment: "A serviceable but replaceable source of acceleration.",
  roles: [
    {
      role: "mana_ramp",
      score: 60,
      description: "Accelerates mana, but without the same speed or burst.",
      answers: [{ criterion_id: "speed", rating: "neutral", score: 50 }],
    },
  ],
  cached: false,
};

const scores = [secondCardScore, cardScore];
const cachedScores = [secondCardScore];

async function fulfillJson(route: Route, body: object): Promise<void> {
  await route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function fulfillAgentStream(
  route: Route,
  message: string,
): Promise<void> {
  const runId = "run-1";
  const events = [
    {
      type: "run_started",
      run_id: runId,
      payload: { message: "Thinking about your deck" },
    },
    { type: "assistant_completed", run_id: runId, payload: { message } },
    { type: "run_completed", run_id: runId, payload: {} },
  ];
  await route.fulfill({
    contentType: "text/event-stream",
    body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
  });
}

function cloneDeckState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function mockApi(page: Page): Promise<void> {
  let currentDeck: Deck = cloneDeckState(deck);

  function currentValidation() {
    return {
      valid: true,
      card_count: currentDeck.cardsets.reduce(
        (total, cardset) => total + cardset.quantity,
        0,
      ),
      errors: [],
    };
  }

  await page.route("http://localhost:8000/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/auth/me") {
      await fulfillJson(route, {
        username: "local-developer",
        display_name: "Local Developer",
      });
    } else if (url.pathname === "/decks") {
      await fulfillJson(route, [deck]);
    } else if (url.pathname === "/decks/deck-1") {
      await fulfillJson(route, currentDeck);
    } else if (url.pathname === "/decks/deck-1/validation") {
      await fulfillJson(route, currentValidation());
    } else if (
      url.pathname === "/decks/deck-1/card-evaluations/current/cached"
    ) {
      await fulfillJson(route, cachedScores);
    } else if (
      url.pathname === "/decks/deck-1/card-evaluations/current/stream"
    ) {
      await route.fulfill({
        contentType: "text/event-stream",
        body: [
          {
            type: "progress",
            payload: {
              completed: 0,
              total: 3,
              average_seconds_per_card: null,
              eta_seconds: null,
            },
          },
          {
            type: "progress",
            payload: {
              completed: 3,
              total: 3,
              average_seconds_per_card: 1.5,
              eta_seconds: 0,
            },
          },
          { type: "completed", payload: { results: scores } },
        ]
          .map((event) => `data: ${JSON.stringify(event)}\n\n`)
          .join(""),
      });
    } else if (url.pathname === "/decks/deck-1/card-evaluations/evaluate") {
      const payload = route.request().postDataJSON() as {
        oracle_ids?: string[];
      };
      const oracleIds = payload.oracle_ids ?? [];
      await fulfillJson(
        route,
        oracleIds
          .map((oracleId) => {
            if (oracleId === card.oracle_id) return cardScore;
            if (oracleId === secondCard.oracle_id) return secondCardScore;
            return null;
          })
          .filter((score): score is typeof cardScore => score !== null),
      );
    } else if (url.pathname === "/decks/deck-1/cardsets/cardset-1/core") {
      const payload = route.request().postDataJSON() as { core: boolean };
      currentDeck = {
        ...currentDeck,
        cardsets: currentDeck.cardsets.map((entry) =>
          entry.id === "cardset-1" ? { ...entry, core: payload.core } : entry,
        ),
      };
      await fulfillJson(route, currentDeck);
    } else if (url.pathname === "/decks/deck-1/cardsets/cardset-1/note") {
      const payload = route.request().postDataJSON() as { note: string };
      currentDeck = {
        ...currentDeck,
        cardsets: currentDeck.cardsets.map((entry) =>
          entry.id === "cardset-1" ? { ...entry, note: payload.note } : entry,
        ),
      };
      await fulfillJson(route, currentDeck);
    } else if (url.pathname === "/decks/deck-1/operations") {
      if (route.request().method() === "POST") {
        const payload = route.request().postDataJSON() as {
          reason?: string;
          changes: {
            printing_id: string;
            quantity_delta: number;
            zone: CardSet["zone"];
            finish: CardSet["finish"];
            note?: string;
            tags?: string[];
          }[];
        };
        let nextCardsets = [...currentDeck.cardsets];
        const operationChanges = payload.changes.map((change, index) => {
          const cardsetIndex = nextCardsets.findIndex(
            (entry) =>
              entry.printing_id === change.printing_id &&
              entry.zone === change.zone &&
              entry.finish === change.finish,
          );
          const existing = cardsetIndex >= 0 ? nextCardsets[cardsetIndex] : undefined;
          const source =
            existing ??
            currentDeck.cardsets.find(
              (entry) => entry.printing_id === change.printing_id,
            );
          if (source === undefined) {
            throw new Error(`Missing cardset fixture for ${change.printing_id}`);
          }
          const quantityBefore = existing?.quantity ?? 0;
          const quantityAfter = quantityBefore + change.quantity_delta;

          if (quantityAfter <= 0) {
            if (cardsetIndex >= 0) nextCardsets.splice(cardsetIndex, 1);
          } else if (existing === undefined) {
            nextCardsets = nextCardsets.concat({
              ...source,
              id: `cardset-new-${String(index)}`,
              quantity: quantityAfter,
              zone: change.zone,
              finish: change.finish,
              note: change.note ?? source.note,
              tags: change.tags ?? source.tags,
            });
          } else {
            nextCardsets[cardsetIndex] = {
              ...existing,
              quantity: quantityAfter,
              note: change.note ?? existing.note,
              tags: change.tags ?? existing.tags,
            };
          }

          return {
            printing_id: source.printing_id,
            oracle_id: source.oracle_id,
            card_name: source.card_name,
            set_code: source.set_code,
            collector_number: source.collector_number,
            quantity_delta: change.quantity_delta,
            quantity_before: quantityBefore,
            quantity_after: Math.max(quantityAfter, 0),
            zone: change.zone,
            finish: change.finish,
            tags_before: existing?.tags ?? [],
            tags_after:
              quantityAfter <= 0
                ? []
                : (change.tags ?? existing?.tags ?? source.tags),
          };
        });
        currentDeck = {
          ...currentDeck,
          revision: currentDeck.revision + 1,
          cardsets: nextCardsets,
        };
        await fulfillJson(route, {
          operation: {
            ...operation,
            reason: payload.reason ?? null,
            revision_before: currentDeck.revision - 1,
            revision_after: currentDeck.revision,
            changes: operationChanges,
          },
          deck: currentDeck,
          validation: currentValidation(),
        });
      } else {
        await fulfillJson(route, []);
      }
    } else if (url.pathname === "/decks/deck-1/generate-description") {
      await fulfillJson(route, {
        deck_id: deck.id,
        revision: deck.revision,
        description: {
          overview: "This deck uses [[Arcane Signet]] to develop its mana.",
          early_game: "Develop mana.",
          midgame: "Cast the commander.",
          lategame: "Protect the winning turn.",
        },
        cached: false,
      });
    } else if (
      url.pathname === `/decks/deck-1/card-evaluations/oracle/${card.oracle_id}`
    ) {
      await fulfillJson(route, cardScore);
    } else if (
      url.pathname ===
      `/decks/deck-1/card-evaluations/oracle/${secondCard.oracle_id}`
    ) {
      await fulfillJson(route, secondCardScore);
    } else if (url.pathname === "/cards/search") {
      await fulfillJson(route, {
        cards: [card],
        total_cards: 1,
        has_more: false,
      });
    } else if (url.pathname === "/decks/deck-1/conversations") {
      await fulfillJson(route, {
        id: "conversation-1",
        deck_id: deck.id,
        created_at: "2026-06-10T00:00:00Z",
        updated_at: "2026-06-10T00:00:00Z",
      });
    } else if (
      url.pathname === "/decks/deck-1/conversations/conversation-1/messages"
    ) {
      await fulfillAgentStream(
        route,
        "This deck develops mana and casts its commander.",
      );
    } else {
      await route.fulfill({ status: 204 });
    }
  });
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test.afterEach(async ({ page }, testInfo: TestInfo) => {
  if (page.isClosed()) return;
  await page.screenshot({
    path: testInfo.outputPath("core-ux.png"),
    fullPage: true,
  });
});

test("deck library has no automatically detectable accessibility violations", async ({
  page,
}) => {
  await page.goto("/decks");
  await expect(page.getByRole("heading", { name: "Your decks" })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();

  expect(results.violations).toEqual([]);
});

test("dashboard and import are separate primary destinations", async ({
  page,
}) => {
  await page.goto("/decks");
  await expect(page.getByRole("heading", { name: "Your decks" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Import Moxfield decklist" }),
  ).toHaveCount(0);

  await page.getByRole("link", { name: "Import" }).click();

  await expect(page).toHaveURL(/\/import$/);
  const importHeading = page.getByRole("heading", { name: "Import a deck" });
  await expect(importHeading).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Import Moxfield decklist" }),
  ).toBeVisible();
  const headerBox = await page.locator("body > div > header").boundingBox();
  const headingBox = await importHeading.boundingBox();
  expect(headerBox).not.toBeNull();
  expect(headingBox).not.toBeNull();
  expect(headingBox?.y ?? 0).toBeGreaterThanOrEqual(
    (headerBox?.y ?? 0) + (headerBox?.height ?? 0),
  );
});

test("editor has no automatically detectable accessibility violations", async ({
  page,
}) => {
  await page.goto("/decks/deck-1");
  await expect(page.locator(".deck-readonly-details strong")).toHaveText(
    "Accessible Commander",
  );

  const results = await new AxeBuilder({ page }).analyze();

  expect(results.violations).toEqual([]);
});

test("editor opens with primary views, contextual card controls, and integrated advisor", async ({
  page,
}) => {
  await page.goto("/decks/deck-1");

  const advisor = page.locator("aside.agent-drawer");
  const appBar = page.getByLabel("Deck controls");
  const toolbar = page.getByLabel("Card display controls");
  await expect(advisor).toBeVisible();
  await expect(appBar).toBeVisible();
  await expect(toolbar).toBeVisible();
  await expect(toolbar.getByLabel("Card search")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Deck views" }),
  ).toContainText("Cards");
  await expect(
    page.getByRole("navigation", { name: "Deck views" }),
  ).toContainText("Scores");
  await expect(
    page.getByRole("navigation", { name: "Deck views" }),
  ).toContainText("Info");
  await expect(toolbar.getByRole("button", { name: "Stacks" })).toBeVisible();
  await expect(toolbar.getByLabel("Group by")).toBeVisible();
  await expect(toolbar.getByLabel("Card sort")).toBeVisible();
  await expect(
    toolbar.getByRole("radio", { name: "Mainboard" }),
  ).toBeChecked();
  await expect(
    toolbar.getByRole("radio", { name: "Commander" }),
  ).toBeVisible();
  await expect(
    toolbar.getByRole("radio", { name: "Considering" }),
  ).toBeVisible();
  expect(
    await toolbar.evaluate((element) => getComputedStyle(element).position),
  ).toBe("sticky");
  await expect(page.locator("footer.deck-footer")).toHaveCount(0);
});

test("advisor is keyboard resizable and remembers its width", async ({
  page,
}) => {
  await page.goto("/decks/deck-1");
  const separator = page.getByRole("separator", {
    name: "Resize deck advisor",
  });
  await expect(separator).toHaveAttribute("aria-valuenow", "400");
  await expect(separator).not.toHaveAttribute("aria-valuemax");
  expect(
    await page
      .locator("aside.agent-drawer")
      .evaluate((element) => getComputedStyle(element).maxWidth),
  ).toBe("none");

  await separator.focus();
  await page.keyboard.press("ArrowLeft");

  await expect(separator).toHaveAttribute("aria-valuenow", "424");
  await page.reload();
  await expect(
    page.getByRole("separator", { name: "Resize deck advisor" }),
  ).toHaveAttribute("aria-valuenow", "424");
});

test("compact editor presents the advisor as a full-height supporting surface", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/decks/deck-1");

  const advisor = page.locator("aside.agent-drawer");
  await expect(advisor).toBeVisible();
  expect(
    await advisor.evaluate((element) => getComputedStyle(element).position),
  ).toBe("fixed");
  const advisorBox = await advisor.boundingBox();
  expect(advisorBox).not.toBeNull();
  expect(Math.round((advisorBox?.y ?? 0) + (advisorBox?.height ?? 0))).toBe(
    844,
  );
  await expect(page.getByLabel("Price marketplace")).toHaveValue("tcgplayer");
  await expect(page.getByLabel("Deck controls")).toBeVisible();
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

test("add deck requires details and creates the selected format", async ({
  page,
}) => {
  let requestBody: { title: string; format: string } | null = null;
  await page.route("http://localhost:8000/decks", async (route) => {
    if (route.request().method() === "POST") {
      requestBody = route.request().postDataJSON() as {
        title: string;
        format: string;
      };
      await fulfillJson(route, {
        ...deck,
        title: requestBody.title,
        format: requestBody.format,
      });
      return;
    }
    await fulfillJson(route, [deck]);
  });
  await page.goto("/decks");
  await page.getByRole("button", { name: "Add Deck" }).click();
  const dialog = page.getByRole("dialog", { name: "Add Deck" });
  const create = dialog.getByRole("button", { name: "Create deck" });
  await expect(create).toBeDisabled();
  await dialog.getByLabel("Title").fill("New Standard Deck");
  await dialog.getByLabel("Format").selectOption("standard");

  await create.click();

  expect(requestBody).toMatchObject({
    title: "New Standard Deck",
    format: "standard",
  });
});

test("valid deck uses an accessible icon-only indicator", async ({ page }) => {
  await page.goto("/decks/deck-1");

  const validation = page.getByLabel("Valid deck, 100 cards");
  await expect(validation).toBeVisible();
  await expect(validation).toContainText("check");
  await expect(validation).not.toContainText("Valid");
});

test("search auto-runs with deck format and drawer dismisses with Escape", async ({
  page,
}) => {
  let searchQuery = "";
  await page.route("http://localhost:8000/cards/search", async (route) => {
    const requestBody = route.request().postDataJSON() as { query: string };
    searchQuery = requestBody.query;
    await fulfillJson(route, {
      cards: [card],
      total_cards: 1,
      has_more: false,
    });
  });
  await page.goto("/decks/deck-1");
  const search = page.getByRole("textbox", { name: "Card search" });
  await search.fill("arcane");

  await expect(
    page.getByRole("dialog", { name: "Search results" }),
  ).toBeVisible({ timeout: 3000 });
  expect(searchQuery).toBe("arcane legal:commander");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Search results" }),
  ).toBeHidden();
  await expect(search).toBeFocused();
});

test("embedding search controls are not exposed to users", async ({ page }) => {
  await page.goto("/decks/deck-1");

  await expect(
    page.getByRole("button", { name: "Semantic search" }),
  ).toHaveCount(0);
  await expect(page.getByText(/semantic match/i)).toHaveCount(0);
});

test("info view contains goal, user description, and auto-generated deck overview", async ({
  page,
}) => {
  let refreshRequested = false;
  let generationRequests = 0;
  await page.route(
    "http://localhost:8000/decks/deck-1/generate-description**",
    async (route) => {
      generationRequests += 1;
      refreshRequested =
        new URL(route.request().url()).searchParams.get("refresh") === "true";
      await fulfillJson(route, {
        deck_id: deck.id,
        revision: deck.revision,
        description:
          "# Overview\nThis deck uses [[Arcane Signet]] to develop its mana.\n\n# Gameplan\n- Turns 1-3 - Develop mana.\n- Midgame - Cast the commander.\n- Lategame - Protect the winning turn.",
        cached: false,
      });
    },
  );
  await page.goto("/decks/deck-1");
  await page.getByRole("button", { name: "Info" }).click();
  const info = page.locator(".info-view");

  await expect(info).toContainText(deck.goal);
  await expect(info).toContainText(deck.description);
  const citation = info.locator(".inline-card-reference-trigger", {
    hasText: "Arcane Signet",
  });
  await expect(citation).toHaveText(/Arcane Signet/);
  await expect(
    info.locator(".ai-overview .generated-description"),
  ).toContainText("develop its mana.");
  await expect(
    info.locator(".ai-overview").getByRole("heading", { name: "Overview" }),
  ).toBeVisible();
  await expect(
    info.locator(".ai-overview").getByRole("heading", { name: "Gameplan" }),
  ).toBeVisible();
  await expect(info.locator(".ai-overview .gameplan-item")).toHaveCount(3);
  await citation.focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  expect(
    await citation.evaluate((element) => ({
      borderRadius: getComputedStyle(element).borderRadius,
      boxShadow: getComputedStyle(element).boxShadow,
      padding: getComputedStyle(element).padding,
    })),
  ).toEqual({ borderRadius: "0px", boxShadow: "none", padding: "0px" });
  await expect(info.getByRole("button", { name: /save/i })).toHaveCount(0);
  expect(generationRequests).toBe(1);
  expect(refreshRequested).toBe(false);
});

test("command zone is displayed before mainboard", async ({ page }) => {
  await page.goto("/decks/deck-1");
  const zoneHeadings = page.locator(".zone > h2");

  await expect(zoneHeadings.nth(0)).toContainText("Command zone");
  await expect(zoneHeadings.nth(1)).toContainText("Mainboard");
});

test("card grid consolidates duplicate cards and opens shared card details", async ({
  page,
}) => {
  await page.goto("/decks/deck-1");
  await page.getByRole("button", { name: "Grid" }).click();

  const arcaneImage = page.getByRole("button", {
    name: "View details for Arcane Signet",
  });
  await expect(arcaneImage).toHaveCount(1);
  await expect(
    arcaneImage.locator("xpath=../..").getByLabel("2 copies"),
  ).toHaveText("×2");

  await arcaneImage.click();
  const dialog = page.getByRole("dialog", { name: "Arcane Signet" });
  await expect(dialog).toContainText("Overall score");
  await expect(dialog).toContainText(cardScore.overall_comment);
  await dialog.getByRole("tab", { name: "Info" }).click();
  await expect(dialog).toContainText("Mana cost");
  await expect(dialog).toContainText(card.oracle_text);
  await expect(dialog).toContainText("Market prices");
});

test("cards can be starred as core pieces from hover actions", async ({
  page,
}) => {
  await page.goto("/decks/deck-1");
  await page.getByRole("button", { name: "Grid" }).click();

  const arcaneCard = page
    .getByRole("button", { name: "View details for Arcane Signet" })
    .locator("xpath=../..");
  await arcaneCard.hover();
  await page
    .getByRole("button", { name: "Star Arcane Signet as a core card" })
    .click();

  await expect(page.getByText("Starred Arcane Signet as a core card")).toBeVisible();
  await page.getByRole("button", { name: "Scores" }).click();
  await expect(page.locator(".evaluation-summary")).toContainText(
    "1 starred core card",
  );
});

test("hover actions only offer format-appropriate move zones", async ({
  page,
}) => {
  await page.goto("/decks/deck-1");
  await page.getByRole("button", { name: "Grid" }).click();

  const arcaneCard = page
    .getByRole("button", { name: "View details for Arcane Signet" })
    .locator("xpath=../..");
  await arcaneCard.hover();

  const moveSelect = page.getByLabel("Move Arcane Signet to another zone");
  await expect(moveSelect).toBeVisible();
  await expect(moveSelect.locator("option")).toHaveText([
    "Move",
    "Considering",
  ]);
});

test("text view uses masonry columns for card groups", async ({ page }) => {
  await page.goto("/decks/deck-1");
  await page.getByRole("button", { name: "Text" }).click();

  const groups = page.locator(".text-groups");
  const groupColumns = await groups.first().evaluate((element) => ({
    columnWidth: getComputedStyle(element).columnWidth,
    columnCount: getComputedStyle(element).columnCount,
  }));
  const sectionBreakInside = await groups
    .locator(".text-group-section")
    .first()
    .evaluate((element) => getComputedStyle(element).breakInside);
  const cardColumns = await groups
    .locator(".card-grid")
    .first()
    .evaluate(
      (element) =>
        getComputedStyle(element).gridTemplateColumns.split(" ").length,
    );
  expect(groupColumns.columnWidth).not.toBe("auto");
  expect(groupColumns.columnCount).toBe("auto");
  expect(sectionBreakInside).toBe("avoid");
  expect(cardColumns).toBe(1);
});

test("grid and stacks views use masonry columns for groups", async ({
  page,
}) => {
  await page.goto("/decks/deck-1");

  for (const view of ["Grid", "Stacks"] as const) {
    await page.getByRole("button", { name: view }).click();
    const visualGroups = page.locator(".visual-groups");
    const groupColumns = await visualGroups.first().evaluate((element) => ({
      columnWidth: getComputedStyle(element).columnWidth,
      columnCount: getComputedStyle(element).columnCount,
    }));
    const sectionBreakInside = await visualGroups
      .locator(".visual-group")
      .first()
      .evaluate((element) => getComputedStyle(element).breakInside);
    expect(groupColumns.columnWidth).not.toBe("auto");
    expect(groupColumns.columnCount).toBe("auto");
    expect(sectionBreakInside).toBe("avoid");
  }
});

test("text view compacts card actions into a caret popover", async ({
  page,
}) => {
  await page.goto("/decks/deck-1");
  await page.getByRole("button", { name: "Text" }).click();

  await page
    .getByRole("button", { name: "Open quick actions for Arcane Signet" })
    .click();
  const popover = page.getByRole("dialog", {
    name: "Arcane Signet quick actions",
  });
  await expect(popover).toBeVisible();
  await popover
    .getByRole("button", { name: "Star Arcane Signet as a core card" })
    .click();
  await expect(page.getByText("Starred Arcane Signet as a core card")).toBeVisible();
  await expect(
    page.getByLabel("Arcane Signet is starred as a core card"),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Open quick actions for Arcane Signet" })
    .click();
  await page.getByRole("button", { name: "Edit note for Arcane Signet" }).click();
  await expect(page.getByRole("dialog", { name: "Card note" })).toBeVisible();
  await expect(popover).toHaveCount(0);
});

test("text view can move a card to another zone from the quick-actions popover", async ({
  page,
}) => {
  await page.goto("/decks/deck-1");
  await page.getByRole("button", { name: "Text" }).click();

  await page
    .getByRole("button", { name: "Open quick actions for Arcane Signet" })
    .click();
  await page
    .getByLabel("Move Arcane Signet to another zone")
    .selectOption("considering");

  await expect(page.getByText("Move Arcane Signet to considering")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Considering 1/ })).toBeVisible();
  await expect(
    page
      .locator(".zone")
      .filter({ has: page.getByRole("heading", { name: /Mainboard 2/ }) })
      .getByText("Arcane Signet"),
  ).toBeVisible();
  await expect(
    page
      .locator(".zone")
      .filter({ has: page.getByRole("heading", { name: /Considering 1/ }) })
      .getByText("Arcane Signet"),
  ).toBeVisible();
});

test("text view closes the quick-actions popover on outside click and final removal", async ({
  page,
}) => {
  await page.route("http://localhost:8000/decks/deck-1", async (route) => {
    await fulfillJson(route, {
      ...deck,
      cardsets: [{ ...cardset, quantity: 1 }, commanderCardset],
    });
  });
  await page.route("http://localhost:8000/decks/deck-1/validation", async (route) => {
    await fulfillJson(route, { valid: true, card_count: 2, errors: [] });
  });
  await page.route("http://localhost:8000/decks/deck-1/operations", async (route) => {
    if (route.request().method() !== "POST") {
      await fulfillJson(route, []);
      return;
    }
    await fulfillJson(route, {
      operation: {
        ...operation,
        changes: [
          {
            ...operation.changes[0],
            quantity_delta: -1,
            quantity_before: 1,
            quantity_after: 0,
          },
        ],
      },
      deck: {
        ...deck,
        revision: 1,
        cardsets: [commanderCardset],
      },
      validation: { valid: true, card_count: 1, errors: [] },
    });
  });

  await page.goto("/decks/deck-1");
  await page.getByRole("button", { name: "Text" }).click();

  const toggle = page.getByRole("button", {
    name: "Open quick actions for Arcane Signet",
  });
  await toggle.click();
  const popover = page.getByRole("dialog", {
    name: "Arcane Signet quick actions",
  });
  await expect(popover).toBeVisible();
  await page.getByRole("button", { name: "Cards", exact: true }).click({
    position: { x: 4, y: 4 },
  });
  await expect(popover).toHaveCount(0);

  await toggle.click();
  await page.getByRole("button", { name: "Remove one Arcane Signet" }).click();
  await expect(page.getByText("Remove Arcane Signet")).toBeVisible();
  await expect(page.getByText("Arcane Signet")).toHaveCount(0);
  await expect(popover).toHaveCount(0);
});

test("scores are presented in a dedicated sortable view", async ({ page }) => {
  await page.goto("/decks/deck-1");
  await page.getByRole("button", { name: "Scores" }).click();

  const scoresView = page.locator(".scores-view");
  await expect(scoresView).toBeVisible();
  await expect(scoresView).toContainText("1/2");
  await expect(scoresView.locator(".score-table-row")).toHaveCount(2);
  await expect(
    scoresView.getByRole("button", { name: /Overall/ }),
  ).toBeVisible();
  await expect(
    scoresView.getByRole("button", { name: "Reload Sol Ring score" }),
  ).toBeVisible();
  await expect(scoresView.locator(".score-table-row").nth(1)).toContainText(
    "Arcane Signet",
  );
  await expect(scoresView.locator(".score-table-row").nth(1)).toContainText("-");
});

test("a single card score can be reloaded from the scores table", async ({
  page,
}) => {
  let reloadRequests = 0;
  await page.route(
    "http://localhost:8000/decks/deck-1/card-evaluations/oracle/oracle-1",
    async (route) => {
      reloadRequests += 1;
      await fulfillJson(route, {
        ...cardScore,
        overall_score: 77,
        overall_comment: "A refreshed card-specific evaluation.",
        roles: [
          {
            role: "mana_ramp",
            score: 77,
            description: "Updated after a targeted refresh.",
            answers: [{ criterion_id: "speed", rating: "high", score: 75 }],
          },
        ],
      });
    },
  );
  await page.goto("/decks/deck-1");
  await page.getByRole("button", { name: "Scores" }).click();

  const arcaneRow = page
    .locator(".score-table-row")
    .filter({ hasText: "Arcane Signet" });
  await expect(arcaneRow).toContainText("-");
  await arcaneRow.getByRole("button", { name: "Reload Arcane Signet score" }).click();

  await expect.poll(() => reloadRequests).toBe(1);
  await expect(arcaneRow).toContainText("77");
});

test("scores can be filtered by a regex-style subsequence query", async ({
  page,
}) => {
  await page.goto("/decks/deck-1");
  await page.getByRole("button", { name: "Scores" }).click();

  await page.getByLabel("Filter cards").fill("sgt");

  await expect(page.locator(".score-table-row")).toHaveCount(1);
  await expect(page.locator(".score-table-row").first()).toContainText(
    "Arcane Signet",
  );
  await expect(page.locator(".scores-view")).toContainText("Showing 1 of 2 cards");
});

test("card evaluation clearly requires a Goal or North Star", async ({
  page,
}) => {
  await page.route("http://localhost:8000/decks/deck-1", async (route) => {
    await fulfillJson(route, { ...deck, goal: "" });
  });
  await page.goto("/decks/deck-1");
  await page.getByRole("button", { name: "Scores" }).click();

  await expect(
    page.getByText("Add a Goal / North Star before evaluating cards"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Evaluate cards" }),
  ).toBeDisabled();
  await page
    .locator(".evaluation-goal-required")
    .getByRole("button", { name: "Add goal" })
    .dispatchEvent("click");
  await expect(page.getByRole("dialog", { name: "Edit deck" })).toBeVisible();
});

test("card scores only load after manual evaluation and cards sort by role score", async ({
  page,
}) => {
  let evaluationRequests = 0;
  let cachedRequests = 0;
  await page.route(
    "http://localhost:8000/decks/deck-1/card-evaluations/current/cached",
    async (route) => {
      cachedRequests += 1;
      await fulfillJson(route, cachedScores);
    },
  );
  await page.route(
    "http://localhost:8000/decks/deck-1/card-evaluations/current/stream",
    async (route) => {
      evaluationRequests += 1;
      await route.fulfill({
        contentType: "text/event-stream",
        body: [
          {
            type: "progress",
            payload: {
              completed: 0,
              total: 3,
              average_seconds_per_card: null,
              eta_seconds: null,
            },
          },
          {
            type: "progress",
            payload: {
              completed: 3,
              total: 3,
              average_seconds_per_card: 1.5,
              eta_seconds: 0,
            },
          },
          { type: "completed", payload: { results: scores } },
        ]
          .map((event) => `data: ${JSON.stringify(event)}\n\n`)
          .join(""),
      });
    },
  );
  await page.addInitScript(() => {
    localStorage.setItem(
      "survail.deck-display-preferences",
      JSON.stringify({
        view: "text",
        groupBy: "mana-value",
        sortBy: "alphabetical",
      }),
    );
  });
  await page.goto("/decks/deck-1");

  await page.getByRole("button", { name: "Scores" }).click();
  await expect(page.locator(".score-table-row")).toHaveCount(2);
  await expect.poll(() => cachedRequests).toBe(1);
  await expect.poll(() => evaluationRequests).toBe(0);
  await expect(page.locator(".score-table-row").nth(0)).toContainText(
    "Sol Ring",
  );
  await expect(page.locator(".score-table-row").nth(1)).toContainText(
    "Arcane Signet",
  );
  await page
    .locator(".scores-view")
    .getByRole("button", { name: "Evaluate cards" })
    .dispatchEvent("click");
  await expect(page.locator(".score-table-row")).toHaveCount(2);
  await expect.poll(() => evaluationRequests).toBe(1);
  await expect(page.locator(".score-table-row")).toContainText([
    "Sol Ring",
    "Arcane Signet",
  ]);
  await expect(page.locator(".score-row-details")).toHaveCount(0);
  await page
    .locator(".score-table-row")
    .first()
    .getByRole("button", { name: "Expand Sol Ring score details" })
    .click();
  await expect(page.locator(".score-row-preview-comment")).toContainText(
    "An efficient source of acceleration for this deck.",
  );
  await page.getByRole("button", { name: /Mana Ramp/ }).click();
  await page.getByRole("button", { name: "Cards", exact: true }).click();
  await page.getByLabel("Card sort").selectOption("score");
  await page.getByLabel("Group by").selectOption("type");

  const rows = page
    .locator(".zone")
    .filter({ hasText: "Mainboard" })
    .locator(".card-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Sol Ring");
  await expect(rows.nth(1)).toContainText("Arcane Signet");
  await expect(page.getByLabel("Card sort")).toHaveValue("score");
});

test("scores can sort by starred cards", async ({ page }) => {
  await page.goto("/decks/deck-1");
  await page.getByRole("button", { name: "Scores" }).click();

  await page
    .locator(".score-table-row")
    .nth(1)
    .getByRole("button", { name: "Star Arcane Signet as a core card" })
    .click();
  await page.getByRole("button", { name: "Starred" }).click();

  await expect(page.locator(".score-table-row").first()).toContainText(
    "Arcane Signet",
  );
});

test("completed card evaluations remain visible when a later evaluation fails", async ({
  page,
}) => {
  await page.route(
    "http://localhost:8000/decks/deck-1/card-evaluations/current/stream",
    async (route) => {
      await route.fulfill({
        contentType: "text/event-stream",
        body: [
          {
            type: "progress",
            payload: {
              completed: 0,
              total: 3,
              average_seconds_per_card: null,
              eta_seconds: null,
            },
          },
          { type: "result", payload: secondCardScore },
          {
            type: "progress",
            payload: {
              completed: 1,
              total: 3,
              average_seconds_per_card: 2,
              eta_seconds: 4,
            },
          },
          {
            type: "failed",
            payload: { message: "Rate limit retries exhausted" },
          },
        ]
          .map((event) => `data: ${JSON.stringify(event)}\n\n`)
          .join(""),
      });
    },
  );
  await page.goto("/decks/deck-1");
  await page.getByRole("button", { name: "Scores" }).click();
  await page
    .locator(".scores-view")
    .getByRole("button", { name: "Evaluate cards" })
    .dispatchEvent("click");

  await expect(page.locator(".score-table-row")).toHaveCount(2);
  await expect(page.getByRole("main")).toContainText(
    "Rate limit retries exhausted",
  );
});

test("direct editing saves the goal without legacy rubric payload", async ({
  page,
}) => {
  let requestBody: {
    title: string;
    description: string;
    goal: string;
  } | null = null;
  await page.route("http://localhost:8000/decks/deck-1", async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON() as NonNullable<
        typeof requestBody
      >;
      requestBody = body;
      await fulfillJson(route, { ...deck, ...body, revision: 1 });
      return;
    }
    await fulfillJson(route, deck);
  });
  await page.goto("/decks/deck-1");
  await page.getByRole("button", { name: "Info" }).click();
  await page.getByRole("button", { name: "Edit deck info" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit deck" });
  await dialog
    .getByLabel("Goal / North Star")
    .fill("Win through protected commander damage.");

  await dialog.getByRole("button", { name: "Save changes" }).click();

  expect(requestBody).toMatchObject({
    goal: "Win through protected commander damage.",
  });
});

test("deck advisor starter chips send a message and display the response", async ({
  page,
}) => {
  let sentMessage = "";
  await page.route(
    "http://localhost:8000/decks/deck-1/conversations/conversation-1/messages",
    async (route) => {
      sentMessage = (route.request().postDataJSON() as { message: string })
        .message;
      await fulfillAgentStream(
        route,
        "This deck develops mana and casts its commander.",
      );
    },
  );
  await page.goto("/decks/deck-1");

  await page.getByRole("button", { name: "What does this deck do?" }).click();

  await expect(page.locator("aside.agent-drawer")).toContainText(
    "This deck develops mana",
  );
  expect(sentMessage).toBe("What does this deck do?");
});

test("deck advisor sends manually entered messages", async ({ page }) => {
  let sentMessage = "";
  await page.route(
    "http://localhost:8000/decks/deck-1/conversations/conversation-1/messages",
    async (route) => {
      sentMessage = (route.request().postDataJSON() as { message: string })
        .message;
      await fulfillAgentStream(route, "Add more low-cost interaction.");
    },
  );
  await page.goto("/decks/deck-1");
  await page
    .getByRole("textbox", { name: "Message deck advisor" })
    .fill("How can I improve interaction?");

  await page.getByRole("button", { name: "Send message" }).click();

  const advisor = page.locator("aside.agent-drawer");
  await expect(advisor).toContainText("Add more low-cost interaction.");
  const viewport = advisor.locator(".agent-events");
  const userMessage = advisor.locator(".agent-user-message");
  await expect(userMessage).toContainText("How can I improve interaction?");
  await expect
    .poll(async () =>
      userMessage.evaluate((message) => {
        const container = message.parentElement;
        if (container === null) return Number.POSITIVE_INFINITY;
        return Math.abs(
          message.getBoundingClientRect().top -
            container.getBoundingClientRect().top,
        );
      }),
    )
    .toBeLessThan(8);
  expect(sentMessage).toBe("How can I improve interaction?");
  await expect(viewport).toBeVisible();
});

test("deck advisor sends with Enter and preserves Shift+Enter newlines", async ({
  page,
}) => {
  let sentMessage = "";
  await page.route(
    "http://localhost:8000/decks/deck-1/conversations/conversation-1/messages",
    async (route) => {
      sentMessage = (route.request().postDataJSON() as { message: string })
        .message;
      await fulfillAgentStream(route, "Received.");
    },
  );
  await page.goto("/decks/deck-1");
  const composer = page.getByRole("textbox", { name: "Message deck advisor" });
  await composer.fill("First line");
  await composer.press("Shift+Enter");
  await composer.pressSequentially("Second line");
  await expect(composer).toHaveValue("First line\nSecond line");

  await composer.press("Enter");

  await expect(page.locator("aside.agent-drawer")).toContainText("Received.");
  expect(sentMessage).toBe("First line\nSecond line");
});

test("deck advisor refreshes the deck after applying an operation", async ({
  page,
}) => {
  let deckReads = 0;
  await page.route("http://localhost:8000/decks/deck-1", async (route) => {
    deckReads += 1;
    await fulfillJson(route, {
      ...deck,
      revision: deckReads > 2 ? 1 : 0,
      title: deckReads > 2 ? "Updated by advisor" : deck.title,
    });
  });
  await page.route(
    "http://localhost:8000/decks/deck-1/conversations/conversation-1/messages",
    async (route) => {
      const runId = "run-operation";
      await route.fulfill({
        contentType: "text/event-stream",
        body: [
          {
            type: "run_started",
            run_id: runId,
            payload: { message: "Applying change" },
          },
          {
            type: "operation_applied",
            run_id: runId,
            payload: {
              proposal_id: "proposal-1",
              operation_id: "operation-1",
              revision: 1,
              validation: { valid: true, card_count: 100, errors: [] },
            },
          },
          { type: "run_completed", run_id: runId, payload: {} },
        ]
          .map((event) => `data: ${JSON.stringify(event)}\n\n`)
          .join(""),
      });
    },
  );
  await page.goto("/decks/deck-1");
  await page
    .getByRole("textbox", { name: "Message deck advisor" })
    .fill("Make the change");

  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.locator(".deck-readonly-details strong")).toHaveText(
    "Updated by advisor",
  );
  await expect(page.locator("aside.agent-drawer")).toContainText(
    "Deck change applied.",
  );
});

test("agent guidance proposals provide approve and reject controls", async ({
  page,
}) => {
  const decisions: string[] = [];
  await page.route(
    "http://localhost:8000/decks/deck-1/guidance-proposals/**",
    async (route) => {
      decisions.push(new URL(route.request().url()).pathname);
      await fulfillJson(route, {
        id: "guidance-1",
        deck_id: deck.id,
        expected_revision: deck.revision,
        reason: "Focus the plan",
        proposed_goal: "Win with protected commander damage.",
        status:
          decisions.at(-1)?.endsWith("/approve") === true
            ? "approved"
            : "rejected",
        created_at: "2026-06-10T00:00:00Z",
        updated_at: "2026-06-10T00:00:00Z",
      });
    },
  );
  await page.route(
    "http://localhost:8000/decks/deck-1/conversations/conversation-1/messages",
    async (route) => {
      await route.fulfill({
        contentType: "text/event-stream",
        body: [
          {
            type: "guidance_proposal",
            run_id: "run-guidance",
            payload: {
              proposal_id: "guidance-approve",
              expected_revision: 0,
              reason: "Focus the plan",
              proposed_goal: "Win with protected commander damage.",
            },
          },
          {
            type: "guidance_proposal",
            run_id: "run-guidance",
            payload: {
              proposal_id: "guidance-reject",
              expected_revision: 0,
              reason: "Try a different focus",
              proposed_goal: "Build a resilient value engine.",
            },
          },
          { type: "run_completed", run_id: "run-guidance", payload: {} },
        ]
          .map((event) => `data: ${JSON.stringify(event)}\n\n`)
          .join(""),
      });
    },
  );
  await page.goto("/decks/deck-1");
  await page
    .getByRole("textbox", { name: "Message deck advisor" })
    .fill("Refine my goal");
  await page.getByRole("button", { name: "Send message" }).click();
  const proposals = page.locator(".agent-guidance-proposal");
  await expect(proposals).toHaveCount(2);
  await expect(proposals.first()).toContainText("Your approval is required");

  await proposals.first().getByRole("button", { name: "Approve" }).click();
  await proposals.nth(1).getByRole("button", { name: "Reject" }).click();

  await expect(proposals.first()).toContainText("Proposal approved");
  await expect(proposals.nth(1)).toContainText("Proposal rejected");
  expect(decisions).toEqual([
    "/decks/deck-1/guidance-proposals/guidance-approve/approve",
    "/decks/deck-1/guidance-proposals/guidance-reject/reject",
  ]);
});

test("card operations apply without approval UI or duplicate proposal preview", async ({
  page,
}) => {
  await page.route(
    "http://localhost:8000/decks/deck-1/conversations/conversation-1/messages",
    async (route) => {
      await route.fulfill({
        contentType: "text/event-stream",
        body: [
          {
            type: "run_started",
            run_id: "run-change",
            payload: { message: "Updating your deck" },
          },
          {
            type: "card_results",
            run_id: "run-change",
            payload: {
              query: "interaction",
              cards: [
                {
                  printing_id: card.id,
                  oracle_id: card.oracle_id,
                  name: card.name,
                  mana_cost: card.mana_cost,
                  type_line: card.type_line,
                  image_uri: null,
                  set: card.set,
                  finishes: card.finishes,
                },
              ],
            },
          },
          {
            type: "operation_applied",
            run_id: "run-change",
            payload: {
              proposal_id: "proposal-1",
              operation_id: "operation-1",
              revision: 1,
              validation: {
                valid: false,
                card_count: 101,
                errors: [
                  {
                    error_id: "deck-size",
                    code: "too_many_cards",
                    message: "Deck has too many cards.",
                    cardset_id: null,
                  },
                ],
              },
            },
          },
          { type: "run_completed", run_id: "run-change", payload: {} },
        ]
          .map((event) => `data: ${JSON.stringify(event)}\n\n`)
          .join(""),
      });
    },
  );
  await page.goto("/decks/deck-1");
  await page
    .getByRole("textbox", { name: "Message deck advisor" })
    .fill("Apply it");
  await page.getByRole("button", { name: "Send message" }).click();

  const advisor = page.locator("aside.agent-drawer");
  await expect(advisor).toContainText(
    "Deck change applied with 1 validation issues.",
  );
  await expect(advisor.locator(".agent-card-results article")).toHaveCount(0);
  await expect(
    advisor.locator(".agent-proposal, .agent-proposal-cards"),
  ).toHaveCount(0);
  await expect(
    advisor.getByRole("button", { name: /approve|reject/i }),
  ).toHaveCount(0);
});

test("deck advisor card citations use the shared hover preview", async ({
  page,
}) => {
  await page.route(
    "http://localhost:8000/decks/deck-1/conversations/conversation-1/messages",
    async (route) => {
      await fulfillAgentStream(
        route,
        "Add [[Arcane Signet]] to improve your mana.",
      );
    },
  );
  await page.goto("/decks/deck-1");
  await page.getByRole("button", { name: "What does this deck do?" }).click();

  const citation = page
    .locator("aside.agent-drawer")
    .locator(".inline-card-reference-trigger");
  await expect(citation).toContainText("Arcane Signet");
  await citation.focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await expect(
    page.locator("aside.agent-drawer").getByRole("tooltip"),
  ).toHaveCount(0);
});

test("deck advisor streaming citations never expose raw citation syntax", async ({
  page,
}) => {
  await page.route(
    "http://localhost:8000/decks/deck-1/conversations/conversation-1/messages",
    async (route) => {
      const runId = "run-streaming-citation";
      await route.fulfill({
        contentType: "text/event-stream",
        body: [
          {
            type: "run_started",
            run_id: runId,
            payload: { message: "Thinking" },
          },
          {
            type: "assistant_text_delta",
            run_id: runId,
            payload: { delta: "Add [[" },
          },
          {
            type: "assistant_text_delta",
            run_id: runId,
            payload: { delta: "Arcane Signet" },
          },
          {
            type: "assistant_text_delta",
            run_id: runId,
            payload: { delta: "]] for mana." },
          },
          { type: "run_completed", run_id: runId, payload: {} },
        ]
          .map((event) => `data: ${JSON.stringify(event)}\n\n`)
          .join(""),
      });
    },
  );
  await page.goto("/decks/deck-1");
  await page.getByRole("button", { name: "What does this deck do?" }).click();
  const advisor = page.locator("aside.agent-drawer");

  await expect(advisor.locator(".inline-card-reference-trigger")).toContainText(
    "Arcane Signet",
  );
  await expect(advisor).not.toContainText("[[");
  await expect(advisor).not.toContainText("]]");
});

test("deck advisor explains when a response stream closes early", async ({
  page,
}) => {
  await page.route(
    "http://localhost:8000/decks/deck-1/conversations/conversation-1/messages",
    async (route) => {
      await route.fulfill({
        contentType: "text/event-stream",
        body: `data: ${JSON.stringify({ type: "run_started", run_id: "run-interrupted", payload: { message: "Thinking about your deck" } })}\n\n`,
      });
    },
  );
  await page.goto("/decks/deck-1");
  await page
    .getByRole("textbox", { name: "Message deck advisor" })
    .fill("Review this deck");
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.locator("aside.agent-drawer")).toContainText(
    "The connection closed before the response finished",
  );
});

test("history presents dense expandable operation summaries", async ({
  page,
}) => {
  await page.route(
    "http://localhost:8000/decks/deck-1/operations**",
    async (route) => {
      await fulfillJson(route, [operation]);
    },
  );
  await page.goto("/decks/deck-1");
  await page.getByLabel("More deck actions").click();
  await page.getByRole("button", { name: "History" }).click();

  const history = page.getByRole("dialog", { name: "Deck history" });
  const entry = history.locator(".history-entry");
  await expect(history).toContainText("1 recorded change");
  await expect(entry).toContainText("Added interaction");
  await expect(entry).toContainText("1 change");
  await expect(entry.getByRole("button", { name: "Undo" })).toHaveCSS(
    "min-height",
    "44px",
  );
  await expect(entry.locator("> div")).toBeHidden();
  await entry.locator("summary").click();
  await expect(entry.locator("> div")).toContainText("+1 Arcane Signet");
});

test("bulk decklist editor applies one atomic diff", async ({ page }) => {
  let appliedChanges: {
    printing_id: string;
    quantity_delta: number;
    zone: string;
  }[] = [];
  await page.route("http://localhost:8000/imports/moxfield", async (route) => {
    await fulfillJson(route, {
      cardsets: [
        {
          quantity: 1,
          printing_id: commanderCardset.printing_id,
          oracle_id: commanderCardset.oracle_id,
          card_name: commanderCardset.card_name,
          set_code: commanderCardset.set_code,
          collector_number: commanderCardset.collector_number,
          finish: commanderCardset.finish,
          zone: "commander",
          note: "",
          tags: [],
          source_lines: [2],
          selected_price_usd: "1.00",
          printing_selection_reason: "ranked_preferences",
          scryfall: card,
        },
        {
          quantity: 3,
          printing_id: cardset.printing_id,
          oracle_id: cardset.oracle_id,
          card_name: cardset.card_name,
          set_code: cardset.set_code,
          collector_number: cardset.collector_number,
          finish: cardset.finish,
          zone: "mainboard",
          note: "",
          tags: [],
          source_lines: [5],
          selected_price_usd: "1.00",
          printing_selection_reason: "ranked_preferences",
          scryfall: card,
        },
        {
          quantity: 1,
          printing_id: secondCardset.printing_id,
          oracle_id: secondCardset.oracle_id,
          card_name: secondCardset.card_name,
          set_code: secondCardset.set_code,
          collector_number: secondCardset.collector_number,
          finish: secondCardset.finish,
          zone: "mainboard",
          note: "",
          tags: [],
          source_lines: [6],
          selected_price_usd: "1.00",
          printing_selection_reason: "ranked_preferences",
          scryfall: secondCard,
        },
      ],
      errors: [],
    });
  });
  await page.route(
    "http://localhost:8000/decks/deck-1/operations",
    async (route) => {
      if (route.request().method() === "POST") {
        appliedChanges = (
          route.request().postDataJSON() as {
            changes: {
              printing_id: string;
              quantity_delta: number;
              zone: string;
            }[];
          }
        ).changes;
        await fulfillJson(route, {
          operation: {
            id: "operation-1",
            deck_id: deck.id,
            actor_id: "user-1",
            client_operation_id: "client-1",
            reason: "Bulk edit decklist",
            revision_before: 0,
            revision_after: 1,
            created_at: "2026-06-10T00:00:00Z",
            changes: [],
          },
          deck: { ...deck, revision: 1 },
          validation: { valid: true, card_count: 101, errors: [] },
        });
        return;
      }
      await fulfillJson(route, []);
    },
  );
  await page.goto("/decks/deck-1");
  await page.getByLabel("More deck actions").click();
  await page.getByRole("button", { name: "Bulk edit decklist" }).click();
  const dialog = page.getByRole("dialog", { name: "Bulk edit decklist" });
  await expect(dialog.getByRole("textbox", { name: "Decklist" })).toContainText(
    "Command zone",
  );

  await dialog.getByRole("button", { name: "Apply changes" }).click();

  await expect(dialog).toBeHidden();
  expect(appliedChanges).toEqual([
    {
      printing_id: cardset.printing_id,
      quantity_delta: 1,
      zone: "mainboard",
      finish: "nonfoil",
    },
  ]);
});

test("bulk decklist editor displays parse errors without changing the deck", async ({
  page,
}) => {
  let operationRequested = false;
  await page.route("http://localhost:8000/imports/moxfield", async (route) => {
    await fulfillJson(route, {
      cardsets: [],
      errors: [
        {
          line_number: 1,
          raw_line: "not a card",
          code: "invalid_line",
          message: "Invalid card line",
        },
      ],
    });
  });
  await page.route(
    "http://localhost:8000/decks/deck-1/operations",
    async (route) => {
      operationRequested = route.request().method() === "POST";
      await fulfillJson(route, []);
    },
  );
  await page.goto("/decks/deck-1");
  await page.getByLabel("More deck actions").click();
  await page.getByRole("button", { name: "Bulk edit decklist" }).click();
  const dialog = page.getByRole("dialog", { name: "Bulk edit decklist" });
  await dialog.getByRole("textbox", { name: "Decklist" }).fill("not a card");

  await dialog.getByRole("button", { name: "Apply changes" }).click();

  await expect(dialog.getByRole("alert")).toContainText(
    "Line 1: Invalid card line",
  );
  expect(operationRequested).toBe(false);
});
