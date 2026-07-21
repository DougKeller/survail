import { describe, expect, it } from "vitest";

import type { DeckTag } from "../../modules/decks/contracts";
import {
  nextTagColumnReorderPreview,
  reorderedTagIds,
  tagColumnReorderAppearance,
  type TagColumnReorderPreview,
} from "./tagColumnOrder";

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

  it("removes only the source and inserts a ghost beside the hover target", () => {
    const preview: TagColumnReorderPreview = {
      side: "before",
      sourceId: "draw",
      targetId: "removal",
    };

    expect(tagColumnReorderAppearance(preview, "draw")).toEqual({
      dragging: true,
      ghostSide: null,
    });
    expect(tagColumnReorderAppearance(preview, "ramp")).toEqual({
      dragging: false,
      ghostSide: null,
    });
    expect(tagColumnReorderAppearance(preview, "removal")).toEqual({
      dragging: false,
      ghostSide: "before",
    });
  });

  it("uses the source position as the initial ghost position", () => {
    const preview: TagColumnReorderPreview = {
      side: "before",
      sourceId: "ramp",
      targetId: "ramp",
    };

    expect(tagColumnReorderAppearance(preview, "ramp")).toEqual({
      dragging: true,
      ghostSide: "before",
    });
  });

  it("preserves preview identity while the cursor remains at one boundary", () => {
    const preview: TagColumnReorderPreview = {
      side: "after",
      sourceId: "draw",
      targetId: "ramp",
    };

    expect(nextTagColumnReorderPreview(preview, { ...preview })).toBe(preview);
    expect(
      nextTagColumnReorderPreview(preview, {
        ...preview,
        targetId: "removal",
      }),
    ).not.toBe(preview);
  });
});
