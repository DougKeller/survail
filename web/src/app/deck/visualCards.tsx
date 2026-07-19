import type {
  CardSet,
  DeckFormat,
  DeckTag,
} from "../../modules/decks/contracts";
import type { CardRoleEvaluation } from "../../modules/decks/evaluations/contracts";
import type { ReactNode } from "react";
import { CardStack, ImageGrid } from "../../designsystem/layout/cardGallery";
import { canMoveToCommanderZone } from "./cardZones";
import type { DeckView } from "./constants";
import { VisualCard } from "./visualCard";

export function VisualCardColumn({
  addCard,
  busy,
  cards,
  columnLabel,
  editCardNote,
  format,
  markCommander,
  removeContextTag,
  removeCard,
  scores,
  tagAction,
  tags,
  view,
}: {
  addCard: (card: CardSet) => void;
  busy: boolean;
  cards: CardSet[];
  columnLabel: string;
  editCardNote: (card: CardSet) => void;
  format: DeckFormat;
  markCommander: (card: CardSet) => void;
  removeContextTag?: ((card: CardSet) => void) | undefined;
  removeCard: (card: CardSet) => void;
  scores: ReadonlyMap<string, CardRoleEvaluation>;
  tagAction?: ((card: CardSet) => ReactNode) | undefined;
  tags: readonly DeckTag[];
  view: Exclude<DeckView, "text">;
}) {
  const renderCard = (card: CardSet, index: number, stacked: boolean) => (
    <VisualCard
      add={() => {
        addCard(card);
      }}
      card={card}
      disabled={busy}
      editNote={() => {
        editCardNote(card);
      }}
      key={`${card.id}-${String(index)}`}
      markCommander={
        card.zone !== "commander" &&
        canMoveToCommanderZone(card.scryfall, format)
          ? () => {
              markCommander(card);
            }
          : null
      }
      remove={() => {
        removeCard(card);
      }}
      removeContextTag={
        removeContextTag === undefined
          ? undefined
          : {
              name: columnLabel,
              remove: () => {
                removeContextTag(card);
              },
            }
      }
      score={scores.get(card.oracle_id) ?? null}
      stacked={stacked}
      tagAction={tagAction?.(card)}
      tags={tags}
      visualId={`${card.zone}-${columnLabel}-${card.id}-${String(index)}`}
    />
  );

  if (view === "grid") {
    return (
      <ImageGrid>{cards.map((card) => renderCard(card, 0, false))}</ImageGrid>
    );
  }
  return (
    <CardStack>
      {cards.flatMap((card) =>
        Array.from({ length: card.quantity }, (_, index) =>
          renderCard(card, index, true),
        ),
      )}
    </CardStack>
  );
}
