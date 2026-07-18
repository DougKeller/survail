import { useId, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";

import { Button, IconButton } from "../../../designsystem/primitives/button";
import { Field, Input } from "../../../designsystem/primitives/input";
import { Notice } from "../../../designsystem/primitives/notice";
import {
  ToggleChip,
  type ToggleChipTone,
} from "../../../designsystem/primitives/toggleChip";
import { Inline } from "../../../designsystem/layout/inline";
import { Stack } from "../../../designsystem/layout/stack";
import { Text } from "../../../designsystem/layout/typography";

import type {
  CardRoleEvaluation,
  EvaluationFeedbackRequest,
} from "../../decks/evaluations/contracts";
import {
  actualRoles,
  buildFeedbackRequest,
  feedbackTitle,
  OVERALL_SCOPE,
  selectableRoles,
  type FeedbackFormState,
  type FeedbackRating,
  type FeedbackVerdict,
} from "./evaluationFeedbackDiff";

export interface EvaluationFeedbackController {
  evaluation: CardRoleEvaluation;
  form: FeedbackFormState | null;
  submitting: boolean;
  error: string | null;
  confirmed: ReadonlySet<string>;
  toggleForm: (scope: string, verdict: FeedbackVerdict) => void;
  close: () => void;
  setReason: (reason: string) => void;
  toggleRole: (role: string) => void;
  setCriterion: (criterion: string, rating: FeedbackRating) => void;
  submit: () => void;
}

/** State for one evaluation display: at most one feedback form is open at a
    time, keyed by scope ("overall" or a role id) plus a thumb verdict. */
export function useEvaluationFeedback({
  evaluation,
  onSubmit,
}: {
  evaluation: CardRoleEvaluation;
  onSubmit: (request: EvaluationFeedbackRequest) => Promise<void>;
}): EvaluationFeedbackController {
  const [form, setForm] = useState<FeedbackFormState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<ReadonlySet<string>>(new Set());

  function toggleForm(scope: string, verdict: FeedbackVerdict): void {
    setError(null);
    setConfirmed((current) => {
      if (!current.has(scope)) return current;
      const next = new Set(current);
      next.delete(scope);
      return next;
    });
    setForm((current) => {
      if (
        current !== null &&
        current.scope === scope &&
        current.verdict === verdict
      ) {
        return null;
      }
      const role = evaluation.roles.find((entry) => entry.role === scope);
      return {
        scope,
        verdict,
        reason: "",
        selectedRoles: actualRoles(evaluation),
        criteria: { ...role?.answers },
      };
    });
  }

  function submit(): void {
    if (form === null || submitting) return;
    const request = buildFeedbackRequest(evaluation, form);
    setSubmitting(true);
    setError(null);
    void (async () => {
      try {
        await onSubmit(request);
        setConfirmed((current) => new Set(current).add(form.scope));
        setForm(null);
      } catch (submitError: unknown) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Could not submit feedback",
        );
      } finally {
        setSubmitting(false);
      }
    })();
  }

  return {
    evaluation,
    form,
    submitting,
    error,
    confirmed,
    toggleForm,
    close: () => {
      setForm(null);
      setError(null);
    },
    setReason: (reason) => {
      setForm((current) => (current === null ? null : { ...current, reason }));
    },
    toggleRole: (role) => {
      setForm((current) => {
        if (current === null) return null;
        const selectedRoles = current.selectedRoles.includes(role)
          ? current.selectedRoles.filter((entry) => entry !== role)
          : [...current.selectedRoles, role];
        return { ...current, selectedRoles };
      });
    },
    setCriterion: (criterion, rating) => {
      setForm((current) =>
        current === null
          ? null
          : {
              ...current,
              criteria: { ...current.criteria, [criterion]: rating },
            },
      );
    },
    submit,
  };
}

/** Thumbs-up/down pair for one scope of an evaluation display. */
export function FeedbackThumbs({
  controller,
  scope,
  subject,
}: {
  controller: EvaluationFeedbackController;
  scope: string;
  /** Human-friendly target, e.g. "overall score" or "Card Selection score". */
  subject: string;
}) {
  function isOpen(verdict: FeedbackVerdict): boolean {
    return (
      controller.form !== null &&
      controller.form.scope === scope &&
      controller.form.verdict === verdict
    );
  }
  return (
    <Inline gap={1}>
      <IconButton
        aria-pressed={isOpen("up")}
        label={`Rate the ${subject} up`}
        onClick={() => {
          controller.toggleForm(scope, "up");
        }}
        size="sm"
        variant="ghost"
      >
        <ThumbsUp size={14} strokeWidth={2.75} />
      </IconButton>
      <IconButton
        aria-pressed={isOpen("down")}
        label={`Rate the ${subject} down`}
        onClick={() => {
          controller.toggleForm(scope, "down");
        }}
        size="sm"
        variant="ghost"
      >
        <ThumbsDown size={14} strokeWidth={2.75} />
      </IconButton>
    </Inline>
  );
}

function roleChipTone(isActual: boolean, selected: boolean): ToggleChipTone {
  if (isActual && !selected) return "negative";
  if (!isActual && selected) return "positive";
  return "neutral";
}

function RolePicker({
  controller,
  roleOrder,
}: {
  controller: EvaluationFeedbackController;
  roleOrder: readonly string[];
}) {
  const form = controller.form;
  if (form === null) return null;
  const actual = actualRoles(controller.evaluation);
  return (
    <Stack gap={2}>
      <Text muted size="sm">
        Toggle the roles this card should have: struck roles are removed from
        the judged result, sage roles are added to it.
      </Text>
      <Inline gap={2} wrap>
        {selectableRoles(roleOrder, controller.evaluation).map((role) => {
          const selected = form.selectedRoles.includes(role);
          return (
            <ToggleChip
              key={role}
              onClick={() => {
                controller.toggleRole(role);
              }}
              pressed={selected}
              tone={roleChipTone(actual.includes(role), selected)}
            >
              {feedbackTitle(role)}
            </ToggleChip>
          );
        })}
      </Inline>
    </Stack>
  );
}

/** The inline feedback form (or post-submit confirmation) for one scope.
    Renders nothing while that scope's form is closed. */
export function FeedbackForm({
  controller,
  roleOrder,
  scope,
}: {
  controller: EvaluationFeedbackController;
  roleOrder: readonly string[];
  scope: string;
}) {
  const reasonId = useId();
  const { form } = controller;
  if (controller.confirmed.has(scope)) {
    return (
      <Notice role="status" tone="success">
        Thanks — feedback recorded.
      </Notice>
    );
  }
  if (form?.scope !== scope) return null;
  return (
    <Stack gap={3}>
      {scope === OVERALL_SCOPE && form.verdict === "down" && (
        <RolePicker controller={controller} roleOrder={roleOrder} />
      )}
      <Field
        htmlFor={reasonId}
        label={
          form.verdict === "down"
            ? "What did the judge miss? (optional)"
            : "Anything to add? (optional)"
        }
      >
        <Input
          id={reasonId}
          onChange={(event) => {
            controller.setReason(event.target.value);
          }}
          placeholder="Add a short reason"
          type="text"
          value={form.reason}
        />
      </Field>
      {controller.error !== null && (
        <Notice role="alert" tone="error">
          {controller.error}
        </Notice>
      )}
      <Inline gap={2}>
        <Button disabled={controller.submitting} onClick={controller.submit}>
          {controller.submitting ? "Submitting…" : "Submit feedback"}
        </Button>
        <Button onClick={controller.close} variant="ghost">
          Cancel
        </Button>
      </Inline>
    </Stack>
  );
}
