import { describe, expect, it } from "vitest";

import type { ScryfallCard } from "../../modules/cards/contracts";
import type {
  CardSet,
  CardZone,
  DeckFormat,
} from "../../modules/decks/contracts";
import type { CardRoleEvaluation } from "../../modules/decks/evaluations/contracts";

import { buildCardZoneMatrix } from "./cardZoneMatrix";

function cardset(
  id: string,
  zone: CardZone,
  quantity: number,
  typeLine: string,
): CardSet {
  const scryfall = {
    id: `printing-${id}`,
    oracle_id: `oracle-${id}`,
    name: id,
    mana_cost: null,
    type_line: typeLine,
    oracle_text: null,
    set: "tst",
    set_name: "Test",
    collector_number: id,
    rarity: "common",
    finishes: ["nonfoil"],
    image_uris: null,
    card_faces: [],
    legalities: {},
    colors: [],
    color_identity: [],
    cmc: 2,
  } satisfies ScryfallCard;
  return {
    id,
    quantity,
    zone,
    finish: "nonfoil",
    printing_id: scryfall.id,
    oracle_id: scryfall.oracle_id,
    card_name: id,
    set_code: "tst",
    collector_number: id,
    note: "",
    tags: [],
    scryfall,
  };
}

function matrix(
  cards: CardSet[],
  format: DeckFormat = "standard",
  scores: ReadonlyMap<string, CardRoleEvaluation> = new Map(),
) {
  return buildCardZoneMatrix({
    cards,
    format,
    groupBy: "type",
    sortBy: "alphabetical",
    provider: "tcgplayer",
    scores,
  });
}

describe("buildCardZoneMatrix", () => {
  it("projects constructed decks into mainboard, sideboard, and considering rows", () => {
    const result = matrix([
      cardset("main", "mainboard", 2, "Creature"),
      cardset("side", "sideboard", 1, "Instant"),
      cardset("maybe", "considering", 3, "Land"),
      cardset("companion", "companion", 1, "Legendary Creature"),
      cardset("commander", "commander", 1, "Legendary Creature"),
    ]);

    expect(result.rows.map((row) => row.zone)).toEqual([
      "mainboard",
      "sideboard",
      "considering",
    ]);
    expect(result.rows.map((row) => row.totalQuantity)).toEqual([2, 1, 3]);
    expect(result.rows.map((row) => row.distinctCardCount)).toEqual([1, 1, 1]);
    expect(
      result.rows.flatMap((row) => row.cards).map((card) => card.id),
    ).not.toContain("companion");
  });

  it("projects commander formats into mainboard and considering rows", () => {
    const result = matrix(
      [
        cardset("leader", "commander", 1, "Legendary Creature"),
        cardset("main", "mainboard", 99, "Creature"),
      ],
      "commander",
    );

    expect(result.rows.map((row) => row.zone)).toEqual([
      "mainboard",
      "considering",
    ]);
    expect(result.rows[1]?.cards).toEqual([]);
  });

  it("uses one ordered column axis and fills absent row categories with empty cells", () => {
    const result = matrix([
      cardset("main", "mainboard", 2, "Sorcery"),
      cardset("side", "sideboard", 1, "Artifact"),
    ]);

    expect(result.columns).toEqual(["Artifact", "Sorcery"]);
    expect(result.rows[0]?.columns.map((column) => column.label)).toEqual(
      result.columns,
    );
    expect(result.rows[0]?.columns.map((column) => column.quantity)).toEqual([
      0, 2,
    ]);
    expect(result.rows[1]?.columns.map((column) => column.quantity)).toEqual([
      1, 0,
    ]);
  });

  it("places multi-category cards in every matching column without inflating row totals", () => {
    const result = matrix([
      cardset("artifact-creature", "mainboard", 4, "Artifact Creature"),
      cardset("land", "mainboard", 2, "Land"),
    ]);
    const mainboard = result.rows[0];

    expect(result.columns).toEqual(["Artifact", "Creature", "Land"]);
    expect(mainboard?.columns.map((column) => column.quantity)).toEqual([
      4, 4, 2,
    ]);
    expect(mainboard?.totalQuantity).toBe(6);
    expect(mainboard?.distinctCardCount).toBe(2);
  });

  it("counts split printings of one card once in the distinct-card total", () => {
    const firstPrinting = cardset("first", "mainboard", 1, "Creature");
    const secondPrinting = cardset("second", "mainboard", 2, "Creature");
    secondPrinting.oracle_id = firstPrinting.oracle_id;

    const mainboard = matrix([firstPrinting, secondPrinting]).rows[0];

    expect(mainboard?.totalQuantity).toBe(3);
    expect(mainboard?.distinctCardCount).toBe(1);
  });

  it("preserves preferred role ordering and includes a card in each evaluated role", () => {
    const card = cardset("engine", "mainboard", 2, "Artifact");
    const scores = new Map<string, CardRoleEvaluation>([
      [
        card.oracle_id,
        {
          oracle_id: card.oracle_id,
          deck_revision: 1,
          evaluator_version: "test",
          prompt_version: "test",
          overall_score: 4,
          overall_comment: "",
          cached: false,
          roles: [
            { role: "payoff", score: 4, description: "", answers: {} },
            { role: "mana_ramp", score: 3, description: "", answers: {} },
          ],
        },
      ],
    ]);
    const result = buildCardZoneMatrix({
      cards: [card, cardset("unknown", "considering", 1, "Creature")],
      format: "standard",
      groupBy: "role",
      sortBy: "alphabetical",
      provider: "tcgplayer",
      scores,
    });

    expect(result.columns).toEqual([
      "Land",
      "Mana Ramp",
      "Card Advantage",
      "Card Selection",
      "Targeted Disruption",
      "Mass Disruption",
      "Enabler",
      "Payoff",
      "Enhancer",
      "Unscored",
    ]);
    expect(result.rows[0]?.columns.map((column) => column.quantity)).toEqual([
      0, 2, 0, 0, 0, 0, 0, 2, 0, 0,
    ]);
  });
});
