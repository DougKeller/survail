import type {
  CardSet,
  CardZone,
  DeckFormat,
} from "../../modules/decks/contracts";

import { zonesFor } from "./constants";

export function canMoveToCommanderZone(
  card: CardSet["scryfall"],
  format: DeckFormat,
): boolean {
  if (format !== "commander" && format !== "brawl") return false;
  return (
    card.type_line.includes("Legendary") && card.type_line.includes("Creature")
  );
}

export function moveZoneOptionsFor(
  card: CardSet,
  format: DeckFormat,
): CardZone[] {
  return zonesFor(format).filter((zone) => {
    if (zone === card.zone) return false;
    if (zone === "commander") {
      return canMoveToCommanderZone(card.scryfall, format);
    }
    return true;
  });
}
