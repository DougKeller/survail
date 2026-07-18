import { useCallback, useEffect, useState } from "react";

import { Inline } from "../../designsystem/layout/inline";
import { Page, PageHeader } from "../../designsystem/layout/page";
import { Stack } from "../../designsystem/layout/stack";
import { Heading, Text } from "../../designsystem/layout/typography";
import { Notice } from "../../designsystem/primitives/notice";
import { StatusDot } from "../../designsystem/primitives/statusDot";
import { Tag } from "../../designsystem/primitives/tag";
import { api } from "../api";
import { messageFor } from "../deckPrimitives";
import { GoldenCardView } from "../judge/goldenCard";
import { percentText, sortFailuresFirst } from "../judge/judgeFormat";

import type { JudgeReference } from "../../modules/decks/evaluations/contracts";

export function JudgeGoldenScreen() {
  const [reference, setReference] = useState<JudgeReference | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      setReference(await api.judgeReference());
    } catch (reason) {
      setError(reason instanceof Error ? messageFor(reason) : "Request failed");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (reference === null) {
    return (
      <Page>
        <PageHeader>
          <Heading level={1} size="3xl">
            Judge reference
          </Heading>
        </PageHeader>
        {error === null ? (
          <Text muted>Loading the judge golden dataset…</Text>
        ) : (
          <Notice role="alert" tone="error">
            {error}
          </Notice>
        )}
      </Page>
    );
  }

  const healthy = reference.pass_rate >= reference.min_pass_rate;
  const healthTone = healthy ? "accent2" : "accent";
  return (
    <Page>
      <PageHeader>
        <Stack gap={2}>
          <Heading level={1} size="3xl">
            Judge reference
          </Heading>
          {reference.decks.map((deck) => (
            <Stack gap={1} key={deck.title}>
              <Heading level={2} size="lg">
                {deck.title}
              </Heading>
              <Text muted size="md">
                {deck.goal}
              </Text>
            </Stack>
          ))}
          <Inline gap={2} wrap>
            <StatusDot pulse={false} tone={healthTone} />
            <Text as="span" size="md">
              <strong>
                {reference.passed_cards} / {reference.total_cards} cards ·{" "}
                {percentText(reference.pass_rate)}
              </strong>{" "}
              — target {percentText(reference.min_pass_rate)}
            </Text>
            <Tag tone={healthTone}>{healthy ? "Passing" : "Below target"}</Tag>
          </Inline>
          <Inline gap={2} wrap>
            <Tag tone="neutral">Judge model · {reference.model}</Tag>
            <Tag tone="neutral">Evaluator · {reference.evaluator_version}</Tag>
          </Inline>
        </Stack>
      </PageHeader>
      <Stack gap={4}>
        {sortFailuresFirst(reference.cards).map((card) => (
          <GoldenCardView
            card={card}
            key={`${card.deck_title}: ${card.name}`}
          />
        ))}
      </Stack>
    </Page>
  );
}
