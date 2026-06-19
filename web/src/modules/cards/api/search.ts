import { request } from "../../../core/http/client";
import type { ScryfallCard } from "../contracts";

export function search(query: string): Promise<{ cards: ScryfallCard[] }> {
  return request<{ cards: ScryfallCard[] }>("/cards/search", {
    method: "POST",
    body: JSON.stringify({
      query,
    }),
  });
}

export function printings(oracleId: string): Promise<ScryfallCard[]> {
  return request<ScryfallCard[]>(
    `/cards/oracle/${encodeURIComponent(oracleId)}/printings`,
  );
}
