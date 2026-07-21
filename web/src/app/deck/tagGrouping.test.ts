import { describe, expect, it } from "vitest";

import type { CardSet, DeckTag } from "../../modules/decks/contracts";
import { buildCardZoneMatrix } from "./cardZoneMatrix";

const TAGS: DeckTag[] = [
  { id: "graveyard", name: "Graveyard", position: 1, target: 0 },
  { id: "ramp", name: "Ramp", position: 0, target: 0 },
];

function card(
  id: string,
  tagIds: string[] | undefined,
  tags: string[] = [],
): CardSet {
  return {
    id,
    card_name: id,
    collector_number: "1",
    finish: "nonfoil",
    note: "",
    oracle_id: `oracle-${id}`,
    printing_id: `printing-${id}`,
    quantity: 2,
    scryfall: {
      id: `printing-${id}`,
      oracle_id: `oracle-${id}`,
      name: id,
      mana_cost: null,
      type_line: "Artifact",
      oracle_text: null,
      set: "tst",
      set_name: "Test",
      collector_number: "1",
      rarity: "common",
      finishes: ["nonfoil"],
      image_uris: null,
      card_faces: [],
      legalities: {},
    },
    set_code: "tst",
    ...(tagIds === undefined ? {} : { tag_ids: tagIds }),
    tags,
    zone: "mainboard",
  };
}

function matrix(cards: CardSet[], tags: DeckTag[] = TAGS) {
  return buildCardZoneMatrix({
    cards,
    deckTags: tags,
    format: "commander",
    groupBy: "tags",
    provider: "tcgplayer",
    scores: new Map(),
    sortBy: "alphabetical",
  });
}

describe("tag grouping", () => {
  it("does not rescan every card once per tag", () => {
    let membershipChecks = 0;
    const manyTags = Array.from({ length: 20 }, (_, index) => ({
      id: `tag-${String(index)}`,
      name: `Tag ${String(index)}`,
      position: index,
      target: 0,
    }));
    const cards = Array.from({ length: 40 }, (_, index) => {
      const tagIds = [`tag-${String(index % manyTags.length)}`];
      const includes = tagIds.includes.bind(tagIds);
      tagIds.includes = (value: string, fromIndex?: number) => {
        membershipChecks += 1;
        return includes(value, fromIndex);
      };
      return card(`Card ${String(index)}`, tagIds);
    });

    matrix(cards, manyTags);

    expect(membershipChecks).toBeLessThanOrEqual(cards.length);
  });

  it("omits Untagged when there are no cards without tags", () => {
    const result = matrix([]);

    expect(result.columns).toEqual(["Ramp", "Graveyard"]);
    expect(result.rows[0]?.columns.map((column) => column.tagId)).toEqual([
      "ramp",
      "graveyard",
    ]);
  });

  it("places cards with zero tags in a first Untagged column", () => {
    const result = matrix([card("None", [])]);

    expect(result.columns).toEqual(["Untagged", "Ramp", "Graveyard"]);
    expect(result.rows[0]?.columns.map((column) => column.tagId)).toEqual([
      null,
      "ramp",
      "graveyard",
    ]);
    expect(result.rows[0]?.columns[0]?.cards[0]?.card_name).toBe("None");
    expect(result.rows[0]?.columns[0]?.quantity).toBe(2);
  });

  it("shows a multiply-tagged card in every matching tag column", () => {
    const result = matrix([card("Engine", ["ramp", "graveyard"])]);
    const mainboard = result.rows[0];

    expect(result.columns).toEqual(["Ramp", "Graveyard"]);
    expect(mainboard?.columns.map((column) => column.quantity)).toEqual([2, 2]);
    expect(mainboard?.totalQuantity).toBe(2);
  });

  it("never puts cards with one or more tag ids in Untagged", () => {
    const result = matrix([
      card("None", []),
      card("Known", ["ramp"]),
      card("Stale", ["removed-tag"]),
    ]);

    expect(
      result.rows[0]?.columns[0]?.cards.map((item) => item.card_name),
    ).toEqual(["None"]);
  });

  it("supports legacy name tags only when stable tag ids are absent", () => {
    const result = matrix([card("Legacy", undefined, ["Graveyard"])]);

    expect(result.rows[0]?.columns[1]?.cards[0]?.card_name).toBe("Legacy");
    expect(result.columns).toEqual(["Ramp", "Graveyard"]);
  });

  it("keeps a user tag named Untagged distinct from the fallback", () => {
    const result = matrix(
      [card("Tagged", ["named-untagged"]), card("Fallback", [])],
      [{ id: "named-untagged", name: "Untagged", position: 0, target: 0 }],
    );

    expect(result.columns).toEqual(["Untagged", "Untagged"]);
    expect(result.rows[0]?.columns[0]?.tagId).toBeNull();
    expect(result.rows[0]?.columns[0]?.cards[0]?.card_name).toBe("Fallback");
    expect(result.rows[0]?.columns[1]?.tagId).toBe("named-untagged");
    expect(result.rows[0]?.columns[1]?.cards[0]?.card_name).toBe("Tagged");
  });
});
