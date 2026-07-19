import { Minus, NotebookPen, Plus } from "lucide-react";

import type { CardSet } from "../../modules/decks/contracts";
import { IconButton } from "../../designsystem/primitives/button";
import { Pip } from "../../designsystem/primitives/pip";

export function QuantityStepper({
  busy,
  card,
  onAdd,
  onRemove,
  showCount = false,
  withTitles = false,
}: {
  busy: boolean;
  card: CardSet;
  onAdd: () => void;
  onRemove: () => void;
  showCount?: boolean;
  withTitles?: boolean;
}) {
  return (
    <>
      <IconButton
        disabled={busy}
        label={`Remove one ${card.card_name}`}
        onClick={onRemove}
        size="sm"
        title={withTitles ? "Remove one" : undefined}
        variant="ghost"
      >
        <Minus size={14} strokeWidth={2.75} />
      </IconButton>
      {showCount && (
        <Pip aria-live="polite" tone="neutral">
          {card.quantity}
        </Pip>
      )}
      <IconButton
        disabled={busy}
        label={`Add one ${card.card_name}`}
        onClick={onAdd}
        size="sm"
        title={withTitles ? "Add one" : undefined}
        variant="ghost"
      >
        <Plus size={14} strokeWidth={2.75} />
      </IconButton>
    </>
  );
}

export function CardNoteButton({
  busy,
  card,
  onClick,
  withTitle = false,
}: {
  busy: boolean;
  card: CardSet;
  onClick: () => void;
  withTitle?: boolean;
}) {
  const noteIsEmpty = card.note.trim() === "";
  const noteTitle = noteIsEmpty ? "Add note" : "Edit note";
  return (
    <IconButton
      disabled={busy}
      label={`${noteIsEmpty ? "Add" : "Edit"} note for ${card.card_name}`}
      onClick={onClick}
      size="sm"
      title={withTitle ? noteTitle : undefined}
      variant="ghost"
    >
      <NotebookPen size={14} strokeWidth={2.75} />
    </IconButton>
  );
}
