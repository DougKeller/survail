import type { ReactNode } from "react";

import { Card } from "../../../designsystem/primitives/card";
import { Notice } from "../../../designsystem/primitives/notice";
import { ManaCost } from "../../../designsystem/primitives/pip";
import { Tag } from "../../../designsystem/primitives/tag";
import { Divided } from "../../../designsystem/layout/divided";
import { Inline } from "../../../designsystem/layout/inline";
import { Stack } from "../../../designsystem/layout/stack";
import { Heading, Kicker, Text } from "../../../designsystem/layout/typography";

import type {
  CardRoleEvaluation,
  EvaluationFeedbackRequest,
} from "../../decks/evaluations/contracts";
import type { ScryfallCard } from "../contracts";
import {
  FeedbackForm,
  FeedbackThumbs,
  useEvaluationFeedback,
} from "./evaluationFeedback";
import { RoleCriteriaList } from "./evaluationFeedbackCriteria";
import { feedbackTitle, OVERALL_SCOPE } from "./evaluationFeedbackDiff";

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

export interface CardFeedbackConfig {
  onSubmit: (request: EvaluationFeedbackRequest) => Promise<void>;
  /** Preferred ordering of all possible roles for the role picker. */
  roleOrder: readonly string[];
}

function AnalysisContent({
  evaluation,
  feedback,
}: {
  evaluation: CardRoleEvaluation;
  feedback?: CardFeedbackConfig;
}) {
  const controller = useEvaluationFeedback({
    evaluation,
    onSubmit: feedback?.onSubmit ?? (() => Promise.resolve()),
  });
  const roleOrder = feedback?.roleOrder ?? [];
  return (
    <Stack gap={4}>
      <Inline align="end" gap={4} justify="between">
        <Stack gap={1}>
          <Kicker>Overall score</Kicker>
          <Inline align="center" gap={2}>
            <Heading level={3} size="3xl">
              {evaluation.overall_score}
            </Heading>
            {feedback !== undefined && (
              <FeedbackThumbs
                controller={controller}
                scope={OVERALL_SCOPE}
                subject="overall score"
              />
            )}
          </Inline>
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
      {feedback !== undefined && (
        <FeedbackForm
          controller={controller}
          roleOrder={roleOrder}
          scope={OVERALL_SCOPE}
        />
      )}
      <Stack gap={3}>
        {evaluation.roles.map((role) => (
          <Card as="article" key={role.role}>
            <Stack gap={2}>
              <Inline gap={3} justify="between">
                <Inline align="center" gap={2}>
                  <Tag tone="accent2">{feedbackTitle(role.role)}</Tag>
                  {feedback !== undefined && (
                    <FeedbackThumbs
                      controller={controller}
                      scope={role.role}
                      subject={`${feedbackTitle(role.role)} score`}
                    />
                  )}
                </Inline>
                <Text as="span" size="base">
                  <strong>{role.score}</strong>
                </Text>
              </Inline>
              <Text size="md">{role.description}</Text>
              <RoleCriteriaList
                controller={feedback === undefined ? null : controller}
                role={role}
              />
              {feedback !== undefined && (
                <FeedbackForm
                  controller={controller}
                  roleOrder={roleOrder}
                  scope={role.role}
                />
              )}
            </Stack>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}

export function CardAnalysisPanel({
  error,
  evaluation,
  feedback,
  loading,
}: {
  error: string | null;
  evaluation: CardRoleEvaluation | null;
  feedback?: CardFeedbackConfig;
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
    <AnalysisContent
      evaluation={evaluation}
      {...(feedback === undefined ? {} : { feedback })}
    />
  );
}
