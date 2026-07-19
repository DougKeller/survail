import type { CardSet, DeckFormat } from "../../modules/decks/contracts";

export function canMoveToCommanderZone(
  card: CardSet["scryfall"],
  format: DeckFormat,
): boolean {
  if (format !== "commander" && format !== "brawl") return false;
  return (
    card.type_line.includes("Legendary") && card.type_line.includes("Creature")
  );
}
