import type { CardFinish, CardZone, Validation } from "../decks/contracts";

interface AgentCard {
  printing_id: string;
  oracle_id: string;
  name: string;
  mana_cost: string | null;
  type_line: string;
  image_uri: string | null;
  set: string;
  finishes: string[];
}

interface AgentProposedChange {
  printing_id: string;
  quantity_delta: number;
  zone: CardZone;
  finish: CardFinish;
  tags?: string[] | null;
  card: AgentCard;
}

export interface DeckConversation {
  id: string;
  deck_id: string;
  created_at: string;
  updated_at: string;
}

export type AgentUiEvent =
  | { type: "user_message"; run_id: string; payload: { message: string } }
  | {
      type: "run_started" | "status" | "model_started" | "heartbeat";
      run_id: string;
      payload: { message: string; tool_name?: string; detail?: string };
    }
  | {
      type: "tool_started" | "tool_completed";
      run_id: string;
      payload: { message: string; tool_name: string; detail?: string };
    }
  | { type: "assistant_text_delta"; run_id: string; payload: { delta: string } }
  | {
      type: "assistant_completed";
      run_id: string;
      payload: { message: string };
    }
  | {
      type: "card_results";
      run_id: string;
      payload: { query: string; cards: AgentCard[] };
    }
  | {
      type: "operation_proposal";
      run_id: string;
      payload: {
        proposal_id: string;
        expected_revision: number;
        reason: string;
        changes: AgentProposedChange[];
      };
    }
  | {
      type: "guidance_proposal";
      run_id: string;
      payload: {
        proposal_id: string;
        expected_revision: number;
        reason: string;
        proposed_goal: string | null;
      };
    }
  | {
      type: "operation_applied";
      run_id: string;
      payload: {
        proposal_id: string;
        operation_id: string;
        revision: number;
        validation: Validation;
      };
    }
  | {
      type: "validation_results" | "deck_summary" | "run_completed";
      run_id: string;
      payload: object;
    }
  | { type: "run_failed"; run_id: string; payload: { message: string } }
  | {
      type: "stream_closed";
      run_id: string;
      payload: { expected: boolean; message: string };
    };
