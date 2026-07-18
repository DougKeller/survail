import { useEffect, useRef } from "react";

import { InlineCardText } from "../../modules/cards/ui/cardPresentation";
import { Button } from "../../designsystem/primitives/button";
import { Chip } from "../../designsystem/primitives/chip";
import { Dialog } from "../../designsystem/primitives/dialog";
import { StatusDot } from "../../designsystem/primitives/statusDot";
import { Stack } from "../../designsystem/layout/stack";
import { Kicker, Text } from "../../designsystem/layout/typography";
import { RichTextBlock } from "../deckPrimitives";
import { useDeckEditorContext } from "./deckEditorContext";

export function DescribeDialog() {
  const {
    data: { busy },
    deck,
    details: { handleGenerateDescription },
    modals: { setOpenDialog },
  } = useDeckEditorContext();
  const description = deck.generated_description;
  const close = (): void => {
    setOpenDialog(null);
  };

  // Generate once for the revision on display; regenerate is explicit.
  const generatedForRevision = useRef<string | null>(null);
  useEffect(() => {
    const revisionKey = `${deck.id}:${String(deck.revision)}`;
    if (generatedForRevision.current === revisionKey) return;
    generatedForRevision.current = revisionKey;
    if (description === null || description === "") {
      void handleGenerateDescription();
    }
  }, [deck.id, deck.revision, description, handleGenerateDescription]);

  return (
    <Dialog
      actions={
        <>
          <Text muted size="xs">
            Unchanged decks reuse the cache
          </Text>
          <Button onClick={close} variant="secondary">
            Close
          </Button>
          <Button
            disabled={busy}
            onClick={() => void handleGenerateDescription(true)}
          >
            Regenerate
          </Button>
        </>
      }
      onClose={close}
      open
      title="Deck description"
    >
      <Stack gap={3}>
        <Chip icon={<StatusDot />}>cached · rev {deck.revision}</Chip>
        {(description === null || description === "") && (
          <Text muted>
            {busy ? "Writing this deck up…" : "No description yet."}
          </Text>
        )}
        {typeof description === "string" && description !== "" && (
          <RichTextBlock cards={deck.cardsets} text={description} />
        )}
        {description !== null && typeof description !== "string" && (
          <Stack gap={3}>
            {(
              [
                ["The plan", description.overview],
                ["Early game", description.early_game],
                ["Midgame", description.midgame],
                ["Late game", description.lategame],
              ] as [string, string][]
            ).map(([label, body]) => (
              <Stack gap={1} key={label}>
                <Kicker tone="accent">{label}</Kicker>
                <Text size="base">
                  <InlineCardText cards={deck.cardsets} text={body} />
                </Text>
              </Stack>
            ))}
          </Stack>
        )}
      </Stack>
    </Dialog>
  );
}
