import { beforeEach, describe, expect, it } from "vitest";

import {
  deckDisplayPreferencesFromSearchParams,
  storeDeckSummaryOpen,
  storedDeckSummaryOpen,
} from "./storage";

describe("deck summary preference", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the summary by default", () => {
    expect(storedDeckSummaryOpen()).toBe(true);
  });

  it("accepts a responsive default when no preference is stored", () => {
    expect(storedDeckSummaryOpen(false)).toBe(false);
  });

  it("remembers whether the summary is open", () => {
    storeDeckSummaryOpen(false);
    expect(storedDeckSummaryOpen()).toBe(false);

    storeDeckSummaryOpen(true);
    expect(storedDeckSummaryOpen()).toBe(true);
  });
});

describe("tag display preference", () => {
  it("accepts tags from the group URL parameter", () => {
    const preferences = deckDisplayPreferencesFromSearchParams(
      new URLSearchParams("group=tags&view=grid&sort=alphabetical"),
      { groupBy: "type", sortBy: "mana-value", view: "stacks" },
    );

    expect(preferences.groupBy).toBe("tags");
  });
});
