import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { Deck } from "../../modules/decks/contracts";
import type { useDeckAdvisor } from "./useDeckAdvisor";
import type { useDeckEditor } from "./useDeckEditor";

/**
 * The editor slices from useDeckEditor, plus the loaded deck narrowed to
 * non-null: EditorScreen only mounts the provider once the deck exists.
 */
export type DeckEditorValue = ReturnType<typeof useDeckEditor> & {
  deck: Deck;
};

export type DeckAdvisorValue = ReturnType<typeof useDeckAdvisor>;

const DeckEditorContext = createContext<DeckEditorValue | null>(null);
const DeckAdvisorContext = createContext<DeckAdvisorValue | null>(null);

type DeckCardsValue = Pick<DeckEditorValue, "deck"> & {
  actions: Pick<
    DeckEditorValue["actions"],
    | "addTagToCard"
    | "changeQuantity"
    | "deleteTag"
    | "markAsCommander"
    | "moveAllToConsidering"
    | "moveCardToZone"
    | "removeTagFromCard"
    | "reorderTags"
    | "setTagWeight"
    | "updateTag"
  >;
  data: Pick<DeckEditorValue["data"], "busy">;
  display: Pick<DeckEditorValue["display"], "displayPreferences">;
  modals: Pick<DeckEditorValue["modals"], "setActiveCardNote">;
  scoring: Pick<DeckEditorValue["scoring"], "scores">;
};

const DeckCardsContext = createContext<DeckCardsValue | null>(null);

export function DeckEditorProvider({
  advisor,
  children,
  editor,
}: {
  advisor: DeckAdvisorValue;
  children: ReactNode;
  editor: DeckEditorValue;
}) {
  // Search text, dialogs, analytics, and advisor state change frequently but do
  // not affect the card matrix. Keep those editor updates from invalidating
  // every rendered card (which can be hundreds of nodes in stacks view).
  const cards = useMemo<DeckCardsValue>(
    () => ({
      actions: {
        addTagToCard: editor.actions.addTagToCard,
        changeQuantity: editor.actions.changeQuantity,
        deleteTag: editor.actions.deleteTag,
        markAsCommander: editor.actions.markAsCommander,
        moveAllToConsidering: editor.actions.moveAllToConsidering,
        moveCardToZone: editor.actions.moveCardToZone,
        removeTagFromCard: editor.actions.removeTagFromCard,
        reorderTags: editor.actions.reorderTags,
        setTagWeight: editor.actions.setTagWeight,
        updateTag: editor.actions.updateTag,
      },
      data: { busy: editor.data.busy },
      deck: editor.deck,
      display: {
        displayPreferences: {
          columnSize: editor.display.displayPreferences.columnSize,
          groupBy: editor.display.displayPreferences.groupBy,
          sortBy: editor.display.displayPreferences.sortBy,
          view: editor.display.displayPreferences.view,
        },
      },
      modals: { setActiveCardNote: editor.modals.setActiveCardNote },
      scoring: { scores: editor.scoring.scores },
    }),
    [
      editor.actions.addTagToCard,
      editor.actions.changeQuantity,
      editor.actions.deleteTag,
      editor.actions.markAsCommander,
      editor.actions.moveAllToConsidering,
      editor.actions.moveCardToZone,
      editor.actions.removeTagFromCard,
      editor.actions.reorderTags,
      editor.actions.setTagWeight,
      editor.actions.updateTag,
      editor.data.busy,
      editor.deck,
      editor.display.displayPreferences.columnSize,
      editor.display.displayPreferences.groupBy,
      editor.display.displayPreferences.sortBy,
      editor.display.displayPreferences.view,
      editor.modals.setActiveCardNote,
      editor.scoring.scores,
    ],
  );
  return (
    <DeckEditorContext.Provider value={editor}>
      <DeckCardsContext.Provider value={cards}>
        <DeckAdvisorContext.Provider value={advisor}>
          {children}
        </DeckAdvisorContext.Provider>
      </DeckCardsContext.Provider>
    </DeckEditorContext.Provider>
  );
}

export function useDeckEditorContext(): DeckEditorValue {
  const value = useContext(DeckEditorContext);
  if (value === null) {
    throw new Error("useDeckEditorContext requires a DeckEditorProvider");
  }
  return value;
}

export function useDeckCardsContext(): DeckCardsValue {
  const value = useContext(DeckCardsContext);
  if (value === null) {
    throw new Error("useDeckCardsContext requires a DeckEditorProvider");
  }
  return value;
}

export function useDeckAdvisorContext(): DeckAdvisorValue {
  const value = useContext(DeckAdvisorContext);
  if (value === null) {
    throw new Error("useDeckAdvisorContext requires a DeckEditorProvider");
  }
  return value;
}
