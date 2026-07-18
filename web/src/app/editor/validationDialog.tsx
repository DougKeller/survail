import { InlineCardText } from "../../modules/cards/ui/cardPresentation";
import { Button } from "../../designsystem/primitives/button";
import { Card, CardMeta, CardTitle } from "../../designsystem/primitives/card";
import { Dialog } from "../../designsystem/primitives/dialog";
import { Tag } from "../../designsystem/primitives/tag";
import { Inline } from "../../designsystem/layout/inline";
import { Stack } from "../../designsystem/layout/stack";
import { Text } from "../../designsystem/layout/typography";
import { ValidationItem } from "../../designsystem/patterns/validationItem";
import {
  groupedValidationErrors,
  messageFor,
  titleize,
} from "../deckPrimitives";
import { useDeckEditorContext } from "./deckEditorContext";

export function ValidationDialog() {
  const {
    data: { loadDeck, setError, validation },
    deck,
    modals: { setOpenDialog },
  } = useDeckEditorContext();
  const close = (): void => {
    setOpenDialog(null);
  };
  const revalidate = (): void => {
    void loadDeck().catch((reason: unknown) => {
      setError(reason instanceof Error ? messageFor(reason) : "Request failed");
    });
  };
  const groups = groupedValidationErrors(validation);
  return (
    <Dialog
      actions={
        <>
          <Button onClick={close} variant="secondary">
            Back to editor
          </Button>
          <Button onClick={revalidate}>Re-validate</Button>
        </>
      }
      onClose={close}
      open
      title="Validation"
    >
      <Stack gap={2}>
        <Inline gap={2}>
          <Tag tone="accent2">{titleize(deck.format)}</Tag>
          <Text as="span" muted size="sm">
            rev {deck.revision}
          </Text>
        </Inline>
        <ValidationItem
          detail={`${String(validation?.card_count ?? 0)} cards`}
          label="Deck size"
          status="ok"
        />
        {groups.length === 0 && (
          <ValidationItem
            detail="all checks passed"
            label="No issues found"
            status="ok"
          />
        )}
        {groups.map((group) => (
          <Stack gap={1} key={group.errorId}>
            <ValidationItem
              detail={`${String(group.errors.length)} flagged`}
              label={titleize(group.errorId)}
              status="warn"
            />
            {group.errors.map((validationError, index) => (
              <Text
                key={`${validationError.error_id}-${String(index)}`}
                muted
                size="sm"
              >
                <InlineCardText text={validationError.message} />
              </Text>
            ))}
          </Stack>
        ))}
        <Card>
          <CardTitle>Building freely?</CardTitle>
          <CardMeta>
            That&apos;s fine — validation only reports state and never blocks
            saving. The Considering zone is excluded from construction checks.
          </CardMeta>
        </Card>
      </Stack>
    </Dialog>
  );
}
