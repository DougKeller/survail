import type { CardSet, DeckTag } from "../../modules/decks/contracts";

export const TAG_WEIGHT_OPTIONS = [0.25, 0.5, 0.75, 1] as const;

export function cardTagWeight(card: CardSet, tagId: string): number {
  return card.tag_weights?.[tagId] ?? 1;
}

export function tagTargetProgress(
  cards: readonly CardSet[],
  tag: DeckTag,
): number {
  return cards.reduce(
    (total, card) =>
      card.tag_ids?.includes(tag.id) === true
        ? total + card.quantity * cardTagWeight(card, tag.id)
        : total,
    0,
  );
}

export function formattedTagWeight(weight: number): string {
  if (weight === 0.25) return "¼";
  if (weight === 0.5) return "½";
  if (weight === 0.75) return "¾";
  return "1";
}

export function formattedTagProgress(value: number): string {
  return String(Math.round(value * 100) / 100);
}

export function nonDefaultTagWeights(
  card: CardSet,
  tags: readonly DeckTag[],
): { name: string; weight: number }[] {
  return (card.tag_ids ?? []).flatMap((tagId) => {
    const weight = cardTagWeight(card, tagId);
    return weight === 1
      ? []
      : [
          {
            name: tags.find((tag) => tag.id === tagId)?.name ?? "Tag",
            weight,
          },
        ];
  });
}
