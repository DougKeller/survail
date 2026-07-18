import { Check, X } from "lucide-react";

import { InlineCardText } from "../../modules/cards/ui/cardPresentation";
import type { AgentUiEvent } from "../../modules/agent/contracts";
import { Button } from "../../designsystem/primitives/button";
import { Card, CardTitle } from "../../designsystem/primitives/card";
import { Notice } from "../../designsystem/primitives/notice";
import { ImageGrid } from "../../designsystem/layout/cardGallery";
import { Inline } from "../../designsystem/layout/inline";
import { Stack } from "../../designsystem/layout/stack";
import { Kicker, Text } from "../../designsystem/layout/typography";
import { zoneLabel } from "../deckPrimitives";

type ProposalDecision = (
  proposalId: string,
  expectedRevision: number,
  decision: "approve" | "reject",
) => Promise<void>;

function DecisionState({
  approved,
  children,
}: {
  approved: boolean;
  children: React.ReactNode;
}) {
  const Icon = approved ? Check : X;
  return (
    <Text muted size="sm">
      <Icon aria-hidden="true" size={14} strokeWidth={2.75} /> {children}
    </Text>
  );
}

function DecisionButtons({
  busy,
  confirmLabel,
  decide,
  event,
  rejectLabel,
}: {
  busy: boolean;
  confirmLabel: string;
  decide: ProposalDecision;
  event: Extract<
    AgentUiEvent,
    { type: "guidance_proposal" | "operation_proposal" }
  >;
  rejectLabel: string;
}) {
  return (
    <Inline gap={2}>
      <Button
        disabled={busy}
        onClick={() =>
          void decide(
            event.payload.proposal_id,
            event.payload.expected_revision,
            "approve",
          )
        }
      >
        {confirmLabel}
      </Button>
      <Button
        disabled={busy}
        onClick={() =>
          void decide(
            event.payload.proposal_id,
            event.payload.expected_revision,
            "reject",
          )
        }
        variant="secondary"
      >
        {rejectLabel}
      </Button>
    </Inline>
  );
}

export function GuidanceProposalCard({
  busy,
  decide,
  decision,
  event,
}: {
  busy: boolean;
  decide: ProposalDecision;
  decision: "approved" | "rejected" | undefined;
  event: Extract<AgentUiEvent, { type: "guidance_proposal" }>;
}) {
  return (
    <Card as="article" elevation="sm">
      <Stack gap={2}>
        <Kicker as="p" tone="accent">
          Your approval is required
        </Kicker>
        <CardTitle>Update deck guidance?</CardTitle>
        <Text>
          <InlineCardText text={event.payload.reason} />
        </Text>
        {event.payload.proposed_goal !== null && (
          <Notice>
            <InlineCardText text={event.payload.proposed_goal} />
          </Notice>
        )}
        {decision === undefined ? (
          <DecisionButtons
            busy={busy}
            confirmLabel="Approve"
            decide={decide}
            event={event}
            rejectLabel="Reject"
          />
        ) : (
          <DecisionState approved={decision === "approved"}>
            Proposal {decision}
          </DecisionState>
        )}
      </Stack>
    </Card>
  );
}

export function OperationProposalCard({
  busy,
  decide,
  decision,
  event,
}: {
  busy: boolean;
  decide: ProposalDecision;
  decision: "approved" | "rejected" | undefined;
  event: Extract<AgentUiEvent, { type: "operation_proposal" }>;
}) {
  return (
    <Card as="article" elevation="sm">
      <Stack gap={2}>
        <Kicker as="p" tone="accent">
          Your approval is required
        </Kicker>
        <CardTitle>Apply proposed deck changes?</CardTitle>
        <Text>
          <InlineCardText text={event.payload.reason} />
        </Text>
        <ImageGrid min="sm">
          {event.payload.changes.map((change, changeIndex) => (
            <Stack
              gap={1}
              key={`${event.payload.proposal_id}-${change.printing_id}-${String(changeIndex)}`}
            >
              {change.card.image_uri !== null && (
                <img alt="" aria-hidden="true" src={change.card.image_uri} />
              )}
              <Text as="span" size="xs">
                {change.quantity_delta > 0 ? "+" : ""}
                {change.quantity_delta}{" "}
                <InlineCardText text={`[[${change.card.name}]]`} />
                {" · "}
                {zoneLabel(change.zone)}
              </Text>
            </Stack>
          ))}
        </ImageGrid>
        {decision === undefined ? (
          <DecisionButtons
            busy={busy}
            confirmLabel="Apply"
            decide={decide}
            event={event}
            rejectLabel="Discard"
          />
        ) : (
          <DecisionState approved={decision === "approved"}>
            Proposal {decision === "approved" ? "applied" : "discarded"}
          </DecisionState>
        )}
      </Stack>
    </Card>
  );
}
