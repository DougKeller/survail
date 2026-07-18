import { useId } from "react";

import { Button } from "../../designsystem/primitives/button";
import { Dialog } from "../../designsystem/primitives/dialog";
import { Field, Input, TextArea } from "../../designsystem/primitives/input";
import { Inline } from "../../designsystem/layout/inline";
import { Stack } from "../../designsystem/layout/stack";
import { Text } from "../../designsystem/layout/typography";
import { useDeckEditorContext } from "./deckEditorContext";

export function EditDeckModal() {
  const {
    data: { busy },
    deck,
    details: {
      description,
      goal,
      handleSaveDetails,
      setDescription,
      setGoal,
      setTitle,
      title,
    },
    modals: { setShowEditDeck },
  } = useDeckEditorContext();
  const close = (): void => {
    setShowEditDeck(false);
  };
  const fieldId = useId();
  return (
    <Dialog onClose={close} open title="Edit deck">
      <Stack
        as="form"
        gap={3}
        onSubmit={(event) => {
          event.preventDefault();
          void (async () => {
            if (await handleSaveDetails(event)) setShowEditDeck(false);
          })();
        }}
      >
        <Text muted size="md">
          Define the deck&apos;s North Star. Card roles and scores are evaluated
          manually.
        </Text>
        <Field htmlFor={`${fieldId}-title`} label="Title">
          <Input
            autoFocus
            id={`${fieldId}-title`}
            maxLength={120}
            onChange={(event) => {
              setTitle(event.target.value);
            }}
            required
            value={title}
          />
        </Field>
        <Field htmlFor={`${fieldId}-description`} label="Description">
          <TextArea
            id={`${fieldId}-description`}
            onChange={(event) => {
              setDescription(event.target.value);
            }}
            value={description}
          />
        </Field>
        <Field htmlFor={`${fieldId}-goal`} label="Goal / North Star">
          <TextArea
            id={`${fieldId}-goal`}
            onChange={(event) => {
              setGoal(event.target.value);
            }}
            placeholder="What should this deck consistently accomplish?"
            value={goal}
          />
        </Field>
        <Field htmlFor={`${fieldId}-format`} label="Format">
          <Input id={`${fieldId}-format`} readOnly value={deck.format} />
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
            Save changes
          </Button>
        </Inline>
      </Stack>
    </Dialog>
  );
}
