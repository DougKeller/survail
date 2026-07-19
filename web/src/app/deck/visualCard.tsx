import { GripVertical, ShieldUser, TagX } from "lucide-react";
import type { ReactNode } from "react";

import { ClickableCardImage } from "../../modules/cards/ui/cardPresentation";
import type { CardSet } from "../../modules/decks/contracts";
import type { CardRoleEvaluation } from "../../modules/decks/evaluations/contracts";
import { IconButton } from "../../designsystem/primitives/button";
import {
  ImageTile,
  ImageTileActions,
  ImageTileBadge,
} from "../../designsystem/patterns/imageTile";
import { useOptionalCardZoneDrag } from "../editor/cardZoneDrag";
import { CardNoteButton, QuantityStepper } from "./cardRowActions";

export function VisualCard({
  add,
  card,
  disabled,
  editNote,
  markCommander,
  removeContextTag,
  remove,
  score,
  stacked,
  tagAction,
  visualId,
}: {
  add: () => void;
  card: CardSet;
  disabled: boolean;
  editNote: () => void;
  markCommander: (() => void) | null;
  removeContextTag?: { name: string; remove: () => void } | undefined;
  remove: () => void;
  score: CardRoleEvaluation | null;
  stacked: boolean;
  tagAction?: ReactNode;
  visualId: string;
}) {
  const drag = useOptionalCardZoneDrag();
  const draggableProps = drag?.draggableProps(card, visualId);
  const handleProps = drag?.handleProps(card, visualId);
  return (
    <ImageTile
      {...draggableProps}
      data-cardset-id={card.id}
      data-group-appearance={visualId}
      data-zone={card.zone}
    >
      <ClickableCardImage card={card} />
      {!stacked && card.quantity > 1 && (
        <ImageTileBadge aria-label={`${String(card.quantity)} copies`}>
          ×{card.quantity}
        </ImageTileBadge>
      )}
      {score !== null && (
        <ImageTileBadge
          aria-label={`${String(score.overall_score)} role score`}
          corner="bottom-right"
          title={score.roles
            .map((role) => `${role.role} ${String(role.score)}`)
            .join(", ")}
          tone="accent"
        >
          {score.overall_score}
        </ImageTileBadge>
      )}
      <ImageTileActions>
        {tagAction}
        {removeContextTag !== undefined && (
          <IconButton
            disabled={disabled}
            label={`Remove ${removeContextTag.name} tag from ${card.card_name}`}
            onClick={removeContextTag.remove}
            size="sm"
            title={`Remove ${removeContextTag.name} tag`}
            variant="ghost"
          >
            <TagX size={14} strokeWidth={2.75} />
          </IconButton>
        )}
        <CardNoteButton busy={disabled} card={card} onClick={editNote} />
        <QuantityStepper
          busy={disabled}
          card={card}
          onAdd={add}
          onRemove={remove}
        />
        {handleProps !== undefined && (
          <IconButton
            aria-pressed={handleProps["aria-pressed"]}
            disabled={disabled}
            dragHandle
            label={handleProps["aria-label"]}
            onLostPointerCapture={handleProps.onLostPointerCapture}
            onKeyDown={handleProps.onKeyDown}
            onPointerCancel={handleProps.onPointerCancel}
            onPointerDown={handleProps.onPointerDown}
            onPointerMove={handleProps.onPointerMove}
            onPointerUp={handleProps.onPointerUp}
            size="sm"
            title="Move one card"
            variant="ghost"
          >
            <GripVertical size={14} strokeWidth={2.75} />
          </IconButton>
        )}
        {markCommander !== null && (
          <IconButton
            disabled={disabled}
            label={`Mark ${card.card_name} as commander`}
            onClick={markCommander}
            size="sm"
            variant="ghost"
          >
            <ShieldUser size={14} strokeWidth={2.75} />
          </IconButton>
        )}
      </ImageTileActions>
    </ImageTile>
  );
}
