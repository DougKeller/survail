import type { ChangeEvent, KeyboardEvent } from "react";

import { Stack } from "../../designsystem/layout/stack";
import { Text } from "../../designsystem/layout/typography";
import { Button } from "../../designsystem/primitives/button";
import { Dialog } from "../../designsystem/primitives/dialog";
import { Field, Input } from "../../designsystem/primitives/input";
import { Select } from "../../designsystem/primitives/select";
import { DECK_FORMATS } from "../deckPrimitives";

import type { DeckFormat } from "../../modules/decks/contracts";

const FORMAT_OPTIONS = DECK_FORMATS.map((deckFormat) => ({
  label: deckFormat,
  value: deckFormat,
}));

export function AddDeckModal({
  busy,
  format,
  handleFormatChange,
  handleSubmit,
  onClose,
  open,
  title,
  setTitle,
}: {
  busy: boolean;
  format: DeckFormat;
  handleFormatChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  handleSubmit: () => Promise<void>;
  onClose: () => void;
  open: boolean;
  title: string;
  setTitle: (value: string) => void;
}) {
  function submitOnEnter(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (!busy && title.trim() !== "") void handleSubmit();
  }

  return (
    <Dialog
      actions={
        <>
          <Button onClick={onClose} variant="ghost">
            Cancel
          </Button>
          <Button
            disabled={busy || title.trim() === ""}
            onClick={() => void handleSubmit()}
          >
            Create deck
          </Button>
        </>
      }
      onClose={onClose}
      open={open}
      title="Add Deck"
    >
      <Stack gap={3}>
        <Text muted size="md">
          Choose a title and format to create an empty deck.
        </Text>
        <Field htmlFor="add-deck-title-input" label="Title">
          <Input
            autoFocus
            id="add-deck-title-input"
            maxLength={120}
            onChange={(event) => {
              setTitle(event.target.value);
            }}
            onKeyDown={submitOnEnter}
            required
            value={title}
          />
        </Field>
        <Field htmlFor="add-deck-format-select" label="Format">
          <Select
            id="add-deck-format-select"
            onChange={handleFormatChange}
            options={FORMAT_OPTIONS}
            required
            value={format}
          />
        </Field>
      </Stack>
    </Dialog>
  );
}
