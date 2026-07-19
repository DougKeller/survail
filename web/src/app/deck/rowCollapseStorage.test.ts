import { beforeEach, describe, expect, it } from "vitest";

import {
  storeCardRowCollapsed,
  storedCardRowCollapsed,
} from "./rowCollapseStorage";

describe("card row collapse storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults non-mainboard rows to expanded", () => {
    expect(storedCardRowCollapsed("deck-1", "sideboard")).toBe(false);
    expect(storedCardRowCollapsed("deck-1", "considering")).toBe(false);
  });

  it("accepts a layout default when no preference has been stored", () => {
    expect(storedCardRowCollapsed("deck-1", "considering", true)).toBe(true);
    storeCardRowCollapsed("deck-1", "considering", false);
    expect(storedCardRowCollapsed("deck-1", "considering", true)).toBe(false);
  });

  it("stores collapse state independently by deck and zone", () => {
    storeCardRowCollapsed("deck-1", "sideboard", true);
    storeCardRowCollapsed("deck-1", "considering", false);
    storeCardRowCollapsed("deck-2", "sideboard", false);

    expect(storedCardRowCollapsed("deck-1", "sideboard")).toBe(true);
    expect(storedCardRowCollapsed("deck-1", "considering")).toBe(false);
    expect(storedCardRowCollapsed("deck-2", "sideboard")).toBe(false);
  });

  it("treats malformed values as expanded", () => {
    localStorage.setItem(
      "survail.card-row-collapsed:deck-1:sideboard",
      "maybe",
    );

    expect(storedCardRowCollapsed("deck-1", "sideboard")).toBe(false);
  });
});
