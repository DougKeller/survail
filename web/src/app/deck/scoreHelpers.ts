import type { CardSet, CardZone, Deck } from "../../modules/decks/contracts";
import type { CardRoleEvaluation } from "../../modules/decks/evaluations/contracts";
import { PREFERRED_CARD_ROLE_ORDER } from "./constants";

export type ScoreSortKey = string;
export type ScoreSortDirection = "asc" | "desc";
export interface ScoreRow {
  oracleId: string;
  name: string;
  card: CardSet | undefined;
  zones: CardZone[];
  evaluation: CardRoleEvaluation | null;
}

const SCORE_ROW_ZONE_PRIORITY: Record<CardSet["zone"], number> = {
  commander: 0,
  mainboard: 1,
  sideboard: 2,
  companion: 3,
  considering: 4,
};

function preferredScoreRowCard(
  current: CardSet | undefined,
  candidate: CardSet,
): CardSet {
  if (current === undefined) return candidate;
  if (current.core !== candidate.core)
    return candidate.core ? candidate : current;
  const zoneDelta =
    SCORE_ROW_ZONE_PRIORITY[current.zone] -
    SCORE_ROW_ZONE_PRIORITY[candidate.zone];
  if (zoneDelta !== 0) return zoneDelta <= 0 ? current : candidate;
  return current.card_name.localeCompare(candidate.card_name) <= 0
    ? current
    : candidate;
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
  const uniqueOracleIds = [
    ...new Set(deck.cardsets.map((card) => card.oracle_id)),
  ];
  const cardNames = new Map(
    deck.cardsets.map((card) => [card.oracle_id, card.card_name]),
  );
  const cardsByOracleId = new Map<string, CardSet>();
  const zonesByOracleId = new Map<string, Set<CardZone>>();
  for (const card of deck.cardsets) {
    cardsByOracleId.set(
      card.oracle_id,
      preferredScoreRowCard(cardsByOracleId.get(card.oracle_id), card),
    );
    zonesByOracleId.set(
      card.oracle_id,
      new Set([
        ...(zonesByOracleId.get(card.oracle_id) ?? new Set<CardZone>()),
        card.zone,
      ]),
    );
  }
  return {
    uniqueCards: uniqueOracleIds.length,
    cardNames,
    cardsByOracleId,
    rows: (scores: ReadonlyMap<string, CardRoleEvaluation>): ScoreRow[] =>
      uniqueOracleIds.map((oracleId) => ({
        oracleId,
        name: cardNames.get(oracleId) ?? oracleId,
        card: cardsByOracleId.get(oracleId),
        zones: [...(zonesByOracleId.get(oracleId) ?? new Set<CardZone>())].sort(
          (left, right) =>
            SCORE_ROW_ZONE_PRIORITY[left] - SCORE_ROW_ZONE_PRIORITY[right],
        ),
        evaluation: scores.get(oracleId) ?? null,
      })),
    roleScore: (evaluation: CardRoleEvaluation, role: string): number | null =>
      evaluation.roles.find((item) => item.role === role)?.score ?? null,
  };
}

export function displayedRoles(
  scores: ReadonlyMap<string, CardRoleEvaluation>,
): string[] {
  const seen = new Set<string>();
  for (const evaluation of scores.values()) {
    for (const role of evaluation.roles) {
      seen.add(role.role);
    }
  }
  const preferred = PREFERRED_CARD_ROLE_ORDER.filter((role) => seen.has(role));
  const extras = [...seen]
    .filter((role) => !PREFERRED_CARD_ROLE_ORDER.includes(role))
    .sort((left, right) => left.localeCompare(right));
  return [...preferred, ...extras];
}

export function scoreSortFromSearchParams(searchParams: URLSearchParams): {
  key: ScoreSortKey;
  direction: ScoreSortDirection;
} {
  const key = searchParams.get("scoreSort");
  const direction = searchParams.get("scoreDir");
  return {
    key: key !== null && key.trim() !== "" ? key : "overall",
    direction: direction === "asc" || direction === "desc" ? direction : "desc",
  };
}

export function nextScoreSort(
  current: { key: ScoreSortKey; direction: ScoreSortDirection },
  key: ScoreSortKey,
): { key: ScoreSortKey; direction: ScoreSortDirection } {
  return current.key === key
    ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
    : { key, direction: key === "card" ? "asc" : "desc" };
}

export function rankScores(
  rows: readonly ScoreRow[],
  sort: { key: ScoreSortKey; direction: ScoreSortDirection },
  roleScore: (evaluation: CardRoleEvaluation, role: string) => number | null,
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
    if (sort.key === "card") {
      return compareStrings(left.name, right.name);
    }
    if (sort.key === "starred") {
      return (
        compareOptionalNumbers(
          left.card?.core === true ? 1 : 0,
          right.card?.core === true ? 1 : 0,
        ) || left.name.localeCompare(right.name)
      );
    }
    if (left.evaluation === null && right.evaluation === null) {
      return left.name.localeCompare(right.name);
    }
    if (left.evaluation === null) return 1;
    if (right.evaluation === null) return -1;
    const primary =
      sort.key === "overall"
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
