import type { CardZoneMatrixRowZone } from "../deck/cardZoneMatrix";
import { CARD_ZONE_DROP_TAG_SELECTOR } from "./cardZoneDragTypes";

export function nextDropZone(
  zones: readonly CardZoneMatrixRowZone[],
  current: CardZoneMatrixRowZone | null,
  direction: -1 | 1,
): CardZoneMatrixRowZone | null {
  if (zones.length === 0) return null;
  if (current === null)
    return zones[direction === 1 ? 0 : zones.length - 1] ?? null;
  const currentIndex = zones.indexOf(current);
  const nextIndex = (currentIndex + direction + zones.length) % zones.length;
  return zones[nextIndex] ?? null;
}

export function zoneAtPoint(
  x: number,
  y: number,
): CardZoneMatrixRowZone | null {
  const target = document
    .elementFromPoint(x, y)
    ?.closest<HTMLElement>("[data-drop-zone]");
  const zone = target?.dataset["dropZone"];
  return zone === "mainboard" || zone === "sideboard" || zone === "considering"
    ? zone
    : null;
}

export function tagAtPoint(x: number, y: number): string | null {
  return (
    document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>(CARD_ZONE_DROP_TAG_SELECTOR)?.dataset[
      "dropTagId"
    ] ?? null
  );
}
