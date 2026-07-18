import { Card } from "../../designsystem/primitives/card";
import { Tag } from "../../designsystem/primitives/tag";
import { Grid } from "../../designsystem/layout/grid";
import { Inline } from "../../designsystem/layout/inline";
import { Stack } from "../../designsystem/layout/stack";
import { Text } from "../../designsystem/layout/typography";

import {
  ClickableCardImage,
  InlineCardText,
} from "../../modules/cards/ui/cardPresentation";
import {
  FeedbackForm,
  FeedbackThumbs,
  useEvaluationFeedback,
} from "../../modules/cards/ui/evaluationFeedback";
import { RoleCriteriaList } from "../../modules/cards/ui/evaluationFeedbackCriteria";
import { OVERALL_SCOPE } from "../../modules/cards/ui/evaluationFeedbackDiff";
import type {
  CardRoleEvaluation,
  EvaluationFeedbackRequest,
} from "../../modules/decks/evaluations/contracts";
import { PREFERRED_CARD_ROLE_ORDER } from "./constants";
import type { ScoreRow } from "./scoreHelpers";
import { titleize } from "./text";

export function ScoreRowDetails({
  row,
  evaluation,
  columnCount,
  submitFeedback,
}: {
  row: ScoreRow;
  evaluation: CardRoleEvaluation;
  columnCount: number;
  submitFeedback: (request: EvaluationFeedbackRequest) => Promise<void>;
}) {
  const feedback = useEvaluationFeedback({
    evaluation,
    onSubmit: submitFeedback,
  });
  return (
    <tr>
      <td colSpan={columnCount}>
        <Stack gap={4}>
          <Inline align="start" gap={4}>
            {row.card !== undefined && (
              <ClickableCardImage card={row.card} size="preview" />
            )}
            <Stack gap={1}>
              <Text size="base">
                <strong>{row.name}</strong>
              </Text>
              <Inline align="center" gap={2}>
                <Text as="span" muted size="sm">
                  Overall score {evaluation.overall_score}
                </Text>
                <FeedbackThumbs
                  controller={feedback}
                  scope={OVERALL_SCOPE}
                  subject="overall score"
                />
              </Inline>
              <Text size="md">
                <InlineCardText text={evaluation.overall_comment} />
              </Text>
              <FeedbackForm
                controller={feedback}
                roleOrder={PREFERRED_CARD_ROLE_ORDER}
                scope={OVERALL_SCOPE}
              />
            </Stack>
          </Inline>
          <Grid gap={3}>
            {evaluation.roles.map((role) => (
              <Card as="article" key={role.role}>
                <Inline gap={3} justify="between">
                  <Inline align="center" gap={2}>
                    <Tag tone="accent2">{titleize(role.role)}</Tag>
                    <FeedbackThumbs
                      controller={feedback}
                      scope={role.role}
                      subject={`${titleize(role.role)} score`}
                    />
                  </Inline>
                  <Text as="span" size="base">
                    <strong>{role.score}</strong>
                  </Text>
                </Inline>
                <Text size="md">
                  <InlineCardText text={role.description} />
                </Text>
                <RoleCriteriaList controller={feedback} role={role} />
                <FeedbackForm
                  controller={feedback}
                  roleOrder={PREFERRED_CARD_ROLE_ORDER}
                  scope={role.role}
                />
              </Card>
            ))}
          </Grid>
        </Stack>
      </td>
    </tr>
  );
}
