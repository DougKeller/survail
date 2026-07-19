import type { ScryfallCard } from "../../modules/cards/contracts";
import type {
  CardFinish,
  CardSet,
  DeckTag,
  PriceProvider,
} from "../../modules/decks/contracts";
import type { CardRoleEvaluation } from "../../modules/decks/evaluations/contracts";

import type { GroupBy, SortBy } from "./constants";
import { isCardFinish } from "./transforms";
import { titleize } from "./text";

export interface CardGroup {
  label: string;
  cards: CardSet[];
  quantity: number;
  tagId?: string | null;
}

function compareCards(
  left: CardSet,
  right: CardSet,
  sortBy: SortBy,
  provider: PriceProvider,
  scores: ReadonlyMap<string, CardRoleEvaluation>,
): number {
  if (sortBy === "mana-value") {
    return (
      (left.scryfall.cmc ?? 0) - (right.scryfall.cmc ?? 0) ||
      left.card_name.localeCompare(right.card_name)
    );
  }
  if (sortBy === "price") {
    return (
      numericPrice(left.scryfall, left.finish, provider) -
        numericPrice(right.scryfall, right.finish, provider) ||
      left.card_name.localeCompare(right.card_name)
    );
  }
  if (sortBy === "score") {
    return (
      (scores.get(right.oracle_id)?.overall_score ?? -1) -
        (scores.get(left.oracle_id)?.overall_score ?? -1) ||
      left.card_name.localeCompare(right.card_name)
    );
  }
  return left.card_name.localeCompare(right.card_name);
}

function displayPrice(
  card: ScryfallCard,
  finish: CardFinish,
  provider: PriceProvider,
): string | null {
  const prices = card.prices;
  if (prices === undefined) return null;
  if (provider === "cardmarket") {
    const value = finish === "foil" ? prices.eur_foil : prices.eur;
    return value === null ? null : `€${value}`;
  }
  if (provider === "cardhoarder")
    return prices.tix === null ? null : `${prices.tix} TIX`;
  const value =
    finish === "foil"
      ? prices.usd_foil
      : finish === "etched"
        ? prices.usd_etched
        : prices.usd;
  return value === null ? null : `$${value}`;
}

function numericPrice(
  card: ScryfallCard,
  finish: CardFinish,
  provider: PriceProvider,
): number {
  const displayed = displayPrice(card, finish, provider);
  if (displayed === null) return Number.POSITIVE_INFINITY;
  const parsed = Number.parseFloat(displayed.replaceAll(/[^0-9.]/g, ""));
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function colorLabels(card: ScryfallCard): string[] {
  const colors = card.colors ?? card.color_identity ?? [];
  if (colors.length === 0) return ["Colorless"];
  const names: Record<string, string> = {
    W: "White",
    U: "Blue",
    B: "Black",
    R: "Red",
    G: "Green",
  };
  return colors.map((color) => names[color] ?? color);
}

function typeLabels(card: ScryfallCard): string[] {
  const types = [
    "Creature",
    "Land",
    "Instant",
    "Sorcery",
    "Artifact",
    "Enchantment",
    "Planeswalker",
    "Battle",
  ];
  const matches = types.filter((type) => card.type_line.includes(type));
  return matches.length === 0 ? ["Other"] : matches;
}

function roleLabels(
  card: CardSet,
  scores: ReadonlyMap<string, CardRoleEvaluation>,
): string[] {
  const evaluation = scores.get(card.oracle_id);
  if (evaluation === undefined || evaluation.roles.length === 0)
    return ["Unscored"];
  return evaluation.roles.map((role) => titleize(role.role));
}

function groupLabels(
  card: CardSet,
  groupBy: GroupBy,
  scores: ReadonlyMap<string, CardRoleEvaluation>,
): string[] {
  if (groupBy === "color") return colorLabels(card.scryfall);
  if (groupBy === "mana-value")
    return [`Mana Value ${String(card.scryfall.cmc ?? 0)}`];
  if (groupBy === "role") return roleLabels(card, scores);
  return typeLabels(card.scryfall);
}

function cardHasTag(card: CardSet, tag: DeckTag): boolean {
  return card.tag_ids === undefined
    ? card.tags.includes(tag.name)
    : card.tag_ids.includes(tag.id);
}

function cardHasNoTags(card: CardSet): boolean {
  return card.tag_ids === undefined
    ? card.tags.length === 0
    : card.tag_ids.length === 0;
}

export function groupedCards(
  cards: CardSet[],
  groupBy: GroupBy,
  sortBy: SortBy,
  provider: PriceProvider,
  scores: ReadonlyMap<string, CardRoleEvaluation>,
  deckTags: readonly DeckTag[] = [],
): CardGroup[] {
  if (groupBy === "tags") {
    const orderedTags = [...deckTags].sort(
      (left, right) =>
        left.position - right.position || left.name.localeCompare(right.name),
    );
    const taggedGroups = orderedTags.map((tag) => ({
      tag,
      cards: cards.filter((card) => cardHasTag(card, tag)),
    }));
    const untaggedCards = cards.filter(cardHasNoTags);
    return [
      ...(untaggedCards.length > 0
        ? [
            {
              label: "Untagged",
              cards: [...untaggedCards].sort((left, right) =>
                compareCards(left, right, sortBy, provider, scores),
              ),
              quantity: untaggedCards.reduce(
                (total, card) => total + card.quantity,
                0,
              ),
              tagId: null,
            },
          ]
        : []),
      ...taggedGroups.map(({ cards: tagCards, tag }) => ({
        label: tag.name,
        cards: [...tagCards].sort((left, right) =>
          compareCards(left, right, sortBy, provider, scores),
        ),
        quantity: tagCards.reduce((total, card) => total + card.quantity, 0),
        tagId: tag.id,
      })),
    ];
  }
  const groups = new Map<string, CardSet[]>();
  cards.forEach((card) => {
    groupLabels(card, groupBy, scores).forEach((label) => {
      const group = groups.get(label);
      if (group === undefined) groups.set(label, [card]);
      else group.push(card);
    });
  });
  return [...groups.entries()]
    .map(([label, groupCards]) => ({
      label,
      cards: [...groupCards].sort((left, right) =>
        compareCards(left, right, sortBy, provider, scores),
      ),
      quantity: groupCards.reduce((total, card) => total + card.quantity, 0),
    }))
    .sort((left, right) => {
      if (groupBy === "mana-value") {
        return (
          Number.parseFloat(left.label.replace("Mana Value ", "")) -
          Number.parseFloat(right.label.replace("Mana Value ", ""))
        );
      }
      return left.label.localeCompare(right.label);
    });
}

export function preferredFinish(
  card: ScryfallCard,
  current: CardFinish,
): CardFinish {
  if (card.finishes.some((finish) => finish === current)) return current;
  const available = card.finishes.find(isCardFinish);
  return available ?? "nonfoil";
}
