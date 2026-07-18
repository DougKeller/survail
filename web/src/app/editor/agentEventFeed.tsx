import { Check, WifiOff } from "lucide-react";

import { InlineCardText } from "../../modules/cards/ui/cardPresentation";
import type { AgentUiEvent } from "../../modules/agent/contracts";
import type { Deck } from "../../modules/decks/contracts";
import { Card, CardBody, CardKicker } from "../../designsystem/primitives/card";
import { Disclosure } from "../../designsystem/primitives/disclosure";
import { Notice } from "../../designsystem/primitives/notice";
import { Inline } from "../../designsystem/layout/inline";
import { Stack } from "../../designsystem/layout/stack";
import { CodeBlock, Text } from "../../designsystem/layout/typography";
import {
  isAgentActivityEvent,
  RichTextBlock,
  streamedAgentText,
  toolLabel,
  truncatedHint,
  visibleStreamingText,
} from "../deckPrimitives";
import { ActivityMessage, AgentStarters } from "./agentFeedMessages";
import {
  GuidanceProposalCard,
  OperationProposalCard,
} from "./agentProposalCards";

export function AgentEventFeed({
  agentBusy,
  agentEvents,
  busy,
  decideOperationProposal,
  deck,
  decideGuidanceProposal,
  guidanceDecisions,
  operationProposalDecisions,
  latestUserMessageId,
  latestUserMessageRef,
  submitAgentMessage,
}: {
  agentBusy: boolean;
  agentEvents: AgentUiEvent[];
  busy: boolean;
  decideOperationProposal: (
    proposalId: string,
    expectedRevision: number,
    decision: "approve" | "reject",
  ) => Promise<void>;
  deck: Deck;
  decideGuidanceProposal: (
    proposalId: string,
    expectedRevision: number,
    decision: "approve" | "reject",
  ) => Promise<void>;
  guidanceDecisions: Record<string, "approved" | "rejected">;
  operationProposalDecisions: Record<string, "approved" | "rejected">;
  latestUserMessageId: string | null;
  latestUserMessageRef: React.RefObject<HTMLElement | null>;
  submitAgentMessage: (message: string) => Promise<void>;
}) {
  if (agentEvents.length === 0)
    return (
      <AgentStarters
        agentBusy={agentBusy}
        submitAgentMessage={submitAgentMessage}
      />
    );
  return agentEvents.map((event, index) => {
    const key = `${event.run_id}-${String(index)}`;
    if (event.type === "user_message") {
      return (
        <Card
          as="article"
          elevation="sm"
          key={key}
          ref={
            event.run_id === latestUserMessageId
              ? latestUserMessageRef
              : undefined
          }
        >
          <CardKicker>You</CardKicker>
          <CardBody>
            <InlineCardText text={event.payload.message} />
          </CardBody>
        </Card>
      );
    }
    if (event.type === "status") {
      const detail = event.payload.detail?.trim();
      return (
        <Disclosure
          inline
          key={key}
          label={
            <>
              <Text as="span" size="sm">
                {event.payload.tool_name !== undefined
                  ? toolLabel(event.payload.tool_name)
                  : "Agent update"}
              </Text>{" "}
              <Text as="span" muted size="sm">
                {event.payload.message}
              </Text>
            </>
          }
        >
          {detail !== undefined && detail !== "" && (
            <Stack gap={2}>
              <Text muted pre size="sm">
                {truncatedHint(detail)}
              </Text>
              {detail.length > 180 && (
                <Disclosure inline label="Show details">
                  <CodeBlock>{detail}</CodeBlock>
                </Disclosure>
              )}
            </Stack>
          )}
        </Disclosure>
      );
    }
    if (isAgentActivityEvent(event)) {
      return (
        <ActivityMessage
          agentBusy={agentBusy}
          event={event}
          events={agentEvents}
          index={index}
          key={key}
        />
      );
    }
    if (event.type === "assistant_text_delta") {
      const alreadyShown = agentEvents
        .slice(0, index)
        .some(
          (prior) =>
            prior.run_id === event.run_id &&
            prior.type === "assistant_text_delta",
        );
      const completed = agentEvents
        .slice(index + 1)
        .some(
          (later) =>
            later.run_id === event.run_id &&
            later.type === "assistant_completed",
        );
      if (alreadyShown || completed) return null;
      return (
        <Card as="article" key={key}>
          <RichTextBlock
            cards={deck.cardsets}
            text={visibleStreamingText(
              streamedAgentText(agentEvents, event.run_id),
            )}
          />
        </Card>
      );
    }
    if (event.type === "assistant_completed")
      return (
        <Card as="article" key={key}>
          <RichTextBlock cards={deck.cardsets} text={event.payload.message} />
        </Card>
      );
    if (event.type === "run_failed")
      return (
        <Notice key={key} role="alert" tone="error">
          {event.payload.message}
        </Notice>
      );
    if (event.type === "card_results")
      return (
        <Text key={key} muted size="sm">
          {event.payload.cards.length} matching cards found.
        </Text>
      );
    if (event.type === "guidance_proposal") {
      return (
        <GuidanceProposalCard
          busy={busy}
          decide={decideGuidanceProposal}
          decision={guidanceDecisions[event.payload.proposal_id]}
          event={event}
          key={key}
        />
      );
    }
    if (event.type === "operation_proposal") {
      return (
        <OperationProposalCard
          busy={busy}
          decide={decideOperationProposal}
          decision={operationProposalDecisions[event.payload.proposal_id]}
          event={event}
          key={key}
        />
      );
    }
    if (event.type === "operation_applied") {
      return (
        <Notice
          key={key}
          tone={event.payload.validation.valid ? "info" : "error"}
        >
          Deck change applied
          {event.payload.validation.errors.length > 0
            ? ` with ${String(event.payload.validation.errors.length)} validation issues`
            : ""}
          .
        </Notice>
      );
    }
    if (event.type !== "stream_closed") return null;
    const superseded = agentEvents
      .slice(index + 1)
      .some((candidate) => candidate.run_id === event.run_id);
    if (event.payload.expected && superseded) return null;
    return event.payload.expected ? (
      <Text key={key} muted size="sm">
        <Check aria-hidden="true" size={14} strokeWidth={2.75} />{" "}
        {event.payload.message}
      </Text>
    ) : (
      <Notice key={key} role="status" tone="error">
        <Inline gap={2}>
          <WifiOff aria-hidden="true" size={14} strokeWidth={2.75} />
          <Text as="span" size="sm">
            {event.payload.message}
          </Text>
        </Inline>
      </Notice>
    );
  });
}
