import { afterEach, describe, expect, it, vi } from "vitest";

import { dropTargetAtPoint } from "./cardZoneDropTargets";

afterEach(() => {
  Reflect.deleteProperty(document, "elementFromPoint");
  vi.restoreAllMocks();
});

describe("dropTargetAtPoint", () => {
  it("resolves the nested tag and zone with one DOM hit test", () => {
    const row = document.createElement("section");
    row.dataset["dropZone"] = "sideboard";
    const column = document.createElement("div");
    column.dataset["dropTagId"] = "removal";
    const card = document.createElement("div");
    column.append(card);
    row.append(column);
    const elementFromPoint = vi.fn(() => card);
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: elementFromPoint,
    });

    expect(dropTargetAtPoint(100, 200)).toEqual({
      tagId: "removal",
      zone: "sideboard",
    });
    expect(elementFromPoint).toHaveBeenCalledOnce();
  });
});
