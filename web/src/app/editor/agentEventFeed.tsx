import { InlineCardText } from "../../modules/cards/ui/cardPresentation";
import type { AgentUiEvent } from "../../modules/agent/contracts";
import type { Deck } from "../../modules/decks/contracts";
import {
  isAgentActivityEvent,
  MaterialIcon,
  RichTextBlock,
  streamedAgentText,
  toolLabel,
  truncatedHint,
  visibleStreamingText,
} from "../deckPrimitives";

function ActivityMessage({
  agentBusy,
  event,
  events,
  index,
}: {
  agentBusy: boolean;
  event: Extract<
    AgentUiEvent,
    {
      type:
        | "run_started"
        | "status"
        | "model_started"
        | "heartbeat"
        | "tool_started"
        | "tool_completed";
    }
  >;
  events: AgentUiEvent[];
  index: number;
}) {
  const superseded = events
    .slice(index + 1)
    .some(
      (later) =>
        later.run_id === event.run_id &&
        (isAgentActivityEvent(later) ||
          later.type === "run_completed" ||
          later.type === "run_failed" ||
          later.type === "stream_closed"),
    );
  return superseded || !agentBusy ? null : (
    <p className="agent-status active" role="status">
      <span aria-hidden="true" />
      {event.payload.message}
    </p>
  );
}
function AgentStarters({
  agentBusy,
  submitAgentMessage,
}: {
  agentBusy: boolean;
  submitAgentMessage: (message: string) => Promise<void>;
}) {
  return (
    <div className="agent-starters">
      <p className="muted">
        Ask about strategy, weaknesses, card choices, or possible changes.
      </p>
      <div aria-label="Suggested questions" className="agent-starter-chips">
        {[
          "What does this deck do?",
          "What is this deck missing?",
          "Which cards should I add or remove?",
        ].map((prompt) => (
          <button
            disabled={agentBusy}
            key={prompt}
            onClick={() => void submitAgentMessage(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
export function AgentEventFeed({
  agentBusy,
  agentEvents,
  busy,
  deck,
  decideGuidanceProposal,
  guidanceDecisions,
  latestUserMessageId,
  latestUserMessageRef,
  submitAgentMessage,
}: {
  agentBusy: boolean;
  agentEvents: AgentUiEvent[];
  busy: boolean;
  deck: Deck;
  decideGuidanceProposal: (
    proposalId: string,
    expectedRevision: number,
    decision: "approve" | "reject",
  ) => Promise<void>;
  guidanceDecisions: Record<string, "approved" | "rejected">;
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
        <article
          className="agent-user-message"
          key={key}
          ref={
            event.run_id === latestUserMessageId
              ? latestUserMessageRef
              : undefined
          }
        >
          <small>You</small>
          <InlineCardText text={event.payload.message} />
        </article>
      );
    }
    if (event.type === "status") {
      const detail = event.payload.detail?.trim();
      return (
        <details className="agent-hint" key={key}>
          <summary>
            <span className="agent-hint-title">
              {event.payload.tool_name !== undefined
                ? toolLabel(event.payload.tool_name)
                : "Agent update"}
            </span>
            <span className="agent-hint-message">{event.payload.message}</span>
          </summary>
          {detail !== undefined && detail !== "" && (
            <div className="agent-hint-detail">
              <p>{truncatedHint(detail)}</p>
              {detail.length > 180 && (
                <details className="agent-hint-expand">
                  <summary>Show details</summary>
                  <pre>{detail}</pre>
                </details>
              )}
            </div>
          )}
        </details>
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
        <article className="agent-message streaming" key={key}>
          <RichTextBlock
            cards={deck.cardsets}
            text={visibleStreamingText(
              streamedAgentText(agentEvents, event.run_id),
            )}
          />
        </article>
      );
    }
    if (event.type === "assistant_completed")
      return (
        <article className="agent-message" key={key}>
          <RichTextBlock cards={deck.cardsets} text={event.payload.message} />
        </article>
      );
    if (event.type === "run_failed")
      return (
        <p className="notice error" key={key} role="alert">
          {event.payload.message}
        </p>
      );
    if (event.type === "card_results")
      return (
        <p className="agent-status" key={key}>
          {event.payload.cards.length} matching cards found.
        </p>
      );
    if (event.type === "guidance_proposal") {
      const decision = guidanceDecisions[event.payload.proposal_id];
      return (
        <article className="agent-guidance-proposal" key={key}>
          <span className="eyebrow">Your approval is required</span>
          <strong>Update deck guidance?</strong>
          <p>
            <InlineCardText text={event.payload.reason} />
          </p>
          {event.payload.proposed_goal !== null && (
            <blockquote>
              <InlineCardText text={event.payload.proposed_goal} />
            </blockquote>
          )}
          {decision === undefined ? (
            <div className="button-row">
              <button
                disabled={busy}
                onClick={() =>
                  void decideGuidanceProposal(
                    event.payload.proposal_id,
                    event.payload.expected_revision,
                    "approve",
                  )
                }
              >
                Approve
              </button>
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() =>
                  void decideGuidanceProposal(
                    event.payload.proposal_id,
                    event.payload.expected_revision,
                    "reject",
                  )
                }
              >
                Reject
              </button>
            </div>
          ) : (
            <p className="agent-stream-state complete">
              <MaterialIcon
                name={decision === "approved" ? "check" : "close"}
              />{" "}
              Proposal {decision}
            </p>
          )}
        </article>
      );
    }
    if (event.type === "operation_applied") {
      return (
        <p
          className={`notice ${event.payload.validation.valid ? "success" : "error"}`}
          key={key}
        >
          Deck change applied
          {event.payload.validation.errors.length > 0
            ? ` with ${String(event.payload.validation.errors.length)} validation issues`
            : ""}
          .
        </p>
      );
    }
    if (event.type !== "stream_closed") return null;
    const superseded = agentEvents
      .slice(index + 1)
      .some((candidate) => candidate.run_id === event.run_id);
    if (event.payload.expected && superseded) return null;
    return event.payload.expected ? (
      <p className="agent-stream-state complete" key={key}>
        <MaterialIcon name="check" />
        {event.payload.message}
      </p>
    ) : (
      <p className="agent-stream-state interrupted" key={key} role="status">
        <MaterialIcon name="wifi_off" />
        {event.payload.message}
      </p>
    );
  });
}
