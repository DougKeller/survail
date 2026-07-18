import { Pencil, RefreshCw } from "lucide-react";

import { Button } from "../../designsystem/primitives/button";
import { Card, CardKicker } from "../../designsystem/primitives/card";
import { Notice } from "../../designsystem/primitives/notice";
import { Divided } from "../../designsystem/layout/divided";
import { Grid } from "../../designsystem/layout/grid";
import { Inline } from "../../designsystem/layout/inline";
import { PageHeader } from "../../designsystem/layout/page";
import { Stack } from "../../designsystem/layout/stack";
import { Heading, Kicker, Text } from "../../designsystem/layout/typography";

import type { Deck, Validation } from "../../modules/decks/contracts";

import { GeneratedDescription, RichTextBlock, titleize } from "./text";

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Inline gap={4} justify="between">
      <Text as="span" muted size="md">
        {label}
      </Text>
      <Text as="span" size="md">
        <strong>{value}</strong>
      </Text>
    </Inline>
  );
}

export function DeckInfoView({
  deck,
  edit,
  refreshOverview,
  busy,
  validation,
}: {
  deck: Deck;
  edit: () => void;
  refreshOverview: () => void;
  busy: boolean;
  validation: Validation | null;
}) {
  const hasGeneratedDescription =
    deck.generated_description !== null &&
    (typeof deck.generated_description !== "string" ||
      deck.generated_description.trim() !== "");
  const generatedDescription = hasGeneratedDescription
    ? deck.generated_description
    : null;

  return (
    <Stack as="section" gap={6} labelledBy="deck-info-title">
      <PageHeader
        actions={
          <Button
            icon={<Pencil size={15} strokeWidth={2.75} />}
            onClick={edit}
            variant="secondary"
          >
            Edit deck info
          </Button>
        }
      >
        <Stack gap={1}>
          <Kicker>Deck information</Kicker>
          <Heading id="deck-info-title" level={2} size="2xl">
            Purpose and overview
          </Heading>
        </Stack>
      </PageHeader>
      <Grid gap={4}>
        <Card as="article" elevation="sm">
          <Stack gap={2}>
            <CardKicker>Goal / North Star</CardKicker>
            {deck.goal === "" ? (
              <Text muted>
                Define what this deck should consistently accomplish.
              </Text>
            ) : (
              <RichTextBlock cards={deck.cardsets} text={deck.goal} />
            )}
          </Stack>
        </Card>
        <Card as="article">
          <Stack gap={2}>
            <CardKicker>About this deck</CardKicker>
            {deck.description === "" ? (
              <Text muted>No user description yet.</Text>
            ) : (
              <RichTextBlock cards={deck.cardsets} text={deck.description} />
            )}
          </Stack>
        </Card>
        <Card as="article">
          <Stack gap={2}>
            <Inline gap={3} justify="between">
              <CardKicker>AI-generated overview</CardKicker>
              <Button
                disabled={busy}
                icon={<RefreshCw size={15} strokeWidth={2.75} />}
                onClick={refreshOverview}
                variant="ghost"
              >
                Refresh overview
              </Button>
            </Inline>
            {generatedDescription === null ? (
              <Notice role="status">
                {busy
                  ? "Generating an overview…"
                  : "An overview will be generated when this view opens."}
              </Notice>
            ) : (
              <GeneratedDescription
                cards={deck.cardsets}
                description={generatedDescription}
              />
            )}
          </Stack>
        </Card>
        <Card as="article">
          <Stack gap={2}>
            <CardKicker>Deck details</CardKicker>
            <Divided>
              <DetailRow label="Format" value={titleize(deck.format)} />
              <DetailRow
                label="Cards"
                value={
                  validation?.card_count ??
                  deck.cardsets.reduce(
                    (total, card) => total + card.quantity,
                    0,
                  )
                }
              />
              <DetailRow
                label="Status"
                value={validation?.valid === true ? "Valid" : "Needs attention"}
              />
              <DetailRow label="Version" value={deck.revision} />
            </Divided>
          </Stack>
        </Card>
      </Grid>
    </Stack>
  );
}
