import { describe, expect, it } from "vitest";

import type { CardSet, DeckTag } from "../../modules/decks/contracts";
import {
  cardTagWeight,
  formattedTagWeight,
  nonDefaultTagWeights,
  tagTargetProgress,
} from "./tagTargets";

const tag: DeckTag = { id: "ramp", name: "Ramp", position: 0, target: 8 };

function card(overrides: Partial<CardSet>): CardSet {
  return {
    id: "card",
    quantity: 1,
    tag_ids: [],
    tag_weights: {},
    tags: [],
    ...overrides,
  } as CardSet;
}

describe("tag target progress", () => {
  it("sums card quantities multiplied by their tag weights", () => {
    const cards = [
      card({ quantity: 4, tag_ids: ["ramp"], tag_weights: { ramp: 0.5 } }),
      card({ quantity: 2, tag_ids: ["ramp"] }),
      card({ quantity: 9, tag_ids: ["other"] }),
    ];
    const defaultWeightCard = cards[1];
    if (defaultWeightCard === undefined) throw new Error("Missing test card");

    expect(tagTargetProgress(cards, tag)).toBe(4);
    expect(cardTagWeight(defaultWeightCard, "ramp")).toBe(1);
  });

  it("only returns non-default weights for persistent badges", () => {
    const weighted = card({
      tag_ids: ["ramp", "draw"],
      tag_weights: { ramp: 0.25, draw: 1 },
      tags: ["Ramp", "Draw"],
    });

    expect(nonDefaultTagWeights(weighted, [tag])).toEqual([
      { name: "Ramp", weight: 0.25 },
    ]);
    expect(formattedTagWeight(0.25)).toBe("¼");
  });
});
