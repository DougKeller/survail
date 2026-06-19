import type React from "react";

import type { CardSet, Deck } from "../../modules/decks/contracts";
import type {
  CardRole,
  CardRoleEvaluation,
} from "../../modules/decks/evaluations/contracts";

export type ScoreSortKey = "card" | "overall" | "starred" | CardRole;
export type ScoreSortDirection = "asc" | "desc";
export interface ScoreRow {
  oracleId: string;
  name: string;
  card: CardSet | undefined;
  evaluation: CardRoleEvaluation | null;
}

export function scoreContextDescription(deck: Deck): string {
  const coreCount = new Set(
    deck.cardsets
      .filter((card) => card.core && card.zone !== "commander")
      .map((card) => card.oracle_id),
  ).size;
  return [
    "the deck's Goal / North Star",
    deck.cardsets.some((card) => card.zone === "commander")
      ? "the commander"
      : null,
    coreCount > 0
      ? `${String(coreCount)} starred core card${coreCount === 1 ? "" : "s"}`
      : null,
  ]
    .filter((part): part is string => part !== null)
    .join(", ");
}

export function createDeckScoreContext(deck: Deck) {
  const uniqueOracleIds = [...new Set(deck.cardsets.map((card) => card.oracle_id))];
  const cardNames = new Map(
    deck.cardsets.map((card) => [card.oracle_id, card.card_name]),
  );
  const cardsByOracleId = new Map(
    deck.cardsets.map((card) => [card.oracle_id, card]),
  );
  return {
    uniqueCards: uniqueOracleIds.length,
    cardNames,
    cardsByOracleId,
    rows: (scores: ReadonlyMap<string, CardRoleEvaluation>): ScoreRow[] =>
      uniqueOracleIds.map((oracleId) => ({
        oracleId,
        name: cardNames.get(oracleId) ?? oracleId,
        card: cardsByOracleId.get(oracleId),
        evaluation: scores.get(oracleId) ?? null,
      })),
    roleScore: (
      evaluation: CardRoleEvaluation,
      role: CardRole,
    ): number | null =>
      evaluation.roles.find((item) => item.role === role)?.score ?? null,
  };
}

export function rankScores(
  rows: readonly ScoreRow[],
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

  return [...rows].sort((left, right) => {
    if (left.evaluation === null && right.evaluation === null) {
      return left.name.localeCompare(right.name);
    }
    if (left.evaluation === null) return 1;
    if (right.evaluation === null) return -1;
    const primary =
      sort.key === "card"
        ? compareStrings(left.name, right.name)
        : sort.key === "starred"
          ? compareOptionalNumbers(
              left.card?.core === true ? 1 : 0,
              right.card?.core === true ? 1 : 0,
            )
        : sort.key === "overall"
          ? compareOptionalNumbers(
              left.evaluation.overall_score,
              right.evaluation.overall_score,
            )
          : compareOptionalNumbers(
              roleScore(left.evaluation, sort.key),
              roleScore(right.evaluation, sort.key),
            );
    return primary || left.name.localeCompare(right.name);
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
