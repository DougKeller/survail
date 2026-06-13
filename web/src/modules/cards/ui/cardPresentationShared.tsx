import { createContext, useContext, type ReactNode } from "react";

import type { CardRoleEvaluation } from "../../decks/evaluations/contracts";
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

export function focusableElements(container: HTMLElement): HTMLElement[] {
  return [
    ...container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ];
}

export function displayPrice(
  label: string,
  value: string | null | undefined,
): ReactNode {
  return value === null || value === undefined ? null : (
    <span>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </span>
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
