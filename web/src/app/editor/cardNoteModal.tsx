import { useEffect, useState } from "react";

import type { CardSet } from "../../modules/decks/contracts";
import { Button } from "../../designsystem/primitives/button";
import { Dialog } from "../../designsystem/primitives/dialog";
import { Field, TextArea } from "../../designsystem/primitives/input";
import { Inline } from "../../designsystem/layout/inline";
import { Stack } from "../../designsystem/layout/stack";
import { Text } from "../../designsystem/layout/typography";
import { useDeckEditorContext } from "./deckEditorContext";

export function CardNoteModal({ cardset }: { cardset: CardSet }) {
  const {
    actions: { updateCardNote },
    data: { busy },
    display: { scoringEnabled },
    modals: { setActiveCardNote },
  } = useDeckEditorContext();
  const close = (): void => {
    setActiveCardNote(null);
  };
  const [note, setNote] = useState(cardset.note);

  useEffect(() => {
    setNote(cardset.note);
  }, [cardset.id, cardset.note]);

  return (
    <Dialog onClose={close} open title="Card note">
      <Stack
        as="form"
        gap={3}
        onSubmit={(event) => {
          event.preventDefault();
          updateCardNote(cardset, note);
          setActiveCardNote(null);
        }}
      >
        {scoringEnabled && (
          <Text muted size="md">
            This note is included when AI evaluates or reasons about this card
            in the context of the deck.
          </Text>
        )}
        <Field label={cardset.card_name}>
          <TextArea
            aria-label={cardset.card_name}
            autoFocus
            maxLength={2000}
            onChange={(event) => {
              setNote(event.target.value);
            }}
            placeholder={
              scoringEnabled
                ? "Add context for AI evaluation, combo lines, exclusions, or role expectations."
                : "Add context, combo lines, or exclusions."
            }
            value={note}
          />
        </Field>
        <Inline gap={2} justify="end">
          <Button
            disabled={busy}
            onClick={close}
            type="button"
            variant="secondary"
          >
            Cancel
          </Button>
          <Button disabled={busy} type="submit">
            Save note
          </Button>
        </Inline>
      </Stack>
    </Dialog>
  );
}
