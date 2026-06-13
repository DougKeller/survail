import { request } from "../../../core/http/client";
import { printingPreferences } from "../../imports/api/preferences";

import type { ImportPreferences } from "../../imports/contracts";
import type { ScryfallCard } from "../contracts";

export function search(
  query: string,
  preferences: ImportPreferences,
): Promise<{ cards: ScryfallCard[] }> {
  return request<{ cards: ScryfallCard[] }>("/cards/search", {
    method: "POST",
    body: JSON.stringify({
      query,
      printing_preferences: printingPreferences(preferences),
    }),
  });
}

export function printings(oracleId: string): Promise<ScryfallCard[]> {
  return request<ScryfallCard[]>(
    `/cards/oracle/${encodeURIComponent(oracleId)}/printings`,
  );
}
