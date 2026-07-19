// Shared Playwright API mock: a realistically sized commander deck for
// experience tests and UI screenshots. No backend required.
import type { Page, Route } from "@playwright/test";

const cardArt =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='488' height='680' viewBox='0 0 488 680'%3E%3Cdefs%3E%3ClinearGradient id='g' x2='1' y2='1'%3E%3Cstop stop-color='%23303979'/%3E%3Cstop offset='1' stop-color='%23121318'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='488' height='680' rx='28' fill='%231a1b20'/%3E%3Crect x='22' y='22' width='444' height='636' rx='20' fill='url(%23g)' stroke='%23bdc2ff' stroke-width='4'/%3E%3Ccircle cx='244' cy='286' r='116' fill='none' stroke='%23bdc2ff' stroke-width='18' opacity='.72'/%3E%3Ccircle cx='244' cy='286' r='54' fill='%23bdc2ff' opacity='.88'/%3E%3Cpath d='M102 500h284M102 540h220M102 580h250' stroke='%23e4e1e9' stroke-width='14' stroke-linecap='round' opacity='.72'/%3E%3C/svg%3E";

interface Spec {
  name: string;
  cost: string;
  type: string;
  cmc: number;
  rarity?: string;
  colors?: string[];
  zone?: string;
  qty?: number;
  tags?: string[];
  note?: string;
}

const specs: Spec[] = [
  {
    name: "Aurelia, the Warleader",
    cost: "{2}{R}{R}{W}{W}",
    type: "Legendary Creature — Angel",
    cmc: 6,
    rarity: "mythic",
    colors: ["R", "W"],
    zone: "commander",
    tags: ["wincon"],
  },
  {
    name: "Boros Reckoner",
    cost: "{R/W}{R/W}{R/W}",
    type: "Creature — Minotaur Wizard",
    cmc: 3,
    colors: ["R", "W"],
    tags: ["blocker"],
  },
  {
    name: "Solemn Simulacrum",
    cost: "{4}",
    type: "Artifact Creature — Golem",
    cmc: 4,
    tags: ["ramp", "card-draw"],
  },
  {
    name: "Sun Titan",
    cost: "{4}{W}{W}",
    type: "Creature — Giant",
    cmc: 6,
    colors: ["W"],
    rarity: "mythic",
    tags: ["recursion"],
    note: "Returns half the deck.",
  },
  {
    name: "Combat Celebrant",
    cost: "{2}{R}",
    type: "Creature — Human Warrior",
    cmc: 3,
    colors: ["R"],
    tags: ["combo"],
  },
  {
    name: "Karmic Guide",
    cost: "{3}{W}{W}",
    type: "Creature — Angel Spirit",
    cmc: 5,
    colors: ["W"],
    tags: ["recursion", "combo"],
  },
  {
    name: "Reveillark",
    cost: "{4}{W}",
    type: "Creature — Elemental",
    cmc: 5,
    colors: ["W"],
    tags: ["recursion"],
  },
  {
    name: "Loyal Retainers",
    cost: "{2}{W}",
    type: "Creature — Human Advisor",
    cmc: 3,
    colors: ["W"],
  },
  {
    name: "Selfless Spirit",
    cost: "{1}{W}",
    type: "Creature — Spirit Cleric",
    cmc: 2,
    colors: ["W"],
    tags: ["protection"],
  },
  {
    name: "Drannith Magistrate",
    cost: "{1}{W}",
    type: "Creature — Human Wizard",
    cmc: 2,
    colors: ["W"],
    tags: ["stax"],
  },
  {
    name: "Esper Sentinel",
    cost: "{W}",
    type: "Artifact Creature — Human Soldier",
    cmc: 1,
    colors: ["W"],
    rarity: "rare",
    tags: ["card-draw"],
  },
  {
    name: "Mother of Runes",
    cost: "{W}",
    type: "Creature — Human Cleric",
    cmc: 1,
    colors: ["W"],
    tags: ["protection"],
  },
  {
    name: "Giver of Runes",
    cost: "{W}",
    type: "Creature — Kor Cleric",
    cmc: 1,
    colors: ["W"],
    tags: ["protection"],
  },
  {
    name: "Magda, Brazen Outlaw",
    cost: "{1}{R}",
    type: "Legendary Creature — Dwarf Berserker",
    cmc: 2,
    colors: ["R"],
    tags: ["ramp"],
  },
  {
    name: "Imperial Recruiter",
    cost: "{2}{R}",
    type: "Creature — Human Advisor",
    cmc: 3,
    colors: ["R"],
    tags: ["tutor"],
  },
  {
    name: "Recruiter of the Guard",
    cost: "{2}{W}",
    type: "Creature — Human Soldier",
    cmc: 3,
    colors: ["W"],
    tags: ["tutor"],
  },
  {
    name: "Dockside Extortionist",
    cost: "{1}{R}",
    type: "Creature — Goblin Pirate",
    cmc: 2,
    colors: ["R"],
    rarity: "mythic",
    tags: ["ramp"],
  },
  {
    name: "Ragavan, Nimble Pilferer",
    cost: "{R}",
    type: "Legendary Creature — Monkey Pirate",
    cmc: 1,
    colors: ["R"],
    rarity: "mythic",
  },
  {
    name: "Swords to Plowshares",
    cost: "{W}",
    type: "Instant",
    cmc: 1,
    colors: ["W"],
    tags: ["removal"],
  },
  {
    name: "Path to Exile",
    cost: "{W}",
    type: "Instant",
    cmc: 1,
    colors: ["W"],
    tags: ["removal"],
  },
  {
    name: "Deflecting Swat",
    cost: "{2}{R}",
    type: "Instant",
    cmc: 3,
    colors: ["R"],
    tags: ["protection"],
  },
  {
    name: "Flawless Maneuver",
    cost: "{2}{W}",
    type: "Instant",
    cmc: 3,
    colors: ["W"],
    tags: ["protection"],
  },
  {
    name: "Teferi's Protection",
    cost: "{2}{W}",
    type: "Instant",
    cmc: 3,
    colors: ["W"],
    rarity: "rare",
    tags: ["protection"],
  },
  {
    name: "Enlightened Tutor",
    cost: "{W}",
    type: "Instant",
    cmc: 1,
    colors: ["W"],
    tags: ["tutor"],
  },
  {
    name: "Wear // Tear",
    cost: "{1}{R} // {W}",
    type: "Instant",
    cmc: 3,
    colors: ["R", "W"],
    tags: ["removal"],
  },
  {
    name: "Boros Charm",
    cost: "{R}{W}",
    type: "Instant",
    cmc: 2,
    colors: ["R", "W"],
    tags: ["protection", "burn"],
  },
  {
    name: "Wheel of Fortune",
    cost: "{2}{R}",
    type: "Sorcery",
    cmc: 3,
    colors: ["R"],
    rarity: "rare",
    tags: ["card-draw"],
  },
  {
    name: "Gamble",
    cost: "{R}",
    type: "Sorcery",
    cmc: 1,
    colors: ["R"],
    tags: ["tutor"],
  },
  {
    name: "Sevinne's Reclamation",
    cost: "{2}{W}",
    type: "Sorcery",
    cmc: 3,
    colors: ["W"],
    tags: ["recursion"],
  },
  {
    name: "Winds of Abandon",
    cost: "{1}{W}",
    type: "Sorcery",
    cmc: 2,
    colors: ["W"],
    tags: ["removal"],
  },
  {
    name: "Blasphemous Act",
    cost: "{8}{R}",
    type: "Sorcery",
    cmc: 9,
    colors: ["R"],
    tags: ["boardwipe"],
  },
  { name: "Sol Ring", cost: "{1}", type: "Artifact", cmc: 1, tags: ["ramp"] },
  {
    name: "Arcane Signet",
    cost: "{2}",
    type: "Artifact",
    cmc: 2,
    tags: ["ramp"],
  },
  {
    name: "Boros Signet",
    cost: "{2}",
    type: "Artifact",
    cmc: 2,
    tags: ["ramp"],
  },
  {
    name: "Talisman of Conviction",
    cost: "{2}",
    type: "Artifact",
    cmc: 2,
    tags: ["ramp"],
  },
  {
    name: "Mana Crypt",
    cost: "{0}",
    type: "Artifact",
    cmc: 0,
    rarity: "mythic",
    tags: ["ramp"],
  },
  {
    name: "Sunforger",
    cost: "{3}",
    type: "Artifact — Equipment",
    cmc: 3,
    tags: ["toolbox"],
    note: "Fetch Boros Charm first.",
  },
  {
    name: "Helm of the Host",
    cost: "{4}",
    type: "Legendary Artifact — Equipment",
    cmc: 4,
    rarity: "rare",
    tags: ["combo", "wincon"],
  },
  {
    name: "Land Tax",
    cost: "{W}",
    type: "Enchantment",
    cmc: 1,
    colors: ["W"],
    rarity: "rare",
    tags: ["card-draw"],
  },
  {
    name: "Smothering Tithe",
    cost: "{3}{W}",
    type: "Enchantment",
    cmc: 4,
    colors: ["W"],
    rarity: "rare",
    tags: ["ramp"],
  },
  {
    name: "Aggravated Assault",
    cost: "{2}{R}",
    type: "Enchantment",
    cmc: 3,
    colors: ["R"],
    rarity: "rare",
    tags: ["combo", "wincon"],
  },
  {
    name: "Fiery Emancipation",
    cost: "{3}{R}{R}{R}",
    type: "Enchantment",
    cmc: 6,
    colors: ["R"],
    rarity: "mythic",
    tags: ["burn"],
  },
  { name: "Command Tower", cost: "", type: "Land", cmc: 0 },
  { name: "Battlefield Forge", cost: "", type: "Land", cmc: 0 },
  { name: "Sacred Foundry", cost: "", type: "Land", cmc: 0, rarity: "rare" },
  { name: "Clifftop Retreat", cost: "", type: "Land", cmc: 0, rarity: "rare" },
  { name: "Plateau", cost: "", type: "Land", cmc: 0, rarity: "rare" },
  {
    name: "Sunbaked Canyon",
    cost: "",
    type: "Land — Plains Mountain",
    cmc: 0,
    rarity: "rare",
  },
  {
    name: "Plains",
    cost: "",
    type: "Basic Land — Plains",
    cmc: 0,
    rarity: "common",
    qty: 12,
  },
  {
    name: "Mountain",
    cost: "",
    type: "Basic Land — Mountain",
    cmc: 0,
    rarity: "common",
    qty: 10,
  },
];

const cards = specs.map((spec, index) => ({
  id: `printing-${String(index + 1)}`,
  oracle_id: `oracle-${String(index + 1)}`,
  name: spec.name,
  mana_cost: spec.cost,
  type_line: spec.type,
  oracle_text: "Sample rules text for layout purposes.",
  set: "cmm",
  set_name: "Commander Masters",
  collector_number: String(index + 1),
  rarity: spec.rarity ?? "uncommon",
  finishes: ["nonfoil"],
  image_uris: { normal: cardArt },
  card_faces: [],
  legalities: { commander: "legal" },
  colors: spec.colors ?? [],
  color_identity: spec.colors ?? [],
  cmc: spec.cmc,
  prices: {
    usd: (spec.cmc * 1.75 + 0.25).toFixed(2),
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
}));

const cardsets = cards.map((card, index) => {
  const spec = specs[index];
  if (spec === undefined) throw new Error(`No spec at index ${String(index)}`);
  return {
    id: `cardset-${String(index + 1)}`,
    quantity: spec.qty ?? 1,
    zone: spec.zone ?? "mainboard",
    finish: "nonfoil",
    printing_id: card.id,
    oracle_id: card.oracle_id,
    card_name: card.name,
    set_code: card.set,
    collector_number: card.collector_number,
    note: spec.note ?? "",
    tags: spec.tags ?? [],
    scryfall: card,
  };
});

const deck = {
  id: "deck-1",
  title: "Aurelia Double Strike",
  format: "commander",
  description: "Extra-combat aggro with a Sunforger toolbox.",
  generated_description: null,
  goal: "Win through repeated combat steps while protecting Aurelia.",
  metadata: { kind: "commander", commander_oracle_ids: ["oracle-1"] },
  cardsets,
  is_sample: false,
  revision: 4,
  created_at: "2026-06-10T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
};

const secondDeck = {
  ...deck,
  id: "deck-2",
  title: "Krenko Goblin Storm",
  description: "Token swarm with haste enablers.",
  goal: "Flood the board with goblins and finish with Purphoros.",
  cardsets: cardsets.slice(0, 12),
  revision: 9,
};

const thirdDeck = {
  ...deck,
  id: "deck-3",
  title: "Meren Graveyard Value",
  description: "Sacrifice loops and reanimation.",
  goal: "Grind incremental value from the graveyard.",
  cardsets: cardsets.slice(0, 30),
  revision: 2,
};

const scores = cards.map((card, index) => ({
  oracle_id: card.oracle_id,
  deck_revision: deck.revision,
  evaluator_version: "roles-v2",
  overall_score: 35 + ((index * 17) % 60),
  overall_comment: "Fits the extra-combat plan.",
  roles: [
    {
      role: "aggro",
      score: 35 + ((index * 17) % 60),
      description: "Supports repeated combat steps.",
      answers: { speed: "high" },
    },
  ],
  cached: true,
}));

async function fulfillJson(route: Route, body: object): Promise<void> {
  await route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

export interface RichDeckMockOptions {
  /** Repeat distinct cardset appearances to stress-test large projected views. */
  cardsetMultiplier?: number;
}

export async function mockRichApi(
  page: Page,
  options: RichDeckMockOptions = {},
): Promise<void> {
  const multiplier = Math.max(1, options.cardsetMultiplier ?? 1);
  const deckTags = [
    ...new Set(cardsets.flatMap((cardset) => cardset.tags)),
  ].map((name, position) => ({ id: name, name, position, target: 0 }));
  let activeCardsets = Array.from({ length: multiplier }, (_, copyIndex) =>
    cardsets.map((cardset) => ({
      ...cardset,
      id: `${cardset.id}-fixture-${String(copyIndex)}`,
      tag_ids: [...cardset.tags],
      tag_weights: Object.fromEntries(cardset.tags.map((tag) => [tag, 1])),
    })),
  ).flat();
  let activeDeck = { ...deck, cardsets: activeCardsets, tags: deckTags };
  await page.route("http://localhost:8000/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/auth/me") {
      await fulfillJson(route, {
        username: "local-developer",
        display_name: "Local Developer",
        scoring_enabled: true,
      });
    } else if (url.pathname === "/decks") {
      await fulfillJson(route, [activeDeck, secondDeck, thirdDeck]);
    } else if (url.pathname === "/decks/deck-1") {
      await fulfillJson(route, activeDeck);
    } else if (url.pathname === "/decks/deck-1/validation") {
      await fulfillJson(route, {
        valid: true,
        card_count: activeCardsets.reduce(
          (total, entry) => total + entry.quantity,
          0,
        ),
        errors: [],
      });
    } else if (
      url.pathname === "/decks/deck-1/card-evaluations/current/cached"
    ) {
      await fulfillJson(route, scores);
    } else if (url.pathname === "/decks/deck-1/operations") {
      await fulfillJson(route, []);
    } else if (url.pathname === "/decks/deck-1/conversations") {
      await fulfillJson(route, {
        id: "conversation-1",
        deck_id: deck.id,
        created_at: "2026-06-10T00:00:00Z",
        updated_at: "2026-06-10T00:00:00Z",
      });
    } else if (
      route.request().method() === "PUT" &&
      /^\/decks\/deck-1\/cardsets\/[^/]+\/tags\/[^/]+$/.test(url.pathname)
    ) {
      const [, , , , cardsetId, , tagId] = url.pathname.split("/");
      if (cardsetId === undefined || tagId === undefined) {
        throw new Error(`Invalid cardset tag route: ${url.pathname}`);
      }
      activeCardsets = activeCardsets.map((cardset) =>
        cardset.id === cardsetId
          ? {
              ...cardset,
              tag_ids: [...new Set([...cardset.tag_ids, tagId])],
            }
          : cardset,
      );
      activeDeck = { ...activeDeck, cardsets: activeCardsets };
      await fulfillJson(route, activeDeck);
    } else {
      await route.fulfill({ status: 204 });
    }
  });
}
