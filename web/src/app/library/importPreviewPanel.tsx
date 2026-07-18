import { Check } from "lucide-react";

import { Inline } from "../../designsystem/layout/inline";
import { Stack } from "../../designsystem/layout/stack";
import { Heading, Text } from "../../designsystem/layout/typography";
import { Button } from "../../designsystem/primitives/button";
import { Card, CardKicker } from "../../designsystem/primitives/card";
import { Pip } from "../../designsystem/primitives/pip";
import { Tag } from "../../designsystem/primitives/tag";
import { CardRow } from "../../designsystem/patterns/cardRow";
import { ValidationItem } from "../../designsystem/patterns/validationItem";
import { Price, titleize, zoneLabel } from "../deckPrimitives";

import type { MoxfieldImportPreview } from "../../modules/imports/contracts";

export function ImportPreviewPanel({
  busy,
  createImportedDeck,
  preview,
  title,
}: {
  busy: boolean;
  createImportedDeck: () => Promise<void>;
  preview: MoxfieldImportPreview | null;
  title: string;
}) {
  const totalCards =
    preview?.cardsets.reduce((total, card) => total + card.quantity, 0) ?? 0;
  return (
    <Stack gap={3}>
      <Inline align="baseline" gap={2}>
        <Heading level={3} size="lg">
          Resolved preview
        </Heading>
        {preview !== null && (
          <Text as="span" muted size="sm">
            {totalCards} cards · {preview.cardsets.length} unique cards
          </Text>
        )}
      </Inline>
      {preview === null && (
        <Text muted>Preview the import to review resolved cards.</Text>
      )}
      {preview !== null && preview.errors.length > 0 && (
        <Card role="alert">
          <CardKicker>{preview.errors.length} lines need attention</CardKicker>
          {preview.errors.map((issue) => (
            <ValidationItem
              detail={issue.raw_line}
              key={`${String(issue.line_number)}-${issue.code}`}
              label={`Line ${String(issue.line_number)}: ${titleize(
                issue.code,
              )} — ${issue.message}`}
              status="warn"
            />
          ))}
        </Card>
      )}
      {preview?.used_ai_fallback === true && (
        <ValidationItem
          label={
            "AI-assisted import extracted cards from the supplied text. " +
            "Review the resolved cards before creating the deck."
          }
          role="status"
          status="warn"
        />
      )}
      {preview !== null && preview.cardsets.length > 0 && (
        <Stack gap={1}>
          {preview.cardsets.map((card) => (
            <CardRow
              key={`${card.printing_id}-${card.finish}-${card.zone}`}
              leading={
                <Pip aria-hidden="true" tone="accent2">
                  <Check size={10} strokeWidth={3.5} />
                </Pip>
              }
              name={card.card_name}
              qty={card.quantity}
            >
              <Text as="span" muted size="xs">
                {zoneLabel(card.zone)} · {card.set_code.toUpperCase()}
              </Text>
              <Price card={card.scryfall} finish={card.finish} />
              {card.tags.length > 0 && (
                <Tag tone="neutral">{card.tags.join(" · ")}</Tag>
              )}
            </CardRow>
          ))}
        </Stack>
      )}
      {preview === null ? (
        <Text muted size="xs">
          Preview the decklist before creating the deck.
        </Text>
      ) : (
        <Stack gap={1}>
          <Button
            block
            disabled={busy || preview.errors.length > 0 || title.trim() === ""}
            onClick={() => void createImportedDeck()}
          >
            Create imported deck
          </Button>
          <Text muted size="xs">
            Imports reject unresolved lines rather than creating a partial deck.
          </Text>
        </Stack>
      )}
    </Stack>
  );
}
