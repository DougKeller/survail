import type React from "react";

import type { CardSet, Deck } from "../../modules/decks/contracts";
import type {
  CardRole,
  CardRoleEvaluation,
} from "../../modules/decks/evaluations/contracts";

export type ScoreSortKey = "card" | "overall" | CardRole;
export type ScoreSortDirection = "asc" | "desc";

export function createDeckScoreContext(deck: Deck) {
  return {
    uniqueCards: new Set(deck.cardsets.map((card) => card.oracle_id)).size,
    cardNames: new Map(
      deck.cardsets.map((card) => [card.oracle_id, card.card_name]),
    ),
    cardsByOracleId: new Map(
      deck.cardsets.map((card) => [card.oracle_id, card]),
    ),
    roleScore: (
      evaluation: CardRoleEvaluation,
      role: CardRole,
    ): number | null =>
      evaluation.roles.find((item) => item.role === role)?.score ?? null,
  };
}

export function rankScores(
  scores: ReadonlyMap<string, CardRoleEvaluation>,
  cardNames: ReadonlyMap<string, string>,
  sort: { key: ScoreSortKey; direction: ScoreSortDirection },
  roleScore: (evaluation: CardRoleEvaluation, role: CardRole) => number | null,
) {
  const compareOptionalNumbers = (
    left: number | null,
    right: number | null,
  ): number => {
    if (left === null && right === null) return 0;
    if (left === null) return sort.direction === "asc" ? -1 : 1;
    if (right === null) return sort.direction === "asc" ? 1 : -1;
    return sort.direction === "asc" ? left - right : right - left;
  };
  const compareStrings = (left: string, right: string): number =>
    sort.direction === "asc"
      ? left.localeCompare(right)
      : right.localeCompare(left);

  return [...scores.values()].sort((left, right) => {
    const leftName = cardNames.get(left.oracle_id) ?? left.oracle_id;
    const rightName = cardNames.get(right.oracle_id) ?? right.oracle_id;
    const primary =
      sort.key === "card"
        ? compareStrings(leftName, rightName)
        : sort.key === "overall"
          ? compareOptionalNumbers(left.overall_score, right.overall_score)
          : compareOptionalNumbers(
              roleScore(left, sort.key),
              roleScore(right, sort.key),
            );
    return primary || leftName.localeCompare(rightName);
  });
}

export function updateHoverPreview(
  event: React.MouseEvent<HTMLTableRowElement>,
  score: CardRoleEvaluation,
  card: CardSet | undefined,
  name: string,
) {
  const width = Math.min(
    300 + score.roles.length * 280,
    window.innerWidth - 32,
  );
  const height = Math.min(620, window.innerHeight - 32);
  const margin = 20;
  const left = Math.min(event.clientX + 18, window.innerWidth - width - margin);
  const top = Math.min(
    event.clientY + 18,
    window.innerHeight - height - margin,
  );
  return {
    score,
    card,
    name,
    left: Math.max(margin, left),
    top: Math.max(margin, top),
    width,
  };
}
