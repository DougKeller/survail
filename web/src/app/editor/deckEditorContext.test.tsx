import { memo } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Deck } from "../../modules/decks/contracts";
import {
  DeckEditorProvider,
  type DeckAdvisorValue,
  type DeckEditorValue,
  useDeckCardsContext,
} from "./deckEditorContext";

function cardsEditorValue(): DeckEditorValue {
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
      setTagWeight: action,
      updateTag: action,
    },
    data: { busy: false },
    deck: { cardsets: [], id: "deck-1" } as unknown as Deck,
    display: {
      displayPreferences: {
        groupBy: "type",
        sortBy: "alphabetical",
        view: "grid",
      },
    },
    modals: { setActiveCardNote: action },
    scoring: { scores: new Map() },
  } as unknown as DeckEditorValue;
}

describe("DeckEditorProvider card rendering isolation", () => {
  it("does not rerender a large card subtree for unrelated editor state", () => {
    const renderCard = vi.fn();
    const CardProbe = memo(function CardProbe() {
      useDeckCardsContext();
      renderCard();
      return null;
    });
    const cardSubtree = Array.from({ length: 250 }, (_, index) => (
      <CardProbe key={index} />
    ));
    const editor = cardsEditorValue();
    const advisor = {} as DeckAdvisorValue;
    const view = render(
      <DeckEditorProvider advisor={advisor} editor={editor}>
        {cardSubtree}
      </DeckEditorProvider>,
    );

    expect(renderCard).toHaveBeenCalledTimes(250);

    view.rerender(
      <DeckEditorProvider
        advisor={advisor}
        editor={{
          ...editor,
          search: { ...editor.search, query: "sol" },
        }}
      >
        {cardSubtree}
      </DeckEditorProvider>,
    );

    expect(renderCard).toHaveBeenCalledTimes(250);

    view.rerender(
      <DeckEditorProvider
        advisor={advisor}
        editor={{
          ...editor,
          scoring: { ...editor.scoring, scores: new Map() },
        }}
      >
        {cardSubtree}
      </DeckEditorProvider>,
    );

    expect(renderCard).toHaveBeenCalledTimes(500);
  });
});
