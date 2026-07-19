import type { CardZoneMatrixRowZone } from "./cardZoneMatrix";

type CollapsibleCardRowZone = Exclude<CardZoneMatrixRowZone, "mainboard">;

function storageKey(deckId: string, zone: CollapsibleCardRowZone): string {
  return `survail.card-row-collapsed:${encodeURIComponent(deckId)}:${zone}`;
}

export function storedCardRowCollapsed(
  deckId: string,
  zone: CollapsibleCardRowZone,
  defaultValue = false,
): boolean {
  const stored = localStorage.getItem(storageKey(deckId, zone));
  return stored === null ? defaultValue : stored === "true";
}

export function storeCardRowCollapsed(
  deckId: string,
  zone: CollapsibleCardRowZone,
  collapsed: boolean,
): void {
  localStorage.setItem(storageKey(deckId, zone), String(collapsed));
}
