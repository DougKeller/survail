import { useState } from "react";
import { Tag } from "lucide-react";

import type { CardSet } from "../../modules/decks/contracts";
import { Button, IconButton } from "../../designsystem/primitives/button";
import { Dialog } from "../../designsystem/primitives/dialog";
import { Stack } from "../../designsystem/layout/stack";
import { Text } from "../../designsystem/layout/typography";
import { useDeckEditorContext } from "./deckEditorContext";

export function CardTagPicker({ card }: { card: CardSet }) {
  const {
    actions: { addTagToCard },
    data: { busy },
    deck,
  } = useDeckEditorContext();
  const [open, setOpen] = useState(false);
  const tags = deck.tags ?? [];
  return (
    <>
      <IconButton
        disabled={busy || tags.length === 0}
        label={`Add tag to ${card.card_name}`}
        onClick={() => {
          setOpen(true);
        }}
        size="sm"
        title="Add tag"
        variant="ghost"
      >
        <Tag size={14} strokeWidth={2.75} />
      </IconButton>
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
        busy={busy}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        open={open}
        title={`Tag ${card.card_name}`}
      >
        <Stack gap={2}>
          <Text muted>Select a tag to add to the whole card stack.</Text>
          {tags.map((tag) => {
            const assigned = card.tag_ids?.includes(tag.id) === true;
            return (
              <Button
                alignStart
                disabled={busy || assigned}
                key={tag.id}
                onClick={() => {
                  addTagToCard(card, tag.id, tag.name);
                }}
                variant="secondary"
              >
                {tag.name}
                {assigned ? " · Added" : ""}
              </Button>
            );
          })}
        </Stack>
      </Dialog>
    </>
  );
}
