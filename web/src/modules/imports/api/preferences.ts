import type { DeckFormat } from "../../decks/contracts";
import type { ImportPreferences } from "../contracts";

export function metadataFor(format: DeckFormat): object {
  return format === "commander"
    ? { kind: "commander", commander_oracle_ids: [] }
    : format === "brawl"
      ? { kind: "brawl", commander_oracle_id: "" }
      : { kind: "generic" };
}

export function printingPreferences(preferences: ImportPreferences): object[] {
  return preferences.rules.map((rule) => ({
    kind: rule.kind,
    ...(rule.kind === "cheapest" ? { buffer_percent: rule.bufferPercent } : {}),
    ...(rule.kind === "frame" ? { frame: rule.frame } : {}),
  }));
}
