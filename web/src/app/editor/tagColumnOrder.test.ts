import { describe, expect, it } from "vitest";

import type { DeckTag } from "../../modules/decks/contracts";
import { reorderedTagIds } from "./tagColumnOrder";

const TAGS: DeckTag[] = [
  { id: "draw", name: "Draw", position: 1, target: 0 },
  { id: "ramp", name: "Ramp", position: 0, target: 0 },
  { id: "removal", name: "Removal", position: 2, target: 0 },
];

describe("tag column ordering", () => {
  it("moves a tag before or after another tag in position order", () => {
    expect(reorderedTagIds(TAGS, "removal", "ramp", "before")).toEqual([
      "removal",
      "ramp",
      "draw",
    ]);
    expect(reorderedTagIds(TAGS, "ramp", "removal", "after")).toEqual([
      "draw",
      "removal",
      "ramp",
    ]);
  });

  it("cannot insert before the fixed Untagged boundary", () => {
    expect(reorderedTagIds(TAGS, "draw", "__untagged__", "before")).toEqual([
      "ramp",
      "draw",
      "removal",
    ]);
  });
});
