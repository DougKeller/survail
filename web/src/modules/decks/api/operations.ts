import { request } from "../../../core/http/client";

import type {
  Deck,
  DeckOperation,
  DeckOperationChangeInput,
  DeckOperationResult,
} from "../contracts";
import type { DeckOperationProposalDecisionResult } from "../operations/contracts";

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

export function setCardCore(
  deckId: string,
  cardsetId: string,
  core: boolean,
): Promise<Deck> {
  return request<Deck>(`/decks/${deckId}/cardsets/${cardsetId}/core`, {
    method: "PATCH",
    body: JSON.stringify({ core }),
  });
}

export function setCardNote(
  deckId: string,
  cardsetId: string,
  note: string,
): Promise<Deck> {
  return request<Deck>(`/decks/${deckId}/cardsets/${cardsetId}/note`, {
    method: "PATCH",
    body: JSON.stringify({ note }),
  });
}

export function decideOperationProposal(
  deckId: string,
  proposalId: string,
  revision: number,
  decision: "approve" | "reject",
): Promise<DeckOperationProposalDecisionResult> {
  return request<DeckOperationProposalDecisionResult>(
    `/decks/${deckId}/operation-proposals/${proposalId}/${decision}`,
    {
      method: "POST",
      body: JSON.stringify({ expected_revision: revision }),
    },
  );
}
