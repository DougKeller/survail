import { memo } from "react";
import type { CardSet } from "../../modules/decks/contracts";
import { CardZoneDragProvider } from "./cardZoneDrag";
import { MatrixRows } from "./cardsZoneMatrix";
import { useDeckCardsContext } from "./deckEditorContext";
import { CardTagPickerProvider } from "./cardTagPicker";

export const CardsZoneMatrix = memo(function CardsZoneMatrix({
  onPreview,
}: {
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
      moveCard={moveCardToZone}
      tagCard={(card, tagId) => {
        const tag = deck.tags?.find((item) => item.id === tagId);
        if (tag !== undefined) addTagToCard(card, tag.id, tag.name);
      }}
      zones={zones}
    >
      <CardTagPickerProvider>
        <MatrixRows onPreview={onPreview} />
      </CardTagPickerProvider>
    </CardZoneDragProvider>
  );
});
