import { Button } from "../../designsystem/primitives/button";
import { Dialog } from "../../designsystem/primitives/dialog";
import { Text } from "../../designsystem/layout/typography";

export function ClearScoreCacheDialog({
  clearing,
  onCancel,
  onConfirm,
  open,
}: {
  clearing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
}) {
  return (
    <Dialog
      actions={
        <>
          <Button disabled={clearing} onClick={onCancel} variant="secondary">
            Cancel
          </Button>
          <Button disabled={clearing} onClick={onConfirm}>
            {clearing ? "Clearing…" : "Clear cache"}
          </Button>
        </>
      }
      busy={clearing}
      onClose={onCancel}
      open={open}
      title="Clear all cached scores for this deck?"
    >
      <Text>
        Scores disappear until cards are scored again. This does not change the
        decklist.
      </Text>
    </Dialog>
  );
}
