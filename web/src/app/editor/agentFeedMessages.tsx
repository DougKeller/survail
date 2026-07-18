import type { AgentUiEvent } from "../../modules/agent/contracts";
import { Button } from "../../designsystem/primitives/button";
import { Notice } from "../../designsystem/primitives/notice";
import { StatusDot } from "../../designsystem/primitives/statusDot";
import { Inline } from "../../designsystem/layout/inline";
import { Stack } from "../../designsystem/layout/stack";
import { Text } from "../../designsystem/layout/typography";
import { isAgentActivityEvent } from "../deckPrimitives";

export function ActivityMessage({
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
    <Notice role="status">
      <Inline gap={2}>
        <StatusDot tone="accent" />
        <Text as="span" muted size="sm">
          {event.payload.message}
        </Text>
      </Inline>
    </Notice>
  );
}

export function AgentStarters({
  agentBusy,
  submitAgentMessage,
}: {
  agentBusy: boolean;
  submitAgentMessage: (message: string) => Promise<void>;
}) {
  return (
    <Stack gap={3}>
      <Text muted>
        Ask about strategy, weaknesses, card choices, or possible changes.
      </Text>
      <Inline aria-label="Suggested questions" gap={2} wrap>
        {[
          "What does this deck do?",
          "What is this deck missing?",
          "Which cards should I add or remove?",
        ].map((prompt) => (
          <Button
            disabled={agentBusy}
            key={prompt}
            onClick={() => void submitAgentMessage(prompt)}
            variant="secondary"
          >
            {prompt}
          </Button>
        ))}
      </Inline>
    </Stack>
  );
}
