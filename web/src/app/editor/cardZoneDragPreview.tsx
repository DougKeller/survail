import { CardDragPreview } from "../../designsystem/patterns/cardDragPreview";
import { imageSource } from "../../modules/cards/ui/cardPresentationShared";
import type { DraggedCard } from "./cardZoneDragTypes";

interface CardZoneDragPreviewProps {
  dragged: DraggedCard | null;
  point: { x: number; y: number } | null;
}

export function CardZoneDragPreview({
  dragged,
  point,
}: CardZoneDragPreviewProps) {
  if (dragged === null || point === null) return null;

  return (
    <CardDragPreview
      cardName={dragged.card.card_name}
      imageUrl={imageSource(dragged.card.scryfall)}
      x={point.x}
      y={point.y}
    />
  );
}
