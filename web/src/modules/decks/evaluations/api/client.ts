import { ApiError, API, request } from "../../../../core/http/client";

import type { CardEvaluationProgress, CardRoleEvaluation } from "../contracts";

type EvaluationStreamEvent =
  | { type: "progress"; payload: CardEvaluationProgress }
  | { type: "result"; payload: CardRoleEvaluation }
  | { type: "completed"; payload: { results: CardRoleEvaluation[] } }
  | { type: "failed"; payload: { message: string } };

function parseEvent(data: string): EvaluationStreamEvent {
  return JSON.parse(data) as EvaluationStreamEvent;
}

export function evaluateCurrentDeck(
  deckId: string,
): Promise<CardRoleEvaluation[]> {
  return request<CardRoleEvaluation[]>(
    `/decks/${deckId}/card-evaluations/current`,
    {
      method: "POST",
      body: "{}",
    },
  );
}

export async function streamCurrentDeckEvaluation(
  deckId: string,
  onProgress: (progress: CardEvaluationProgress) => void,
  onResult: (result: CardRoleEvaluation) => void,
): Promise<CardRoleEvaluation[]> {
  const response = await fetch(
    `${API}/decks/${deckId}/card-evaluations/current/stream`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    },
  );
  if (!response.ok || response.body === null) {
    throw new ApiError("Could not evaluate cards", response.status);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let reading = true;
  while (reading) {
    const chunk = await reader.read();
    if (chunk.done) {
      reading = false;
      continue;
    }
    buffer += decoder.decode(chunk.value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const data = frame.split("\n").find((line) => line.startsWith("data: "));
      if (data === undefined) continue;
      const event = parseEvent(data.slice(6));
      if (event.type === "progress") onProgress(event.payload);
      if (event.type === "result") onResult(event.payload);
      if (event.type === "completed") return event.payload.results;
      if (event.type === "failed") {
        throw new ApiError(event.payload.message, 502);
      }
    }
  }
  throw new ApiError("Card evaluation stream closed before completion", 502);
}

export function evaluateCards(
  deckId: string,
  oracleIds: string[],
): Promise<CardRoleEvaluation[]> {
  return request<CardRoleEvaluation[]>(
    `/decks/${deckId}/card-evaluations/evaluate`,
    {
      method: "POST",
      body: JSON.stringify({ oracle_ids: oracleIds }),
    },
  );
}

export function evaluateCard(
  deckId: string,
  oracleId: string,
): Promise<CardRoleEvaluation> {
  return request<CardRoleEvaluation>(
    `/decks/${deckId}/card-evaluations/oracle/${oracleId}`,
    {
      method: "POST",
      body: "{}",
    },
  );
}
