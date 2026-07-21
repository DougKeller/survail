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

export function dropTargetAtPoint(
  x: number,
  y: number,
): { tagId: string | null; zone: CardZoneMatrixRowZone | null } {
  const element = document.elementFromPoint(x, y);
  const zoneValue =
    element?.closest<HTMLElement>("[data-drop-zone]")?.dataset["dropZone"];
  const zone =
    zoneValue === "mainboard" ||
    zoneValue === "sideboard" ||
    zoneValue === "considering"
      ? zoneValue
      : null;
  const tagId =
    element?.closest<HTMLElement>(CARD_ZONE_DROP_TAG_SELECTOR)?.dataset[
      "dropTagId"
    ] ?? null;
  return { tagId, zone };
}
