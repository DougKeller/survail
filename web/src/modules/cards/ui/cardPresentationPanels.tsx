import type { ReactNode } from "react";

import { Card } from "../../../designsystem/primitives/card";
import { Notice } from "../../../designsystem/primitives/notice";
import { ManaCost } from "../../../designsystem/primitives/pip";
import { Tag } from "../../../designsystem/primitives/tag";
import { Divided } from "../../../designsystem/layout/divided";
import { Inline } from "../../../designsystem/layout/inline";
import { Stack } from "../../../designsystem/layout/stack";
import { Heading, Kicker, Text } from "../../../designsystem/layout/typography";

import type { CardRoleEvaluation } from "../../decks/evaluations/contracts";
import type { ScryfallCard } from "../contracts";

function titleize(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function FactRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Inline gap={4} justify="between">
      <Text as="span" muted size="md">
        {label}
      </Text>
      <Text as="span" size="md">
        {value}
      </Text>
    </Inline>
  );
}

function priceRows(
  prices: NonNullable<ScryfallCard["prices"]>,
): [string, string][] {
  const entries: [string, string | null | undefined][] = [
    ["TCGplayer", prices.usd],
    ["TCGplayer foil", prices.usd_foil],
    ["TCGplayer etched", prices.usd_etched],
    ["Cardmarket", prices.eur],
    ["Cardmarket foil", prices.eur_foil],
    ["Cardhoarder", prices.tix],
  ];
  return entries.filter(
    (entry): entry is [string, string] =>
      entry[1] !== null && entry[1] !== undefined,
  );
}

export function CardInfoPanel({
  card,
  finish,
}: {
  card: ScryfallCard;
  finish: string | null;
}) {
  const prices = card.prices;
  return (
    <Stack gap={4}>
      {card.mana_cost !== null && (
        <Inline gap={4} justify="between">
          <Text as="span" size="md">
            <strong>Mana cost</strong>
          </Text>
          <ManaCost cost={card.mana_cost} />
        </Inline>
      )}
      <Card>
        <Text pre size="md">
          {card.oracle_text ?? "Oracle text unavailable."}
        </Text>
      </Card>
      <Divided>
        <FactRow
          label="Set"
          value={`${card.set_name} (${card.set.toUpperCase()})`}
        />
        <FactRow label="Rarity" value={card.rarity} />
        {finish !== null && <FactRow label="Finish" value={finish} />}
        {finish === null && card.finishes.length > 0 && (
          <FactRow label="Finishes" value={card.finishes.join(", ")} />
        )}
        {card.released_at !== undefined && card.released_at !== null && (
          <FactRow label="Released" value={card.released_at} />
        )}
      </Divided>
      {prices !== undefined && (
        <Stack as="section" gap={2} labelledBy="card-details-prices">
          <Heading id="card-details-prices" level={3} size="lg">
            Market prices
          </Heading>
          <Divided>
            {priceRows(prices).map(([label, value]) => (
              <FactRow key={label} label={label} value={value} />
            ))}
          </Divided>
        </Stack>
      )}
    </Stack>
  );
}

export function CardAnalysisPanel({
  error,
  evaluation,
  loading,
}: {
  error: string | null;
  evaluation: CardRoleEvaluation | null;
  loading: boolean;
}) {
  if (loading)
    return <Notice role="status">Loading deck-specific analysis…</Notice>;
  if (error !== null)
    return (
      <Notice role="alert" tone="error">
        {error}
      </Notice>
    );
  if (evaluation === null)
    return <Text muted>No deck-specific analysis is available.</Text>;
  return (
    <Stack gap={4}>
      <Inline align="end" gap={4} justify="between">
        <Stack gap={1}>
          <Kicker>Overall score</Kicker>
          <Heading level={3} size="3xl">
            {evaluation.overall_score}
          </Heading>
        </Stack>
        <Text as="span" muted size="sm">
          {evaluation.cached
            ? "Loaded from current deck cache"
            : "Generated for the current deck"}
        </Text>
      </Inline>
      <Card>
        <Text size="md">{evaluation.overall_comment}</Text>
      </Card>
      <Stack gap={3}>
        {evaluation.roles.map((role) => (
          <Card as="article" key={role.role}>
            <Stack gap={2}>
              <Inline gap={3} justify="between">
                <Tag tone="accent2">{titleize(role.role)}</Tag>
                <Text as="span" size="base">
                  <strong>{role.score}</strong>
                </Text>
              </Inline>
              <Text size="md">{role.description}</Text>
              <Divided>
                {Object.entries(role.answers).map(([criterion, rating]) => (
                  <Inline gap={3} justify="between" key={criterion}>
                    <Text as="span" size="sm">
                      {titleize(criterion)}
                    </Text>
                    <Text as="span" size="sm">
                      <strong>{titleize(rating)}</strong>
                    </Text>
                  </Inline>
                ))}
              </Divided>
            </Stack>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}
