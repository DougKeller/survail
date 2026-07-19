import { describe, expect, it } from "vitest";

import { clampDragPreviewPoint } from "./dragPreviewPosition";

describe("clampDragPreviewPoint", () => {
  it("keeps the tilted preview inside every viewport edge", () => {
    expect(clampDragPreviewPoint(-20, -10, 390, 844)).toEqual({ x: 0, y: 82 });
    expect(clampDragPreviewPoint(500, 900, 390, 844)).toEqual({
      x: 258,
      y: 762,
    });
  });
});
