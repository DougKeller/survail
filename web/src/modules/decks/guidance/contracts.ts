export interface DeckGuidanceProposal {
  id: string;
  deck_id: string;
  expected_revision: number;
  reason: string;
  proposed_goal: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}
