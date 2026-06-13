import { request } from "../../../../core/http/client";

import type { DeckGuidanceProposal } from "../contracts";

export function decideGuidanceProposal(
  deckId: string,
  proposalId: string,
  revision: number,
  decision: "approve" | "reject",
): Promise<DeckGuidanceProposal> {
  return request<DeckGuidanceProposal>(
    `/decks/${deckId}/guidance-proposals/${proposalId}/${decision}`,
    {
      method: "POST",
      body: JSON.stringify({ expected_revision: revision }),
    },
  );
}
