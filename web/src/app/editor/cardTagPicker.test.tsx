import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CardSet, Deck } from "../../modules/decks/contracts";
import { CardTagPicker } from "./cardTagPicker";
import {
  DeckEditorProvider,
  type DeckAdvisorValue,
  type DeckEditorValue,
} from "./deckEditorContext";

const card = {
  id: "card-1",
  card_name: "Sol Ring",
  tag_ids: ["ramp"],
  tag_weights: { ramp: 1 },
  tags: ["Ramp"],
} as unknown as CardSet;

function editor(setTagWeight: ReturnType<typeof vi.fn>): DeckEditorValue {
  const action = vi.fn();
  return {
    actions: {
      addTagToCard: action,
      changeQuantity: action,
      deleteTag: action,
      markAsCommander: action,
      moveAllToConsidering: action,
      moveCardToZone: action,
      removeTagFromCard: action,
      setTagWeight,
      updateTag: action,
    },
    data: { busy: false },
    deck: {
      cardsets: [card],
      id: "deck-1",
      tags: [{ id: "ramp", name: "Ramp", position: 0, target: 8 }],
    } as Deck,
    display: {
      displayPreferences: {
        groupBy: "tags",
        sortBy: "alphabetical",
        view: "grid",
      },
    },
    modals: { setActiveCardNote: action },
    scoring: { scores: new Map() },
  } as unknown as DeckEditorValue;
}

describe("CardTagPicker", () => {
  it("offers only preset weights from the card action popover", () => {
    const setTagWeight = vi.fn().mockResolvedValue(true);
    render(
      <DeckEditorProvider
        advisor={{} as DeckAdvisorValue}
        editor={editor(setTagWeight)}
      >
        <CardTagPicker card={card} />
      </DeckEditorProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Edit tags and weights for Sol Ring",
      }),
    );
    expect(
      screen.getByRole("group", { name: "Weight for Sol Ring in Ramp" }),
    ).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(4);

    fireEvent.click(screen.getByRole("radio", { name: "½" }));

    expect(setTagWeight).toHaveBeenCalledWith(card, "ramp", "Ramp", 0.5);
  });
});
