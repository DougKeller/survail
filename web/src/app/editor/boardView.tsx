import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronDown, ChevronUp, GripVertical, TagX } from "lucide-react";

import {
  ClickableCardImage,
  InlineCardText,
} from "../../modules/cards/ui/cardPresentation";
import type { CardSet } from "../../modules/decks/contracts";
import { IconButton } from "../../designsystem/primitives/button";
import { ManaCost } from "../../designsystem/primitives/pip";
import { Popover, PopoverAnchor } from "../../designsystem/primitives/popover";
import { Inline } from "../../designsystem/layout/inline";
import { Stack } from "../../designsystem/layout/stack";
import { Text } from "../../designsystem/layout/typography";
import { CardRow } from "../../designsystem/patterns/cardRow";
import { CardNoteButton, QuantityStepper } from "../deck/cardRowActions";
import { useDismissibleSurface } from "../deckPrimitives";
import { useDeckEditorContext } from "./deckEditorContext";
import { useOptionalCardZoneDrag } from "./cardZoneDrag";

function CardQuickActions({
  card,
  removeContextTag,
  tagAction,
}: {
  card: CardSet;
  removeContextTag?: { name: string; remove: () => void } | undefined;
  tagAction?: ReactNode;
}) {
  const {
    actions: { changeQuantity },
    data: { busy },
    modals: { setActiveCardNote },
  } = useDeckEditorContext();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (trigger === null) return;
    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    const width = Math.min(220, window.innerWidth - margin * 2);
    const left = Math.max(
      margin,
      Math.min(rect.right - width, window.innerWidth - width - margin),
    );
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow >= 72
        ? rect.bottom + 4
        : Math.max(margin, rect.top - 56);
    setPosition({ left, top });
  }, []);
  const surfaceRef = useDismissibleSurface<HTMLDivElement>(
    open,
    () => {
      setOpen(false);
    },
    { manageFocus: false, triggerRef },
  );

  useEffect(() => {
    if (card.quantity <= 0) setOpen(false);
  }, [card.quantity]);

  useEffect(() => {
    if (!open) return undefined;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  return (
    <PopoverAnchor ref={triggerRef}>
      <IconButton
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={busy}
        label={`Open quick actions for ${card.card_name}`}
        onClick={() => {
          setOpen((current) => !current);
        }}
        size="sm"
        title="Open quick actions"
        variant="ghost"
      >
        {open ? (
          <ChevronUp size={14} strokeWidth={2.75} />
        ) : (
          <ChevronDown size={14} strokeWidth={2.75} />
        )}
      </IconButton>
      {open &&
        createPortal(
          <Popover
            fixed
            label={`${card.card_name} quick actions`}
            ref={surfaceRef}
            style={position}
          >
            <Stack gap={2}>
              <Inline gap={1}>
                <QuantityStepper
                  busy={busy}
                  card={card}
                  onAdd={() => {
                    changeQuantity(card, 1);
                  }}
                  onRemove={() => {
                    if (card.quantity <= 1) setOpen(false);
                    changeQuantity(card, -1);
                  }}
                  showCount
                  withTitles
                />
                <CardNoteButton
                  busy={busy}
                  card={card}
                  onClick={() => {
                    setOpen(false);
                    setActiveCardNote(card);
                  }}
                  withTitle
                />
                {tagAction}
                {removeContextTag !== undefined && (
                  <IconButton
                    label={`Remove ${removeContextTag.name} tag from ${card.card_name}`}
                    onClick={removeContextTag.remove}
                    size="sm"
                    title={`Remove ${removeContextTag.name} tag`}
                    variant="ghost"
                  >
                    <TagX size={14} strokeWidth={2.75} />
                  </IconButton>
                )}
              </Inline>
            </Stack>
          </Popover>,
          document.body,
        )}
    </PopoverAnchor>
  );
}

function BoardCardRow({
  card,
  commander,
  onPreview,
  removeContextTag,
  tagAction,
  visualId,
}: {
  card: CardSet;
  commander: boolean;
  onPreview: (card: CardSet) => void;
  removeContextTag?: { name: string; remove: () => void } | undefined;
  tagAction?: ReactNode;
  visualId: string;
}) {
  const note = card.note.trim();
  const drag = useOptionalCardZoneDrag();
  const draggableProps = drag?.draggableProps(card, visualId);
  const handleProps = drag?.handleProps(card, visualId);
  return (
    <Stack gap={1}>
      <CardRow
        {...draggableProps}
        data-cardset-id={card.id}
        data-group-appearance={visualId}
        data-zone={card.zone}
        dense
        emphasis={commander}
        grip={false}
        leadingAction={
          handleProps === undefined ? undefined : (
            <IconButton
              aria-pressed={handleProps["aria-pressed"]}
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
          )
        }
        leading={commander ? <ClickableCardImage card={card} /> : undefined}
        name={<InlineCardText cards={[card]} text={`[[${card.card_name}]]`} />}
        onFocus={() => {
          onPreview(card);
        }}
        onPointerEnter={() => {
          onPreview(card);
        }}
        qty={card.quantity}
        tone={commander ? "accent-2" : "default"}
      >
        <ManaCost cost={card.scryfall.mana_cost} />
        <CardQuickActions
          card={card}
          removeContextTag={removeContextTag}
          tagAction={tagAction}
        />
      </CardRow>
      {note !== "" && (
        <Text muted size="2xs">
          {note}
        </Text>
      )}
    </Stack>
  );
}

export function TextCardColumn({
  cards,
  columnLabel,
  onPreview,
  removeContextTag,
  tagAction,
}: {
  cards: CardSet[];
  columnLabel: string;
  onPreview: (card: CardSet) => void;
  removeContextTag?: ((card: CardSet) => void) | undefined;
  tagAction?: ((card: CardSet) => ReactNode) | undefined;
}) {
  return (
    <Stack gap={1}>
      {cards.map((card) => (
        <BoardCardRow
          card={card}
          commander={false}
          key={card.id}
          onPreview={onPreview}
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
          tagAction={tagAction?.(card)}
          visualId={`${card.zone}-${columnLabel}-${card.id}`}
        />
      ))}
    </Stack>
  );
}
