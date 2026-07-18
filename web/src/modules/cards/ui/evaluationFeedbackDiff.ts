import type {
  CardRoleEvaluation,
  EvaluationFeedbackRequest,
} from "../../decks/evaluations/contracts";

export type FeedbackRating =
  EvaluationFeedbackRequest["expected_criteria"][string];

export type FeedbackVerdict = EvaluationFeedbackRequest["verdict"];

/** Scope submitted when the thumbs target the overall score. */
export const OVERALL_SCOPE = "overall";

export const RATING_OPTIONS: readonly {
  label: string;
  value: FeedbackRating;
}[] = [
  { label: "Very Low", value: "very_low" },
  { label: "Low", value: "low" },
  { label: "Neutral", value: "neutral" },
  { label: "High", value: "high" },
  { label: "Very High", value: "very_high" },
];

export function ratingLabel(rating: string): string {
  return (
    RATING_OPTIONS.find((option) => option.value === rating)?.label ??
    feedbackTitle(rating)
  );
}

/** Human-friendly name for a snake_case role or criterion id. */
export function feedbackTitle(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export interface FeedbackFormState {
  scope: string;
  verdict: FeedbackVerdict;
  reason: string;
  /** Overall scope only: every role the user expects the card to fill. */
  selectedRoles: readonly string[];
  /** Role scope only: the user's expected rating per criterion. */
  criteria: Readonly<Record<string, FeedbackRating>>;
}

export function actualRoles(evaluation: CardRoleEvaluation): string[] {
  return evaluation.roles.map((role) => role.role);
}

/** All roles offered by the overall-score picker: the preferred ordering
    plus any judged role the ordering does not know about. */
export function selectableRoles(
  roleOrder: readonly string[],
  evaluation: CardRoleEvaluation,
): string[] {
  const extras = actualRoles(evaluation).filter(
    (role) => !roleOrder.includes(role),
  );
  return [...roleOrder, ...extras];
}

/** Reduces the form state to the corrective diff against the actual
    evaluation. Unchanged values never appear in the payload, so a neutral
    non-opinion is never read as an endorsement. */
export function buildFeedbackRequest(
  evaluation: CardRoleEvaluation,
  form: FeedbackFormState,
): EvaluationFeedbackRequest {
  const request: EvaluationFeedbackRequest = {
    oracle_id: evaluation.oracle_id,
    scope: form.scope,
    verdict: form.verdict,
    reason: form.reason.trim(),
    expected_added_roles: [],
    expected_removed_roles: [],
    expected_criteria: {},
  };
  if (form.verdict === "up") return request;
  if (form.scope === OVERALL_SCOPE) {
    const actual = actualRoles(evaluation);
    return {
      ...request,
      expected_added_roles: form.selectedRoles.filter(
        (role) => !actual.includes(role),
      ),
      expected_removed_roles: actual.filter(
        (role) => !form.selectedRoles.includes(role),
      ),
    };
  }
  const answers =
    evaluation.roles.find((role) => role.role === form.scope)?.answers ?? {};
  return {
    ...request,
    expected_criteria: Object.fromEntries(
      Object.entries(form.criteria).filter(
        ([criterion, rating]) => answers[criterion] !== rating,
      ),
    ),
  };
}
