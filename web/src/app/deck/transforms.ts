import type { AgentUiEvent } from "../../modules/agent/contracts";
import type {
  CardFinish,
  CardZone,
  Deck,
  DeckFormat,
  DeckOperationChangeInput,
  Validation,
} from "../../modules/decks/contracts";
import type { MoxfieldImportPreview } from "../../modules/imports/contracts";

import { DECK_FORMATS } from "./constants";
import { zoneLabel } from "./text";

export function isDeckFormat(value: string): value is DeckFormat {
  return DECK_FORMATS.some((format) => format === value);
}

export function isCardFinish(value: string): value is CardFinish {
  return value === "nonfoil" || value === "foil" || value === "etched";
}

export function decklistText(deck: Deck): string {
  const zoneOrder: readonly CardZone[] = [
    "commander",
    "mainboard",
    "sideboard",
    "companion",
    "considering",
  ];
  return zoneOrder
    .map((zone) => {
      const cards = deck.cardsets
        .filter((card) => card.zone === zone)
        .sort((left, right) => left.card_name.localeCompare(right.card_name));
      if (cards.length === 0) return "";
      const lines = cards.map((card) => {
        const foil = card.finish === "foil" ? " *F*" : "";
        return `${String(card.quantity)} ${card.card_name} (${card.set_code.toUpperCase()}) ${card.collector_number}${foil}`;
      });
      return `${zoneLabel(zone)}\n${lines.join("\n")}`;
    })
    .filter((section) => section !== "")
    .join("\n\n");
}

export function bulkEditChanges(
  deck: Deck,
  preview: MoxfieldImportPreview,
): DeckOperationChangeInput[] {
  const identity = (
    printingId: string,
    finish: CardFinish,
    zone: CardZone,
  ): string => `${printingId}:${finish}:${zone}`;
  const existing = new Map(
    deck.cardsets.map((card) => [
      identity(card.printing_id, card.finish, card.zone),
      card,
    ]),
  );
  const desired = new Map(
    preview.cardsets.map((card) => [
      identity(card.printing_id, card.finish, card.zone),
      card,
    ]),
  );
  const changes: DeckOperationChangeInput[] = [];
  for (const [key, card] of existing) {
    const quantity = desired.get(key)?.quantity ?? 0;
    if (quantity !== card.quantity) {
      changes.push({
        printing_id: card.printing_id,
        quantity_delta: quantity - card.quantity,
        zone: card.zone,
        finish: card.finish,
      });
    }
  }
  for (const [key, card] of desired) {
    if (existing.has(key)) continue;
    changes.push({
      printing_id: card.printing_id,
      quantity_delta: card.quantity,
      zone: card.zone,
      finish: card.finish,
    });
  }
  return changes;
}

export function queryForDeckFormat(query: string, format: DeckFormat): string {
  const hasLegalityFilter = /(?:^|\s)-?(?:legal|format|f):/i.test(query);
  return hasLegalityFilter ? query : `${query.trim()} legal:${format}`;
}

export function groupedValidationErrors(
  validation: Validation | null,
): { errorId: string; errors: Validation["errors"] }[] {
  const groups = new Map<string, Validation["errors"]>();
  for (const error of validation?.errors ?? []) {
    groups.set(error.error_id, [...(groups.get(error.error_id) ?? []), error]);
  }
  return [...groups.entries()].map(([errorId, errors]) => ({
    errorId,
    errors,
  }));
}

export function visibleStreamingText(text: string): string {
  const open = text.lastIndexOf("[[");
  const close = text.lastIndexOf("]]");
  return open > close ? text.slice(0, open) : text;
}

export function streamedAgentText(
  events: AgentUiEvent[],
  runId: string,
): string {
  let text = "";
  for (const event of events) {
    if (event.run_id === runId && event.type === "assistant_text_delta") {
      text += event.payload.delta;
    }
  }
  return text;
}

export function isAgentActivityEvent(event: AgentUiEvent): event is Extract<
  AgentUiEvent,
  {
    type:
      | "run_started"
      | "status"
      | "model_started"
      | "heartbeat"
      | "tool_started"
      | "tool_completed";
  }
> {
  return (
    event.type === "run_started" ||
    event.type === "status" ||
    event.type === "model_started" ||
    event.type === "heartbeat" ||
    event.type === "tool_started" ||
    event.type === "tool_completed"
  );
}
