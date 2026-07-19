import { Button } from "../../designsystem/primitives/button";
import { Dialog } from "../../designsystem/primitives/dialog";
import { Text } from "../../designsystem/layout/typography";
import type { BulkMoveSource } from "./zoneMovement";

export function MoveAllConfirmationDialog({
  busy,
  onCancel,
  onConfirm,
  open,
  source,
  totalQuantity,
  uniqueCards,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  source: BulkMoveSource;
  totalQuantity: number;
  uniqueCards: number;
}) {
  const sourceLabel = source === "mainboard" ? "Mainboard" : "Sideboard";
  const close = (): void => {
    if (!busy) onCancel();
  };
  return (
    <Dialog
      actions={
        <>
          <Button disabled={busy} onClick={close} variant="secondary">
            Cancel
          </Button>
          <Button disabled={busy || totalQuantity === 0} onClick={onConfirm}>
            {busy ? "Moving…" : "Move all"}
          </Button>
        </>
      }
      busy={busy}
      onClose={close}
      open={open}
      title={`Move ${sourceLabel} to Considering?`}
    >
      <Text size="md">
        This moves {String(uniqueCards)} unique
        {uniqueCards === 1 ? " card" : " cards"} ({String(totalQuantity)} total
        {totalQuantity === 1 ? " copy" : " copies"}) to Considering.
      </Text>
    </Dialog>
  );
}
