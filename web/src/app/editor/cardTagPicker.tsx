import { useId, useState, type ReactNode } from "react";
import { Tag } from "lucide-react";

import type { CardSet } from "../../modules/decks/contracts";
import { Button, IconButton } from "../../designsystem/primitives/button";
import { Segmented } from "../../designsystem/primitives/choice";
import { Dialog } from "../../designsystem/primitives/dialog";
import { ToggleChip } from "../../designsystem/primitives/toggleChip";
import { Inline } from "../../designsystem/layout/inline";
import { Stack } from "../../designsystem/layout/stack";
import { Kicker } from "../../designsystem/layout/typography";
import {
  cardTagWeight,
  formattedTagWeight,
  TAG_WEIGHT_OPTIONS,
} from "../deck/tagTargets";
import { useDeckCardsContext } from "./deckEditorContext";

export function CardTagPickerProvider({ children }: { children: ReactNode }) {
  return children;
}

export function CardTagPicker({ card }: { card: CardSet }) {
  const {
    actions: { addTagToCard, removeTagFromCard, setTagWeight },
    data: { busy },
    deck,
  } = useDeckCardsContext();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const dialogId = useId();
  const tags = deck.tags ?? [];
  const assignedTags = tags.filter(
    (tag) => card.tag_ids?.includes(tag.id) === true,
  );
  return (
    <>
      <IconButton
        aria-controls={dialogId}
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
        <Dialog
          actions={
            <Button
              onClick={() => {
                setOpen(false);
              }}
              variant="secondary"
            >
              Done
            </Button>
          }
          busy={busy || pending}
          closeLabel={`Close tags for ${card.card_name}`}
          description="Select tags, then choose how much each copy contributes to its tag target."
          id={dialogId}
          onClose={() => {
            setOpen(false);
          }}
          open
          title={`Tags for ${card.card_name}`}
        >
          <Stack gap={4}>
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
                <Kicker as="span">Target contribution</Kicker>
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
          </Stack>
        </Dialog>
      )}
    </>
  );
}
