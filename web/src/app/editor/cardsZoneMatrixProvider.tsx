import { CardZoneDragProvider } from "./cardZoneDrag";
import { MatrixRows } from "./cardsZoneMatrix";
import { useDeckEditorContext } from "./deckEditorContext";

export function CardsZoneMatrix({
  onPreview,
}: {
  onPreview: (
    card: ReturnType<typeof useDeckEditorContext>["deck"]["cardsets"][number],
  ) => void;
}) {
  const {
    actions: { addTagToCard, moveCardToZone },
    data: { busy },
    deck,
  } = useDeckEditorContext();
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
      <MatrixRows onPreview={onPreview} />
    </CardZoneDragProvider>
  );
}
