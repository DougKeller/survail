import { describe, expect, it } from "vitest";

import type { CardSet, PriceProvider } from "../../modules/decks/contracts";
import type { CardRoleEvaluation } from "../../modules/decks/evaluations/contracts";
import { groupedCards } from "./grouping";

function cardset(
  id: string,
  name: string,
  typeLine: string,
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
      type_line: typeLine,
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

describe("groupedCards", () => {
  it("moves groups containing starred cards ahead of unstarred groups", () => {
    const groups = groupedCards(
      [
        cardset("1", "Alpha Mage", "Creature", false),
        cardset("2", "Beta Relic", "Artifact", true),
      ],
      "type",
      "starred",
      "tcgplayer" satisfies PriceProvider,
      new Map<string, CardRoleEvaluation>(),
    );

    expect(groups.map((group) => group.label)).toEqual(["Artifact", "Creature"]);
    expect(groups[0]?.cards[0]?.card_name).toBe("Beta Relic");
  });
});
