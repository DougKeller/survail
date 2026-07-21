import { memo } from "react";
import type { CardSet } from "../../modules/decks/contracts";
import { CardZoneDragProvider } from "./cardZoneDrag";
import { MatrixRows } from "./cardsZoneMatrix";
import { useDeckCardsContext } from "./deckEditorContext";
import { CardTagPickerProvider } from "./cardTagPicker";
import { TagColumnOrderProvider } from "./tagColumnOrder";

export const CardsZoneMatrix = memo(function CardsZoneMatrix({
  onCreateTagForCard,
  onPreview,
}: {
  onCreateTagForCard: (card: CardSet) => void;
  onPreview: (card: CardSet) => void;
}) {
  const {
    actions: { addTagToCard, moveCardToZone },
    data: { busy },
    deck,
  } = useDeckCardsContext();
  const zones =
    deck.format === "commander" || deck.format === "brawl"
      ? (["mainboard", "considering"] as const)
      : (["mainboard", "sideboard", "considering"] as const);
  return (
    <CardZoneDragProvider
      busy={busy}
      createTagForCard={onCreateTagForCard}
      moveCard={moveCardToZone}
      tagCard={(card, tagId) => {
        const tag = deck.tags?.find((item) => item.id === tagId);
        if (tag !== undefined) addTagToCard(card, tag.id, tag.name);
      }}
      zones={zones}
    >
      <TagColumnOrderProvider>
        <CardTagPickerProvider>
          <MatrixRows onPreview={onPreview} />
        </CardTagPickerProvider>
      </TagColumnOrderProvider>
    </CardZoneDragProvider>
  );
});
