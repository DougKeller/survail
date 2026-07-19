import "./cardDragPreview.css";

export function CardDragPreview({
  cardName,
  imageUrl,
  x,
  y,
}: {
  cardName: string;
  imageUrl: string | null;
  x: number;
  y: number;
}) {
  return (
    <div
      aria-hidden="true"
      className="ds-card-drag-preview"
      style={{ left: x, top: y }}
    >
      {imageUrl === null ? (
        <span className="ds-card-drag-preview-fallback">{cardName}</span>
      ) : (
        <img alt="" className="ds-card-drag-preview-image" src={imageUrl} />
      )}
    </div>
  );
}
