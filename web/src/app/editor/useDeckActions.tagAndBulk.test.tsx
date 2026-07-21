import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CardSet, Deck } from "../../modules/decks/contracts";
import { useDeckActions } from "./useDeckActions";

const apiMocks = vi.hoisted(() => ({
  addCardsetTag: vi.fn(),
  applyOperation: vi.fn(),
  createDeckTag: vi.fn(),
  importMoxfield: vi.fn(),
}));

vi.mock("../api", () => ({ api: apiMocks }));

function card(overrides: Partial<CardSet> = {}): CardSet {
  return {
    id: "cardset-1",
    quantity: 2,
    zone: "mainboard",
    finish: "foil",
    printing_id: "printing-1",
    oracle_id: "oracle-1",
    card_name: "Sol Ring",
    set_code: "cmm",
    collector_number: "396",
    note: "",
    tags: [],
    scryfall: {} as CardSet["scryfall"],
    ...overrides,
  };
}

function deck(): Deck {
  return {
    id: "deck-1",
    title: "Deck",
    format: "modern",
    description: "",
    generated_description: null,
    goal: "",
    metadata: { kind: "constructed" },
    cardsets: [card()],
    is_sample: false,
    revision: 7,
    updated_at: "2026-07-18T00:00:00Z",
  };
}

function props(
  currentDeck: Deck,
  bulkDecklist = "",
): Parameters<typeof useDeckActions>[0] {
  return {
    bulkDecklist,
    busy: false,
    deck: currentDeck,
    description: "",
    goal: "",
    id: currentDeck.id,
    loadDeck: vi.fn(),
    navigate: vi.fn(),
    printingPreferences: { preserveTags: true },
    query: "",
    setAnnouncement: vi.fn(),
    setBulkDecklist: vi.fn(),
    setBulkEditErrors: vi.fn(),
    setBusy: vi.fn(),
    setDeck: vi.fn(),
    setError: vi.fn(),
    setOperations: vi.fn(),
    setResults: vi.fn(),
    setShowBulkEdit: vi.fn(),
    setShowSearchResults: vi.fn(),
    setValidation: vi.fn(),
    title: "Deck",
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("tag creation from a card drop", () => {
  it("adds the dropped card to the newly created tag", async () => {
    const currentDeck = deck();
    const created = {
      ...currentDeck,
      tags: [{ id: "tag-1", name: "Ramp", position: 0, target: 0 }],
    };
    const tagged = {
      ...created,
      cardsets: [card({ tag_ids: ["tag-1"], tags: ["Ramp"] })],
    };
    apiMocks.createDeckTag.mockResolvedValue(created);
    apiMocks.addCardsetTag.mockResolvedValue(tagged);
    const options = props(currentDeck);
    const { result } = renderHook(() => useDeckActions(options));

    await result.current.createTag("Ramp", currentDeck.cardsets[0]);

    expect(apiMocks.addCardsetTag).toHaveBeenCalledWith(
      "deck-1",
      "cardset-1",
      "tag-1",
    );
    expect(options.setDeck).toHaveBeenLastCalledWith(tagged);
  });
});

describe("bulk edit", () => {
  it("disables AI fallback and shows parser validation errors", async () => {
    const currentDeck = deck();
    const options = props(currentDeck, "not a deck entry");
    apiMocks.importMoxfield.mockResolvedValue({
      cardsets: [],
      errors: [
        {
          line_number: 1,
          raw_line: "not a deck entry",
          code: "invalid_line",
          message: "Line is not a valid Moxfield card entry",
        },
      ],
      used_ai_fallback: false,
    });
    const { result } = renderHook(() => useDeckActions(options));

    await result.current.applyBulkEdit();

    expect(apiMocks.importMoxfield).toHaveBeenCalledWith(
      "not a deck entry",
      { preserveTags: true },
      { allowAiFallback: false },
    );
    expect(options.setBulkEditErrors).toHaveBeenLastCalledWith([
      "Line 1: Line is not a valid Moxfield card entry",
    ]);
    expect(apiMocks.applyOperation).not.toHaveBeenCalled();
  });
});
