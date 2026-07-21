import { describe, expect, it } from "vitest";

import { autoScrollCardRow, dragScrollDelta } from "./dragAutoScroll";

describe("dragScrollDelta", () => {
  it("scrolls toward an edge and stays still in the safe center", () => {
    const bounds = { bottom: 300, left: 100, right: 500, top: 100 };

    expect(dragScrollDelta(bounds, 110, 110)).toEqual({ x: -24, y: -24 });
    expect(dragScrollDelta(bounds, 490, 290)).toEqual({ x: 24, y: 24 });
    expect(dragScrollDelta(bounds, 300, 200)).toEqual({ x: 0, y: 0 });
  });
});

describe("autoScrollCardRow", () => {
  it("stops the animation loop when an edge cannot scroll farther", () => {
    const row = document.createElement("div");
    row.dataset["zoneScroll"] = "mainboard";
    Object.defineProperty(row, "getBoundingClientRect", {
      value: () => ({ bottom: 300, left: 100, right: 500, top: 100 }),
    });
    Object.defineProperty(row, "scrollBy", {
      value: () => undefined,
    });
    const target = document.createElement("div");
    row.append(target);

    expect(autoScrollCardRow(target, 490, 200)).toBe(false);
  });
});
