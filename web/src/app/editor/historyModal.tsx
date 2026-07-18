import { InlineCardText } from "../../modules/cards/ui/cardPresentation";
import type { DeckOperation } from "../../modules/decks/contracts";
import { Button } from "../../designsystem/primitives/button";
import { Dialog } from "../../designsystem/primitives/dialog";
import { Tag } from "../../designsystem/primitives/tag";
import { Inline } from "../../designsystem/layout/inline";
import { Stack } from "../../designsystem/layout/stack";
import { Text } from "../../designsystem/layout/typography";
import { TimelineItem } from "../../designsystem/patterns/timeline";
import { zoneLabel } from "../deckPrimitives";
import { useDeckEditorContext } from "./deckEditorContext";

const VISIBLE_CHANGES = 8;

function ChangeTags({ operation }: { operation: DeckOperation }) {
  const visible = operation.changes.slice(0, VISIBLE_CHANGES);
  const hidden = operation.changes.length - visible.length;
  return (
    <Inline gap={1} wrap>
      {visible.map((change, index) => (
        <Tag
          key={`${change.printing_id}-${String(index)}`}
          tone={change.quantity_delta > 0 ? "accent2" : "neutral"}
        >
          {change.quantity_delta > 0 ? "+" : "−"}
          {Math.abs(change.quantity_delta)}{" "}
          <InlineCardText text={`[[${change.card_name}]]`} />
          {change.zone === "mainboard" ? "" : ` · ${zoneLabel(change.zone)}`}
        </Tag>
      ))}
      {hidden > 0 && <Tag tone="neutral">+{hidden} more</Tag>}
    </Inline>
  );
}

export function HistoryModal() {
  const {
    actions: { handleRevert },
    data: { busy, operations },
    deck,
    modals: { setOpenDialog },
  } = useDeckEditorContext();
  const close = (): void => {
    setOpenDialog(null);
  };
  return (
    <Dialog
      actions={
        <>
          <Text muted size="xs">
            Operations are atomic and idempotent — reverts are auditable inverse
            operations, never edits.
          </Text>
          <Button onClick={close} variant="secondary">
            Close
          </Button>
        </>
      }
      onClose={close}
      open
      title="History"
    >
      <Stack gap={2}>
        <Text muted size="sm">
          {operations.length} recorded{" "}
          {operations.length === 1 ? "change" : "changes"} · rev {deck.revision}
        </Text>
        {operations.length === 0 && (
          <Text muted>No changes have been recorded.</Text>
        )}
        {operations.map((operation, index) => (
          <TimelineItem
            action={
              <Button
                disabled={busy}
                onClick={() => void handleRevert(operation)}
                variant="ghost"
              >
                Revert
              </Button>
            }
            key={operation.id}
            tone={index === operations.length - 1 ? "accent" : "default"}
          >
            <Stack gap={1}>
              <Inline align="baseline" gap={2} wrap>
                <Text as="span" size="md">
                  <InlineCardText text={operation.reason ?? "Deck update"} />
                </Text>
                <Text as="span" muted size="xs">
                  rev {operation.revision_after} ·{" "}
                  {new Date(operation.created_at).toLocaleString()} ·{" "}
                  {operation.changes.length}{" "}
                  {operation.changes.length === 1 ? "change" : "changes"}
                </Text>
              </Inline>
              <ChangeTags operation={operation} />
            </Stack>
          </TimelineItem>
        ))}
      </Stack>
    </Dialog>
  );
}
