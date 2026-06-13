import { request } from "../../../core/http/client";

import type {
  DeckOperation,
  DeckOperationChangeInput,
  DeckOperationResult,
} from "../contracts";

export function applyOperation(
  deckId: string,
  revision: number,
  changes: DeckOperationChangeInput[],
  reason?: string,
): Promise<DeckOperationResult> {
  return request<DeckOperationResult>(`/decks/${deckId}/operations`, {
    method: "POST",
    body: JSON.stringify({
      client_operation_id: crypto.randomUUID(),
      expected_revision: revision,
      reason,
      changes,
    }),
  });
}

export function operations(
  deckId: string,
  limit = 50,
  offset = 0,
): Promise<DeckOperation[]> {
  return request<DeckOperation[]>(
    `/decks/${deckId}/operations?limit=${String(limit)}&offset=${String(offset)}`,
  );
}

export function revertOperation(
  deckId: string,
  operationId: string,
  revision: number,
): Promise<DeckOperationResult> {
  return request<DeckOperationResult>(
    `/decks/${deckId}/operations/${operationId}/revert`,
    {
      method: "POST",
      body: JSON.stringify({
        client_operation_id: crypto.randomUUID(),
        expected_revision: revision,
      }),
    },
  );
}
