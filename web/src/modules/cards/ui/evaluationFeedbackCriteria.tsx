import { Select } from "../../../designsystem/primitives/select";
import { Tag } from "../../../designsystem/primitives/tag";
import { Divided } from "../../../designsystem/layout/divided";
import { Inline } from "../../../designsystem/layout/inline";
import { Text } from "../../../designsystem/layout/typography";

import type { CardRoleEvaluation } from "../../decks/evaluations/contracts";
import type { EvaluationFeedbackController } from "./evaluationFeedback";
import {
  feedbackTitle,
  RATING_OPTIONS,
  ratingLabel,
  type FeedbackRating,
} from "./evaluationFeedbackDiff";

type RoleResult = CardRoleEvaluation["roles"][number];

function CriterionEditor({
  actual,
  controller,
  criterion,
}: {
  actual: FeedbackRating;
  controller: EvaluationFeedbackController;
  criterion: string;
}) {
  const expected = controller.form?.criteria[criterion] ?? actual;
  const changed = expected !== actual;
  const title = feedbackTitle(criterion);
  return (
    <Inline align="center" gap={3} justify="between" wrap>
      <Text as="span" size="sm">
        {title}
      </Text>
      <Inline align="center" gap={2}>
        {changed && (
          <Text as="span" size="sm">
            <Tag tone="accent">{ratingLabel(actual)}</Tag> →{" "}
            <Tag tone="accent2">{ratingLabel(expected)}</Tag>
          </Text>
        )}
        <Select
          aria-label={`Expected ${title} rating`}
          onChange={(event) => {
            const next = RATING_OPTIONS.find(
              (option) => option.value === event.target.value,
            );
            if (next !== undefined) {
              controller.setCriterion(criterion, next.value);
            }
          }}
          options={[...RATING_OPTIONS]}
          value={expected}
        />
      </Inline>
    </Inline>
  );
}

/** A role's criterion → rating rows. While that role's thumbs-down form is
    open, each row becomes a rank editor pre-filled with the actual rating,
    contrasting actual → expected once a rating is changed. */
export function RoleCriteriaList({
  controller,
  role,
}: {
  controller: EvaluationFeedbackController | null;
  role: RoleResult;
}) {
  const form = controller?.form ?? null;
  const editing =
    form !== null && form.scope === role.role && form.verdict === "down";
  return (
    <Divided>
      {Object.entries(role.answers).map(([criterion, rating]) =>
        editing && controller !== null ? (
          <CriterionEditor
            actual={rating}
            controller={controller}
            criterion={criterion}
            key={criterion}
          />
        ) : (
          <Inline gap={3} justify="between" key={criterion}>
            <Text as="span" size="sm">
              {feedbackTitle(criterion)}
            </Text>
            <Text as="span" size="sm">
              <strong>{feedbackTitle(rating)}</strong>
            </Text>
          </Inline>
        ),
      )}
    </Divided>
  );
}
