import type React from "react";

import { MaterialIcon } from "../deckPrimitives";

import type { Deck } from "../../modules/decks/contracts";
import type { AgentUiEvent } from "../../modules/agent/contracts";
import { AgentEventFeed } from "./agentEventFeed";

export function AgentDrawer({
  agentBusy,
  agentEvents,
  agentEventsRef,
  agentMessage,
  busy,
  close,
  deck,
  decideGuidanceProposal,
  guidanceDecisions,
  handleAgentComposerKeyDown,
  latestUserMessageId,
  latestUserMessageRef,
  sendAgentMessage,
  setAgentMessage,
  submitAgentMessage,
}: {
  agentBusy: boolean;
  agentEvents: AgentUiEvent[];
  agentEventsRef: React.RefObject<HTMLDivElement | null>;
  agentMessage: string;
  busy: boolean;
  close: () => void;
  deck: Deck;
  decideGuidanceProposal: (
    proposalId: string,
    expectedRevision: number,
    decision: "approve" | "reject",
  ) => Promise<void>;
  guidanceDecisions: Record<string, "approved" | "rejected">;
  handleAgentComposerKeyDown: (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => void;
  latestUserMessageId: string | null;
  latestUserMessageRef: React.RefObject<HTMLElement | null>;
  sendAgentMessage: (event: React.SyntheticEvent<HTMLFormElement>) => void;
  setAgentMessage: (value: string) => void;
  submitAgentMessage: (message: string) => Promise<void>;
}) {
  return (
    <aside aria-labelledby="agent-title" className="agent-drawer">
      <div className="page-heading">
        <div>
          <h2 id="agent-title">Deck advisor</h2>
          <p>Ask questions or review proposed changes.</p>
        </div>
        <button
          aria-label="Close deck advisor"
          className="icon-action"
          onClick={close}
        >
          <MaterialIcon name="close" />
        </button>
      </div>
      <div aria-live="polite" className="agent-events" ref={agentEventsRef}>
        <AgentEventFeed
          agentBusy={agentBusy}
          agentEvents={agentEvents}
          busy={busy}
          deck={deck}
          decideGuidanceProposal={decideGuidanceProposal}
          guidanceDecisions={guidanceDecisions}
          latestUserMessageId={latestUserMessageId}
          latestUserMessageRef={latestUserMessageRef}
          submitAgentMessage={submitAgentMessage}
        />
      </div>
      <form className="agent-composer" onSubmit={sendAgentMessage}>
        <label className="sr-only" htmlFor="agent-message">
          Message deck advisor
        </label>
        <textarea
          id="agent-message"
          onChange={(event) => {
            setAgentMessage(event.target.value);
          }}
          onKeyDown={handleAgentComposerKeyDown}
          placeholder="Ask about this deck…"
          rows={2}
          value={agentMessage}
        />
        <button
          aria-label="Send message"
          className="icon-action"
          disabled={agentBusy || agentMessage.trim() === ""}
        >
          <MaterialIcon name="send" />
        </button>
      </form>
    </aside>
  );
}
