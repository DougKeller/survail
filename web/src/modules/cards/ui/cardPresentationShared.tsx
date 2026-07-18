import { createContext, useContext } from "react";

import type {
  CardRoleEvaluation,
  EvaluationFeedbackRequest,
} from "../../decks/evaluations/contracts";
import type { CardSet } from "../../decks/contracts";
import type { ScryfallCard } from "../contracts";

export type CardPresentationSource = CardSet | ScryfallCard;

export interface CardPresentationContextValue {
  cardsByName: ReadonlyMap<string, CardPresentationSource>;
  openCard: (card: CardPresentationSource) => void;
}

export interface CardDetails {
  card: ScryfallCard;
  finish: string | null;
}

export interface DeckCardEvaluationContext {
  deckId: string;
  deckRevision: number;
  scores: ReadonlyMap<string, CardRoleEvaluation>;
  /**
   * Injected by the app layer (dependency inversion): the cards module must
   * not call the decks module's evaluation API directly.
   */
  evaluateCards: (
    deckId: string,
    oracleIds: string[],
  ) => Promise<CardRoleEvaluation[]>;
  /** Injected by the app layer for the same reason as evaluateCards. */
  submitFeedback: (
    deckId: string,
    feedback: EvaluationFeedbackRequest,
  ) => Promise<{ id: string }>;
  /** Preferred ordering for the feedback role picker (all possible roles). */
  roleOrder: readonly string[];
}

export const CardPresentationContext =
  createContext<CardPresentationContextValue | null>(null);

function isCardSet(source: CardPresentationSource): source is CardSet {
  return "scryfall" in source;
}

export function cardDetails(source: CardPresentationSource): CardDetails {
  return isCardSet(source)
    ? { card: source.scryfall, finish: source.finish }
    : { card: source, finish: null };
}

export function cardName(source: CardPresentationSource): string {
  return isCardSet(source) ? source.card_name : source.name;
}

export function oracleId(source: CardPresentationSource): string {
  return isCardSet(source) ? source.oracle_id : source.oracle_id;
}

export function imageSource(card: ScryfallCard): string | null {
  return (
    card.image_uris?.normal ?? card.card_faces[0]?.image_uris?.normal ?? null
  );
}

export function useCardPresentation(): CardPresentationContextValue {
  const context = useContext(CardPresentationContext);
  if (context === null) {
    throw new Error(
      "useCardPresentation must be used within CardPresentationProvider",
    );
  }
  return context;
}

export function useOptionalCardPresentation(): CardPresentationContextValue | null {
  return useContext(CardPresentationContext);
}
