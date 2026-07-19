import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CardSet, Deck } from "../../modules/decks/contracts";
import { useDeckActions } from "./useDeckActions";

const apiMocks = vi.hoisted(() => ({
  addCardsetTag: vi.fn(),
  applyOperation: vi.fn(),
  createDeckTag: vi.fn(),
  deleteDeckTag: vi.fn(),
  operations: vi.fn(),
  removeCardsetTag: vi.fn(),
  setCardsetTagWeight: vi.fn(),
  updateDeckTag: vi.fn(),
}));

vi.mock("../api", () => ({
  api: {
    ...apiMocks,
  },
}));

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
    note: "The good one",
    tags: ["ramp"],
    scryfall: {} as CardSet["scryfall"],
    ...overrides,
  };
}

function deck(cardsets: CardSet[] = [card()]): Deck {
  return {
    id: "deck-1",
    title: "Deck",
    format: "modern",
    description: "",
    generated_description: null,
    goal: "",
    metadata: { kind: "constructed" },
    cardsets,
    is_sample: false,
    revision: 7,
    updated_at: "2026-07-18T00:00:00Z",
  };
}

function props(
  currentDeck: Deck,
  overrides: Partial<Parameters<typeof useDeckActions>[0]> = {},
): Parameters<typeof useDeckActions>[0] {
  return {
    bulkDecklist: "",
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
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("zone movement actions", () => {
  it("submits a one-copy move atomically against the current revision", async () => {
    const movingCard = card();
    const currentDeck = deck([movingCard]);
    const options = props(currentDeck);
    apiMocks.applyOperation.mockResolvedValue({
      deck: { ...currentDeck, revision: 8 },
      validation: { valid: true, card_count: 2, errors: [] },
    });
    apiMocks.operations.mockResolvedValue([]);
    const { result } = renderHook(() => useDeckActions(options));

    result.current.moveCardToZone(movingCard, "considering");

    await waitFor(() => {
      expect(apiMocks.applyOperation).toHaveBeenCalledOnce();
    });
    expect(apiMocks.applyOperation).toHaveBeenCalledWith(
      "deck-1",
      7,
      expect.arrayContaining([
        expect.objectContaining({ quantity_delta: -1, zone: "mainboard" }),
        expect.objectContaining({ quantity_delta: 1, zone: "considering" }),
      ]),
      "Moved one Sol Ring to Considering",
    );
    expect(options.setAnnouncement).toHaveBeenCalledWith(
      "Moved one Sol Ring to Considering",
    );
  });

  it("submits all source quantities in one revision-checked operation", async () => {
    const currentDeck = deck([
      card(),
      card({ id: "cardset-2", printing_id: "printing-2", quantity: 3 }),
      card({ id: "cardset-3", printing_id: "printing-3", zone: "sideboard" }),
    ]);
    apiMocks.applyOperation.mockResolvedValue({
      deck: { ...currentDeck, revision: 8 },
      validation: { valid: true, card_count: 2, errors: [] },
    });
    apiMocks.operations.mockResolvedValue([]);
    const { result } = renderHook(() => useDeckActions(props(currentDeck)));

    result.current.moveAllToConsidering("mainboard");

    await waitFor(() => {
      expect(apiMocks.applyOperation).toHaveBeenCalledOnce();
    });
    const call = apiMocks.applyOperation.mock.calls[0];
    if (call === undefined) throw new Error("Expected an operation call");
    expect(call[0]).toBe("deck-1");
    expect(call[1]).toBe(7);
    expect(call[2]).toHaveLength(4);
    expect(call[3]).toBe("Moved 5 copies from Mainboard to Considering");
  });

  it("does not start another movement while the editor is busy", () => {
    const movingCard = card();
    const currentDeck = deck([movingCard]);
    const { result } = renderHook(() =>
      useDeckActions(props(currentDeck, { busy: true })),
    );

    result.current.moveCardToZone(movingCard, "considering");
    result.current.moveAllToConsidering("mainboard");

    expect(apiMocks.applyOperation).not.toHaveBeenCalled();
  });
});

describe("deck tag actions", () => {
  it("adopts authoritative deck responses for tag CRUD", async () => {
    const currentDeck = deck();
    const created = {
      ...currentDeck,
      tags: [{ id: "tag-1", name: "Ramp", position: 0, target: 0 }],
    };
    apiMocks.createDeckTag.mockResolvedValue(created);
    const options = props(currentDeck);
    const { result } = renderHook(() => useDeckActions(options));

    await result.current.createTag(" Ramp ");

    await waitFor(() => {
      expect(apiMocks.createDeckTag).toHaveBeenCalledWith("deck-1", "Ramp");
    });
    expect(options.setDeck).toHaveBeenCalledWith(created);
    expect(options.setAnnouncement).toHaveBeenCalledWith("Created tag Ramp");
  });

  it("updates tag metadata and deletes tags by stable id", async () => {
    const currentDeck = deck();
    apiMocks.updateDeckTag.mockResolvedValue(currentDeck);
    apiMocks.deleteDeckTag.mockResolvedValue(currentDeck);
    const { result, rerender } = renderHook(
      ({ options }) => useDeckActions(options),
      { initialProps: { options: props(currentDeck) } },
    );

    await result.current.updateTag("tag-1", "Graveyard", 12);
    await waitFor(() => {
      expect(apiMocks.updateDeckTag).toHaveBeenCalledWith("deck-1", "tag-1", {
        name: "Graveyard",
        target: 12,
      });
    });
    rerender({ options: props(currentDeck) });
    await result.current.deleteTag("tag-1", "Graveyard");
    await waitFor(() => {
      expect(apiMocks.deleteDeckTag).toHaveBeenCalledWith("deck-1", "tag-1");
    });
  });

  it("sets a card tag weight with the selected preset", async () => {
    const taggedCard = card({ tag_ids: ["ramp"] });
    const currentDeck = deck([taggedCard]);
    apiMocks.setCardsetTagWeight.mockResolvedValue(currentDeck);
    const { result } = renderHook(() => useDeckActions(props(currentDeck)));

    void result.current.setTagWeight(taggedCard, "ramp", "Ramp", 0.5);

    await waitFor(() => {
      expect(apiMocks.setCardsetTagWeight).toHaveBeenCalledWith(
        "deck-1",
        "cardset-1",
        "ramp",
        0.5,
      );
    });
  });

  it("adds and removes one contextual tag from the whole cardset", async () => {
    const taggedCard = card({ tag_ids: ["ramp"] });
    const currentDeck = deck([taggedCard]);
    apiMocks.addCardsetTag.mockResolvedValue(currentDeck);
    apiMocks.removeCardsetTag.mockResolvedValue(currentDeck);
    const { result } = renderHook(() => useDeckActions(props(currentDeck)));

    result.current.addTagToCard(taggedCard, "graveyard", "Graveyard");
    await waitFor(() => {
      expect(apiMocks.addCardsetTag).toHaveBeenCalledWith(
        "deck-1",
        "cardset-1",
        "graveyard",
      );
    });
    result.current.removeTagFromCard(taggedCard, "ramp", "Ramp");
    await waitFor(() => {
      expect(apiMocks.removeCardsetTag).toHaveBeenCalledWith(
        "deck-1",
        "cardset-1",
        "ramp",
      );
    });
  });

  it("skips empty names and idempotent card tag changes", () => {
    const taggedCard = card({ tag_ids: ["ramp"] });
    const { result } = renderHook(() =>
      useDeckActions(props(deck([taggedCard]))),
    );

    void result.current.createTag("  ");
    void result.current.updateTag("ramp", " ", 0);
    result.current.addTagToCard(taggedCard, "ramp", "Ramp");
    result.current.removeTagFromCard(taggedCard, "missing", "Missing");

    expect(apiMocks.createDeckTag).not.toHaveBeenCalled();
    expect(apiMocks.updateDeckTag).not.toHaveBeenCalled();
    expect(apiMocks.addCardsetTag).not.toHaveBeenCalled();
    expect(apiMocks.removeCardsetTag).not.toHaveBeenCalled();
  });
});
