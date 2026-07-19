import { useState, type ReactNode } from "react";
import { Tag } from "lucide-react";

import type { CardSet } from "../../modules/decks/contracts";
import { Button, IconButton } from "../../designsystem/primitives/button";
import { Segmented } from "../../designsystem/primitives/choice";
import { Popover, PopoverAnchor } from "../../designsystem/primitives/popover";
import { Inline } from "../../designsystem/layout/inline";
import { Stack } from "../../designsystem/layout/stack";
import { Text } from "../../designsystem/layout/typography";
import {
  cardTagWeight,
  formattedTagWeight,
  TAG_WEIGHT_OPTIONS,
} from "../deck/tagTargets";
import { useDismissibleSurface } from "../deckPrimitives";
import { useDeckCardsContext } from "./deckEditorContext";

export function CardTagPickerProvider({ children }: { children: ReactNode }) {
  return children;
}

export function CardTagPicker({ card }: { card: CardSet }) {
  const {
    actions: { addTagToCard, setTagWeight },
    data: { busy },
    deck,
  } = useDeckCardsContext();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const containerRef = useDismissibleSurface<HTMLDivElement>(
    open,
    () => {
      setOpen(false);
    },
    { manageFocus: false },
  );
  const tags = deck.tags ?? [];
  const orderedTags = [...tags].sort((left, right) => {
    const leftAssigned = card.tag_ids?.includes(left.id) === true;
    const rightAssigned = card.tag_ids?.includes(right.id) === true;
    return Number(rightAssigned) - Number(leftAssigned);
  });
  return (
    <PopoverAnchor ref={containerRef}>
      <IconButton
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={busy || tags.length === 0}
        label={`Edit tags and weights for ${card.card_name}`}
        onClick={() => {
          setOpen((current) => !current);
        }}
        size="sm"
        title="Edit tags and weights"
        variant="ghost"
      >
        <Tag size={14} strokeWidth={2.75} />
      </IconButton>
      {open && (
        <Popover align="end" label={`Tags and weights for ${card.card_name}`}>
          <Stack gap={2}>
            <Text muted size="2xs">
              Weight controls how much each copy counts toward the tag target.
            </Text>
            {orderedTags.map((tag) => {
              const assigned = card.tag_ids?.includes(tag.id) === true;
              if (!assigned) {
                return (
                  <Button
                    alignStart
                    disabled={busy || pending}
                    key={tag.id}
                    onClick={() => {
                      addTagToCard(card, tag.id, tag.name);
                    }}
                    variant="secondary"
                  >
                    Add {tag.name}
                  </Button>
                );
              }
              const weight = cardTagWeight(card, tag.id);
              return (
                <Inline align="center" gap={2} key={tag.id} wrap>
                  <Text as="span" size="sm">
                    {tag.name}
                  </Text>
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
        </Popover>
      )}
    </PopoverAnchor>
  );
}
