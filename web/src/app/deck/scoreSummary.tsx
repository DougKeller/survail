import { Flag, Pencil } from "lucide-react";

import { Button } from "../../designsystem/primitives/button";
import {
  Card,
  CardKicker,
  CardTitle,
} from "../../designsystem/primitives/card";
import { Grid } from "../../designsystem/layout/grid";
import { Inline } from "../../designsystem/layout/inline";
import { Stack } from "../../designsystem/layout/stack";
import { Text } from "../../designsystem/layout/typography";

import type { Deck } from "../../modules/decks/contracts";
import type { CardEvaluationProgress } from "../../modules/decks/evaluations/contracts";
import { scoreContextDescription } from "./scoreHelpers";
import { formatDuration } from "./time";

export function GoalRequiredNotice({ editGoal }: { editGoal: () => void }) {
  return (
    <Card role="status">
      <Inline gap={4} justify="between" wrap>
        <Inline align="start" gap={3}>
          <Flag aria-hidden="true" size={18} strokeWidth={2.75} />
          <Stack gap={1}>
            <Text size="base">
              <strong>Add a Goal / North Star before evaluating cards</strong>
            </Text>
            <Text muted size="sm">
              Scores judge how well each card supports the deck&apos;s intended
              game plan.
            </Text>
          </Stack>
        </Inline>
        <Button
          icon={<Pencil size={15} strokeWidth={2.75} />}
          onClick={editGoal}
          variant="secondary"
        >
          Add goal
        </Button>
      </Inline>
    </Card>
  );
}

export function EvaluationSummary({
  completed,
  totalScore,
  uniqueCards,
}: {
  completed: number;
  totalScore: number;
  uniqueCards: number;
}) {
  return (
    <Grid columns={2} gap={3}>
      <Card>
        <CardKicker>Cards evaluated</CardKicker>
        <CardTitle>
          {completed}/{uniqueCards}
        </CardTitle>
      </Card>
      <Card>
        <CardKicker>Total score</CardKicker>
        <CardTitle>{totalScore}</CardTitle>
      </Card>
    </Grid>
  );
}

export function EvaluationStatus({
  deck,
  progress,
}: {
  deck: Deck;
  progress: CardEvaluationProgress | null;
}) {
  if (progress === null) {
    return (
      <Text muted size="md">
        Cards are tagged by role and judged against{" "}
        {scoreContextDescription(deck)} using role-specific qualitative rubrics.
      </Text>
    );
  }
  return (
    <Stack gap={0} role="status">
      <Text muted size="md">
        Evaluating cards at{" "}
        {progress.average_seconds_per_card === null
          ? "an estimated rate"
          : `${progress.average_seconds_per_card.toFixed(1)} seconds per card`}
        .{" "}
        {progress.eta_seconds === null
          ? "Estimating time remaining…"
          : `About ${formatDuration(progress.eta_seconds)} remaining.`}
      </Text>
    </Stack>
  );
}
