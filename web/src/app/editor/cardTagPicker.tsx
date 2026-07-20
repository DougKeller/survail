import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Ellipsis, MoveRight } from "lucide-react";

import type {
  CardSet,
  CardZone,
  DeckFormat,
} from "../../modules/decks/contracts";
import { Button, IconButton } from "../../designsystem/primitives/button";
import { Segmented } from "../../designsystem/primitives/choice";
import { Popover } from "../../designsystem/primitives/popover";
import { ToggleChip } from "../../designsystem/primitives/toggleChip";
import { Inline } from "../../designsystem/layout/inline";
import { Stack } from "../../designsystem/layout/stack";
import { Kicker, Text } from "../../designsystem/layout/typography";
import {
  cardTagWeight,
  formattedTagWeight,
  TAG_WEIGHT_OPTIONS,
} from "../deck/tagTargets";
import { canMoveToCommanderZone } from "../deck/cardZones";
import { searchAddZonesFor } from "../deck/constants";
import { zoneLabel } from "../deck/text";
import { useDismissibleSurface } from "../deckPrimitives";
import { useDeckCardsContext } from "./deckEditorContext";

export function CardTagPickerProvider({ children }: { children: ReactNode }) {
  return children;
}

export function moveZoneOptions(
  card: CardSet,
  format: DeckFormat,
): CardZone[] {
  return searchAddZonesFor(format).filter(
    (zone) =>
      zone !== card.zone &&
      (zone !== "commander" || canMoveToCommanderZone(card.scryfall, format)),
  );
}

export function CardTagPicker({ card }: { card: CardSet }) {
  const {
    actions: {
      addTagToCard,
      moveCardToZone,
      removeTagFromCard,
      setTagWeight,
    },
    data: { busy },
    deck,
  } = useDeckCardsContext();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const menuId = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState({ left: 8, top: 8, width: 320 });
  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (trigger === null) return;
    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    const width = Math.min(360, window.innerWidth - margin * 2);
    const left = Math.max(
      margin,
      Math.min(rect.right - width, window.innerWidth - width - margin),
    );
    const preferredTop = rect.bottom + 4;
    const top = Math.max(
      margin,
      Math.min(preferredTop, window.innerHeight - 360),
    );
    setPosition({ left, top, width });
  }, []);
  const surfaceRef = useDismissibleSurface<HTMLDivElement>(
    open,
    () => {
      setOpen(false);
    },
    { triggerRef },
  );
  const tags = deck.tags ?? [];
  const assignedTags = tags.filter(
    (tag) => card.tag_ids?.includes(tag.id) === true,
  );
  const destinationZones = moveZoneOptions(card, deck.format);
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
    <>
      <span ref={triggerRef}>
        <IconButton
          aria-controls={menuId}
          aria-expanded={open}
          aria-haspopup="dialog"
          disabled={busy}
          label={`Card options for ${card.card_name}`}
          onClick={() => {
            setOpen((current) => !current);
          }}
          size="sm"
          title="Card options"
          variant="ghost"
        >
          <Ellipsis size={14} strokeWidth={2.75} />
        </IconButton>
      </span>
      {open &&
        createPortal(
          <Popover
            fixed
            id={menuId}
            label={`Card options for ${card.card_name}`}
            layered
            ref={surfaceRef}
            style={position}
          >
          <Stack gap={4}>
            <Stack gap={1}>
              <Kicker as="span">Card options</Kicker>
              <Text muted size="sm">
                {card.card_name}
              </Text>
            </Stack>
            <Stack as="section" gap={2} aria-label="Assigned tags">
              <Kicker as="span">Tags</Kicker>
              <Inline gap={2} wrap>
                {tags.map((tag) => {
                  const assigned = card.tag_ids?.includes(tag.id) === true;
                  return (
                    <ToggleChip
                      aria-label={`${assigned ? "Remove" : "Add"} ${tag.name} tag ${assigned ? "from" : "to"} ${card.card_name}`}
                      disabled={busy || pending}
                      key={tag.id}
                      onClick={() => {
                        if (assigned) {
                          removeTagFromCard(card, tag.id, tag.name);
                        } else {
                          addTagToCard(card, tag.id, tag.name);
                        }
                      }}
                      pressed={assigned}
                    >
                      {tag.name}
                    </ToggleChip>
                  );
                })}
              </Inline>
            </Stack>
            {assignedTags.length > 0 && (
              <Stack as="section" gap={2} aria-label="Tag weights">
                <Kicker as="span">Weight per copy</Kicker>
                {assignedTags.map((tag) => {
                  const weight = cardTagWeight(card, tag.id);
                  return (
                    <Inline align="center" gap={2} key={tag.id} wrap>
                      <span>{tag.name}</span>
                      <Segmented
                        disabled={busy || pending}
                        label={`Weight for ${card.card_name} in ${tag.name}`}
                        name={`tag-weight-${card.id}-${tag.id}`}
                        onChange={(value) => {
                          setPending(true);
                          void setTagWeight(
                            card,
                            tag.id,
                            tag.name,
                            Number(value),
                          ).finally(() => {
                            setPending(false);
                          });
                        }}
                        options={TAG_WEIGHT_OPTIONS.map((option) => ({
                          label: formattedTagWeight(option),
                          value: String(option),
                        }))}
                        value={String(weight)}
                      />
                    </Inline>
                  );
                })}
              </Stack>
            )}
            {destinationZones.length > 0 && (
              <Stack as="section" gap={2} aria-label="Move card">
                <Kicker as="span">Move one card</Kicker>
                <Inline gap={2} wrap>
                  {destinationZones.map((zone) => (
                    <Button
                      aria-label={`Move ${card.card_name} to ${zoneLabel(zone)}`}
                      disabled={busy || pending}
                      icon={<MoveRight size={14} strokeWidth={2.75} />}
                      key={zone}
                      onClick={() => {
                        setOpen(false);
                        moveCardToZone(card, zone);
                      }}
                      variant="secondary"
                    >
                      {zoneLabel(zone)}
                    </Button>
                  ))}
                </Inline>
              </Stack>
            )}
          </Stack>
          </Popover>,
          document.body,
        )}
    </>
  );
}
