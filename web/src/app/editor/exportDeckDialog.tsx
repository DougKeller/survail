import { useState } from "react";
import { Check, ClipboardCopy } from "lucide-react";

import type { CardSet, CardZone, Deck } from "../../modules/decks/contracts";
import { Button, IconButton } from "../../designsystem/primitives/button";
import { Dialog } from "../../designsystem/primitives/dialog";
import { TextArea } from "../../designsystem/primitives/input";
import { Inline } from "../../designsystem/layout/inline";
import { Stack } from "../../designsystem/layout/stack";
import { Heading, Text } from "../../designsystem/layout/typography";
import { zoneLabel } from "../deck/text";

const EXPORT_ZONE_ORDER: readonly CardZone[] = [
  "commander",
  "companion",
  "mainboard",
  "sideboard",
  "considering",
];

function assignedTagNames(card: CardSet, deck: Deck): string[] {
  const names =
    card.tag_ids === undefined
      ? card.tags
      : (deck.tags ?? [])
          .filter((tag) => card.tag_ids?.includes(tag.id) === true)
          .map((tag) => tag.name);
  return [...new Set(names)].sort((left, right) => left.localeCompare(right));
}

export function formatZoneDecklist(deck: Deck, zone: CardZone): string {
  return deck.cardsets
    .filter((card) => card.zone === zone && card.quantity > 0)
    .sort(
      (left, right) =>
        left.card_name.localeCompare(right.card_name) ||
        left.id.localeCompare(right.id),
    )
    .map((card) => {
      const tags = assignedTagNames(card, deck)
        .map((tag) => `#${tag}`)
        .join(" ");
      return `${String(card.quantity)} ${card.card_name}${tags === "" ? "" : ` ${tags}`}`;
    })
    .join("\n");
}

export function exportableZones(deck: Deck): CardZone[] {
  return EXPORT_ZONE_ORDER.filter((zone) =>
    deck.cardsets.some((card) => card.zone === zone && card.quantity > 0),
  );
}

export function ExportDeckDialog({
  deck,
  onClose,
}: {
  deck: Deck;
  onClose: () => void;
}) {
  const [copiedZone, setCopiedZone] = useState<CardZone | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const zones = exportableZones(deck);

  async function copyDecklist(zone: CardZone, decklist: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(decklist);
      setCopiedZone(zone);
      setCopyError(null);
    } catch {
      setCopyError(`Could not copy the ${zoneLabel(zone)} decklist.`);
    }
  }

  return (
    <Dialog
      actions={
        <Button onClick={onClose} variant="secondary">
          Close
        </Button>
      }
      description="Each zone includes quantities, card names, and assigned tags only."
      onClose={onClose}
      open
      size="wide"
      title="Export decklist"
    >
      <Stack gap={4}>
        <div aria-live="polite">
          {copyError !== null && (
            <div role="alert">
              <Text>{copyError}</Text>
            </div>
          )}
          {copyError === null && copiedZone !== null && (
            <Text muted size="sm">
              Copied {zoneLabel(copiedZone)} decklist.
            </Text>
          )}
        </div>
        {zones.length === 0 && <Text muted>No cards to export.</Text>}
        {zones.map((zone) => {
          const label = zoneLabel(zone);
          const decklist = formatZoneDecklist(deck, zone);
          return (
            <Stack as="section" gap={2} aria-label={label} key={zone}>
              <Inline align="center" gap={2} justify="between">
                <Heading level={3} size="lg">
                  {label}
                </Heading>
                <IconButton
                  label={`Copy ${label} decklist`}
                  onClick={() => void copyDecklist(zone, decklist)}
                  title={`Copy ${label} decklist`}
                  variant="ghost"
                >
                  {copiedZone === zone ? (
                    <Check size={16} strokeWidth={2.75} />
                  ) : (
                    <ClipboardCopy size={16} strokeWidth={2.75} />
                  )}
                </IconButton>
              </Inline>
              <TextArea
                aria-label={`${label} decklist`}
                mono
                readOnly
                rows={Math.min(Math.max(decklist.split("\n").length, 3), 14)}
                spellCheck={false}
                value={decklist}
              />
            </Stack>
          );
        })}
      </Stack>
    </Dialog>
  );
}
