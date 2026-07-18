import { createContext, useContext, type ReactNode } from "react";

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

export function DeckEditorProvider({
  advisor,
  children,
  editor,
}: {
  advisor: DeckAdvisorValue;
  children: ReactNode;
  editor: DeckEditorValue;
}) {
  return (
    <DeckEditorContext.Provider value={editor}>
      <DeckAdvisorContext.Provider value={advisor}>
        {children}
      </DeckAdvisorContext.Provider>
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

export function useDeckAdvisorContext(): DeckAdvisorValue {
  const value = useContext(DeckAdvisorContext);
  if (value === null) {
    throw new Error("useDeckAdvisorContext requires a DeckEditorProvider");
  }
  return value;
}
