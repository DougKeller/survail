import type { DeckFormat } from "../../decks/contracts";

export function metadataFor(format: DeckFormat): object {
  return format === "commander"
    ? { kind: "commander", commander_oracle_ids: [] }
    : format === "brawl"
      ? { kind: "brawl", commander_oracle_id: "" }
      : { kind: "generic" };
}
