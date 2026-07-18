import { Button } from "../../designsystem/primitives/button";
import { Dialog } from "../../designsystem/primitives/dialog";
import { Field, TextArea } from "../../designsystem/primitives/input";
import { Notice } from "../../designsystem/primitives/notice";
import { Stack } from "../../designsystem/layout/stack";
import { Text } from "../../designsystem/layout/typography";
import { useDeckEditorContext } from "./deckEditorContext";

export function BulkEditModal() {
  const {
    data: { busy },
    modals: {
      applyBulkEdit,
      bulkDecklist,
      bulkEditErrors,
      setBulkDecklist,
      setShowBulkEdit,
    },
  } = useDeckEditorContext();
  const close = (): void => {
    setShowBulkEdit(false);
  };
  return (
    <Dialog
      actions={
        <>
          <Button disabled={busy} onClick={close} variant="secondary">
            Cancel
          </Button>
          <Button
            disabled={busy || bulkDecklist.trim() === ""}
            onClick={() => void applyBulkEdit()}
          >
            {busy ? "Applying changes…" : "Apply changes"}
          </Button>
        </>
      }
      onClose={close}
      open
      title="Bulk edit"
    >
      <Stack gap={3}>
        <Text muted size="md">
          Edit quantities, cards, or sections as free text. Changes are applied
          together.
        </Text>
        {bulkEditErrors.length > 0 && (
          <Notice role="alert" tone="error">
            {bulkEditErrors.map((message) => (
              <Text key={message} size="md">
                {message}
              </Text>
            ))}
          </Notice>
        )}
        <Field label="Decklist">
          <TextArea
            aria-label="Decklist"
            mono
            onChange={(event) => {
              setBulkDecklist(event.target.value);
            }}
            rows={14}
            spellCheck={false}
            value={bulkDecklist}
          />
        </Field>
      </Stack>
    </Dialog>
  );
}
