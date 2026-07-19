import type {
  CardSet,
  CardZone,
  DeckOperationChangeInput,
} from "../../modules/decks/contracts";

export type BulkMoveSource = "mainboard" | "sideboard";

function changeFor(
  cardset: CardSet,
  zone: CardZone,
  quantityDelta: number,
): DeckOperationChangeInput {
  return {
    printing_id: cardset.printing_id,
    quantity_delta: quantityDelta,
    zone,
    finish: cardset.finish,
    note: cardset.note,
    tags: cardset.tags,
  };
}

/** Build one atomic operation which moves exactly one copy between zones. */
export function moveOneChanges(
  cardset: CardSet,
  destination: CardZone,
): DeckOperationChangeInput[] {
  if (cardset.zone === destination || cardset.quantity < 1) return [];
  return [
    changeFor(cardset, cardset.zone, -1),
    changeFor(cardset, destination, 1),
  ];
}

/** Build one atomic operation which empties a board zone into Considering. */
export function moveAllToConsideringChanges(
  cardsets: readonly CardSet[],
  source: BulkMoveSource,
): DeckOperationChangeInput[] {
  return cardsets.flatMap((cardset) =>
    cardset.zone === source && cardset.quantity > 0
      ? [
          changeFor(cardset, source, -cardset.quantity),
          changeFor(cardset, "considering", cardset.quantity),
        ]
      : [],
  );
}

export function bulkMoveSummary(
  cardsets: readonly CardSet[],
  source: BulkMoveSource,
): { uniqueCards: number; totalQuantity: number } {
  const sourceCards = cardsets.filter(
    (cardset) => cardset.zone === source && cardset.quantity > 0,
  );
  return {
    uniqueCards: sourceCards.length,
    totalQuantity: sourceCards.reduce(
      (total, cardset) => total + cardset.quantity,
      0,
    ),
  };
}

export function moveOneAnnouncement(
  cardName: string,
  destination: CardZone,
): string {
  const destinationLabel =
    destination === "commander"
      ? "Command zone"
      : destination.charAt(0).toUpperCase() + destination.slice(1);
  return `Moved one ${cardName} to ${destinationLabel}`;
}

export function moveAllAnnouncement(
  source: BulkMoveSource,
  totalQuantity: number,
): string {
  const sourceLabel = source === "mainboard" ? "Mainboard" : "Sideboard";
  const copies = totalQuantity === 1 ? "copy" : "copies";
  return `Moved ${String(totalQuantity)} ${copies} from ${sourceLabel} to Considering`;
}
