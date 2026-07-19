import { describe, expect, it } from "vitest";

import { dragScrollDelta } from "./dragAutoScroll";

describe("dragScrollDelta", () => {
  it("scrolls toward an edge and stays still in the safe center", () => {
    const bounds = { bottom: 300, left: 100, right: 500, top: 100 };

    expect(dragScrollDelta(bounds, 110, 110)).toEqual({ x: -24, y: -24 });
    expect(dragScrollDelta(bounds, 490, 290)).toEqual({ x: 24, y: 24 });
    expect(dragScrollDelta(bounds, 300, 200)).toEqual({ x: 0, y: 0 });
  });
});
