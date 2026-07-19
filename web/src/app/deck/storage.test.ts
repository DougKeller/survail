import { beforeEach, describe, expect, it } from "vitest";

import {
  deckDisplayPreferencesFromSearchParams,
  editorViewFromSearchParams,
  scoringAwareDeckDisplayPreferences,
  scoringAwareEditorView,
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

describe("disabled scoring display preferences", () => {
  it("falls back from score and role URL options", () => {
    const requested = deckDisplayPreferencesFromSearchParams(
      new URLSearchParams("group=role&sort=score"),
      { groupBy: "type", sortBy: "mana-value", view: "stacks" },
    );

    expect(scoringAwareDeckDisplayPreferences(requested, false)).toEqual({
      groupBy: "mana-value",
      sortBy: "alphabetical",
      view: "stacks",
    });
    expect(
      scoringAwareEditorView(
        editorViewFromSearchParams(new URLSearchParams("tab=scores")),
        false,
      ),
    ).toBe("cards");
  });

  it("retains score and role options while scoring is enabled", () => {
    const preferences = {
      groupBy: "role" as const,
      sortBy: "score" as const,
      view: "grid" as const,
    };

    expect(scoringAwareDeckDisplayPreferences(preferences, true)).toBe(
      preferences,
    );
    expect(scoringAwareEditorView("scores", true)).toBe("scores");
  });
});
