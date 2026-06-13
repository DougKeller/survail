import { useCallback, useMemo, useState, type ReactNode } from "react";

import "./cardPresentation.css";
import { InlineCardText, ClickableCardImage } from "./cardPresentationInline";
import { CardDetailsModal } from "./cardPresentationModal";
import {
  cardName,
  CardPresentationContext,
  type DeckCardEvaluationContext,
  type CardPresentationSource,
} from "./cardPresentationShared";

export { ClickableCardImage, InlineCardText };
export type { CardPresentationSource } from "./cardPresentationShared";

export function CardPresentationProvider({
  cards,
  children,
  deckEvaluation,
}: {
  cards: readonly CardPresentationSource[];
  children: ReactNode;
  deckEvaluation?: DeckCardEvaluationContext;
}) {
  const [selectedCard, setSelectedCard] =
    useState<CardPresentationSource | null>(null);
  const cardsByName = useMemo(
    () =>
      new Map(
        cards.map(
          (card) => [cardName(card).toLocaleLowerCase(), card] as const,
        ),
      ),
    [cards],
  );
  const openCard = useCallback((card: CardPresentationSource): void => {
    setSelectedCard(card);
  }, []);
  const closeCard = useCallback((): void => {
    setSelectedCard(null);
  }, []);
  const value = useMemo(
    () => ({ cardsByName, openCard }),
    [cardsByName, openCard],
  );

  return (
    <CardPresentationContext.Provider value={value}>
      {children}
      {selectedCard !== null && (
        <CardDetailsModal
          close={closeCard}
          source={selectedCard}
          {...(deckEvaluation === undefined ? {} : { deckEvaluation })}
        />
      )}
    </CardPresentationContext.Provider>
  );
}
