import { ApiError, API, request } from "../../../core/http/client";

import type { AgentUiEvent, DeckConversation } from "../contracts";

function parseEvent(data: string): AgentUiEvent {
  return JSON.parse(data) as AgentUiEvent;
}

export function createConversation(deckId: string): Promise<DeckConversation> {
  return request<DeckConversation>(`/decks/${deckId}/conversations`, {
    method: "POST",
    body: "{}",
  });
}

export async function streamEvents(
  path: string,
  body: object,
  onEvent: (event: AgentUiEvent) => void,
): Promise<"completed" | "interrupted"> {
  const response = await fetch(`${API}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok || response.body === null) {
    const responseText = await response.text();
    throw new ApiError(responseText, response.status);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let reading = true;
  let runId = "unknown";
  let terminalType: "run_completed" | "run_failed" | null = null;
  try {
    while (reading) {
      const chunk = await reader.read();
      if (chunk.done) {
        reading = false;
        continue;
      }
      buffer += decoder.decode(chunk.value, { stream: true });
      const records = buffer.split("\n\n");
      buffer = records.pop() ?? "";
      for (const record of records) {
        const data = record
          .split("\n")
          .find((line) => line.startsWith("data: "));
        if (data === undefined) continue;
        const event = parseEvent(data.slice(6));
        runId = event.run_id;
        if (event.type === "run_completed" || event.type === "run_failed") {
          terminalType = event.type;
        }
        onEvent(event);
      }
    }
  } catch {
    onEvent({
      type: "stream_closed",
      run_id: runId,
      payload: {
        expected: false,
        message:
          "The connection was interrupted. Your partial response is still available.",
      },
    });
    return "interrupted";
  }
  onEvent({
    type: "stream_closed",
    run_id: runId,
    payload: {
      expected: terminalType !== null,
      message:
        terminalType === "run_completed"
          ? "Response complete"
          : terminalType === "run_failed"
            ? "Response ended with an error"
            : "The connection closed before the response finished. You can send another message to continue.",
    },
  });
  return terminalType === null ? "interrupted" : "completed";
}

export function sendAgentMessage(
  deckId: string,
  conversationId: string,
  message: string,
  onEvent: (event: AgentUiEvent) => void,
): Promise<"completed" | "interrupted"> {
  return streamEvents(
    `/decks/${deckId}/conversations/${conversationId}/messages`,
    { message },
    onEvent,
  );
}
