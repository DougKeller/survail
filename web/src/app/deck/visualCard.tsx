import { ShieldUser, TagX } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";

import { ClickableCardImage } from "../../modules/cards/ui/cardPresentation";
import type { CardSet, DeckTag } from "../../modules/decks/contracts";
import type { CardRoleEvaluation } from "../../modules/decks/evaluations/contracts";
import { IconButton } from "../../designsystem/primitives/button";
import {
  ImageTile,
  ImageTileActions,
  ImageTileBadge,
} from "../../designsystem/patterns/imageTile";
import {
  useOptionalCardZoneDrag,
  useOptionalCardZoneDragStatic,
} from "../editor/cardZoneDrag";
import { CardNoteButton, QuantityStepper } from "./cardRowActions";
import { formattedTagWeight, nonDefaultTagWeights } from "./tagTargets";

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
  tags,
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
  tags: readonly DeckTag[];
  visualId: string;
}) {
  const drag = useOptionalCardZoneDragStatic();
  const dragInteraction = useOptionalCardZoneDrag();
  const draggableProps = drag?.draggableProps(card, visualId);
  const handleProps = dragInteraction?.handleProps(card, visualId);
  const weightedTags = nonDefaultTagWeights(card, tags);
  const showQuantity = !stacked && card.quantity > 1;
  const badgeLabel = [
    ...(showQuantity ? [`${String(card.quantity)} copies`] : []),
    ...weightedTags.map(
      (tag) => `${tag.name} weight ${formattedTagWeight(tag.weight)}`,
    ),
  ].join(", ");
  return (
    <ImageTile
      {...draggableProps}
      data-cardset-id={card.id}
      data-group-appearance={visualId}
      data-zone={card.zone}
    >
      <ClickableCardImage
        ariaPressed={handleProps?.["aria-pressed"]}
        card={card}
        keyShortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Enter Escape"
        onKeyDown={
          handleProps === undefined
            ? undefined
            : (event: KeyboardEvent<HTMLButtonElement>) => {
                const committing =
                  handleProps["aria-pressed"] &&
                  (event.key === "Enter" || event.key === " ");
                if (
                  event.key.startsWith("Arrow") ||
                  event.key === "Escape" ||
                  committing
                )
                  handleProps.onKeyDown(event);
              }
        }
      />
      {(showQuantity || weightedTags.length > 0) && (
        <ImageTileBadge
          aria-label={badgeLabel}
          title={weightedTags
            .map((tag) => `${tag.name}: ${formattedTagWeight(tag.weight)}`)
            .join(", ")}
        >
          {showQuantity ? `×${String(card.quantity)}` : ""}
          {showQuantity && weightedTags.length > 0 ? " · " : ""}
          {weightedTags.map((tag) => formattedTagWeight(tag.weight)).join("/")}
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
