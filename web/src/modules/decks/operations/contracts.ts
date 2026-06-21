import type { CardFinish, CardZone, DeckOperationResult } from "../contracts";

export interface DeckOperationProposalChange {
  printing_id: string;
  quantity_delta: number;
  zone: CardZone;
  finish: CardFinish;
  tags?: string[] | null;
}

export interface DeckOperationProposal {
  id: string;
  deck_id: string;
  expected_revision: number;
  reason: string;
  status: string;
  operation_id: string | null;
  changes: DeckOperationProposalChange[];
  created_at: string;
  updated_at: string;
}

export type DeckOperationProposalDecisionResult =
  | DeckOperationProposal
  | DeckOperationResult;
