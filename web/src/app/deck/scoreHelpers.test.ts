import { describe, expect, it } from "vitest";

import type { CardSet, Deck } from "../../modules/decks/contracts";
import type { CardRoleEvaluation } from "../../modules/decks/evaluations/contracts";
import { createDeckScoreContext, rankScores } from "./scoreHelpers";

function cardset(
  id: string,
  name: string,
  core: boolean,
): CardSet {
  return {
    id,
    quantity: 1,
    zone: "mainboard",
    finish: "nonfoil",
    printing_id: `printing-${id}`,
    oracle_id: `oracle-${id}`,
    card_name: name,
    set_code: "tst",
    collector_number: "1",
    core,
    note: "",
    tags: [],
    scryfall: {
      id: `printing-${id}`,
      oracle_id: `oracle-${id}`,
      name,
      mana_cost: "{2}",
      cmc: 2,
      type_line: "Artifact",
      oracle_text: "",
      legalities: { commander: "legal" },
      set: "tst",
      set_name: "Test",
      collector_number: "1",
      rarity: "rare",
      finishes: ["nonfoil"],
      image_uris: null,
      card_faces: [],
    },
  };
}

function deckWithCards(cardsets: CardSet[]): Deck {
  return {
    id: "deck-1",
    title: "Test Deck",
    format: "commander",
    description: "",
    generated_description: null,
    goal: "Test sorting",
    metadata: { kind: "commander", commander_oracle_ids: [] },
    cardsets,
    is_sample: false,
    revision: 1,
    updated_at: "2026-06-20T00:00:00Z",
  };
}

describe("rankScores", () => {
  it("sorts starred cards ahead of unstarred cards even without evaluations", () => {
    const deck = deckWithCards([
      cardset("1", "Alpha Signet", false),
      cardset("2", "Beta Relic", true),
    ]);
    const context = createDeckScoreContext(deck);
    const rows = context.rows(new Map<string, CardRoleEvaluation>());

    const ranked = rankScores(
      rows,
      { key: "starred", direction: "desc" },
      () => null,
    );

    expect(ranked.map((row) => row.name)).toEqual([
      "Beta Relic",
      "Alpha Signet",
    ]);
  });

  it("tracks every zone a card appears in for score rows", () => {
    const splitCard = cardset("3", "Split Role", false);
    const deck = deckWithCards([
      { ...splitCard, zone: "considering" },
      { ...splitCard, id: "3b", zone: "mainboard" },
    ]);
    const context = createDeckScoreContext(deck);

    expect(context.rows(new Map<string, CardRoleEvaluation>())[0]?.zones).toEqual([
      "mainboard",
      "considering",
    ]);
  });
});
