import { Send, X } from "lucide-react";

import { IconButton } from "../../designsystem/primitives/button";
import { TextArea } from "../../designsystem/primitives/input";
import { FlexSpacer, Inline } from "../../designsystem/layout/inline";
import { Stack } from "../../designsystem/layout/stack";
import { Panel, PanelScroll } from "../../designsystem/layout/workspace";
import { Heading, Text } from "../../designsystem/layout/typography";
import {
  useDeckAdvisorContext,
  useDeckEditorContext,
} from "./deckEditorContext";
import { AgentEventFeed } from "./agentEventFeed";

export function AgentDrawer() {
  const {
    data: { busy },
    deck,
  } = useDeckEditorContext();
  const {
    agentBusy,
    agentEvents,
    agentEventsRef,
    agentMessage,
    decideGuidanceProposal,
    decideOperationProposal,
    guidanceDecisions,
    handleAgentComposerKeyDown,
    latestUserMessageId,
    latestUserMessageRef,
    operationProposalDecisions,
    sendAgentMessage,
    setAgentMessage,
    setShowAgent,
    submitAgentMessage,
  } = useDeckAdvisorContext();
  return (
    <Panel labelledBy="agent-title">
      <Inline align="start" gap={2}>
        <Stack gap={1}>
          <Heading id="agent-title" level={2} size="xl">
            Deck advisor
          </Heading>
          <Text muted size="sm">
            Ask questions or review proposed changes.
          </Text>
        </Stack>
        <FlexSpacer />
        <IconButton
          label="Close deck advisor"
          onClick={() => {
            setShowAgent(false);
          }}
        >
          <X size={16} strokeWidth={2.75} />
        </IconButton>
      </Inline>
      <PanelScroll live ref={agentEventsRef}>
        <AgentEventFeed
          agentBusy={agentBusy}
          agentEvents={agentEvents}
          busy={busy}
          decideOperationProposal={decideOperationProposal}
          deck={deck}
          decideGuidanceProposal={decideGuidanceProposal}
          guidanceDecisions={guidanceDecisions}
          operationProposalDecisions={operationProposalDecisions}
          latestUserMessageId={latestUserMessageId}
          latestUserMessageRef={latestUserMessageRef}
          submitAgentMessage={submitAgentMessage}
        />
      </PanelScroll>
      <Stack as="form" gap={2} onSubmit={sendAgentMessage}>
        <TextArea
          aria-label="Message deck advisor"
          onChange={(event) => {
            setAgentMessage(event.target.value);
          }}
          onKeyDown={handleAgentComposerKeyDown}
          placeholder="Ask about this deck…"
          rows={2}
          value={agentMessage}
        />
        <Inline justify="end">
          <IconButton
            disabled={agentBusy || agentMessage.trim() === ""}
            label="Send message"
            type="submit"
            variant="primary"
          >
            <Send size={16} strokeWidth={2.75} />
          </IconButton>
        </Inline>
      </Stack>
    </Panel>
  );
}
