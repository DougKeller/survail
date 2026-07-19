import type {
  CardSet,
  CardZone,
  DeckTag,
  DeckFormat,
  PriceProvider,
} from "../../modules/decks/contracts";
import type { CardRoleEvaluation } from "../../modules/decks/evaluations/contracts";

import type { GroupBy, SortBy } from "./constants";
import { PREFERRED_CARD_ROLE_ORDER } from "./constants";
import { groupedCards } from "./grouping";
import { titleize } from "./text";

export type CardZoneMatrixRowZone = Extract<
  CardZone,
  "mainboard" | "sideboard" | "considering"
>;

interface CardZoneMatrixColumn {
  label: string;
  cards: CardSet[];
  quantity: number;
  tagId?: string | null;
}

interface CardZoneMatrixRow {
  zone: CardZoneMatrixRowZone;
  cards: CardSet[];
  columns: CardZoneMatrixColumn[];
  totalQuantity: number;
  distinctCardCount: number;
}

interface CardZoneMatrix {
  columns: string[];
  rows: CardZoneMatrixRow[];
}

interface BuildCardZoneMatrixOptions {
  cards: CardSet[];
  format: DeckFormat;
  groupBy: GroupBy;
  sortBy: SortBy;
  provider: PriceProvider;
  scores: ReadonlyMap<string, CardRoleEvaluation>;
  deckTags?: readonly DeckTag[];
}

function cardMatrixRowZones(
  format: DeckFormat,
): readonly CardZoneMatrixRowZone[] {
  return format === "commander" || format === "brawl"
    ? ["mainboard", "considering"]
    : ["mainboard", "sideboard", "considering"];
}

export function buildCardZoneMatrix({
  cards,
  format,
  groupBy,
  sortBy,
  provider,
  scores,
  deckTags = [],
}: BuildCardZoneMatrixOptions): CardZoneMatrix {
  const zones = cardMatrixRowZones(format);
  const visibleZones = new Set<CardZone>(zones);
  const visibleCards = cards.filter((card) => visibleZones.has(card.zone));
  const populatedGroups = groupedCards(
    visibleCards,
    groupBy,
    sortBy,
    provider,
    scores,
    deckTags,
  );
  const columnDefinitions: Pick<CardZoneMatrixColumn, "label" | "tagId">[] =
    groupBy === "role"
      ? [
          ...PREFERRED_CARD_ROLE_ORDER.map((role) => ({
            label: titleize(role),
          })),
          ...(populatedGroups.some((group) => group.label === "Unscored")
            ? [{ label: "Unscored" }]
            : []),
        ]
      : populatedGroups.map((group) => ({
          label: group.label,
          ...(groupBy === "tags" ? { tagId: group.tagId ?? null } : {}),
        }));
  const columns = columnDefinitions.map((column) => column.label);
  const groupKey = (group: { label: string; tagId?: string | null }) =>
    groupBy === "tags" ? (group.tagId ?? "__untagged__") : group.label;
  const cardsByZone = new Map<CardZoneMatrixRowZone, CardSet[]>(
    zones.map((zone) => [zone, []]),
  );
  for (const card of visibleCards) {
    cardsByZone.get(card.zone as CardZoneMatrixRowZone)?.push(card);
  }

  // Group and sort once for the whole matrix, then partition each already
  // sorted group by zone. Besides preserving the same ordering, this avoids
  // rescanning every card for every tag once per row.
  const groupsByZone = new Map<
    string,
    Map<CardZoneMatrixRowZone, CardZoneMatrixColumn>
  >();
  for (const group of populatedGroups) {
    const byZone = new Map<CardZoneMatrixRowZone, CardZoneMatrixColumn>();
    for (const card of group.cards) {
      const zone = card.zone as CardZoneMatrixRowZone;
      let zoneGroup = byZone.get(zone);
      if (zoneGroup === undefined) {
        zoneGroup = {
          label: group.label,
          cards: [],
          quantity: 0,
          ...(groupBy === "tags" ? { tagId: group.tagId ?? null } : {}),
        };
        byZone.set(zone, zoneGroup);
      }
      zoneGroup.cards.push(card);
      zoneGroup.quantity += card.quantity;
    }
    groupsByZone.set(groupKey(group), byZone);
  }

  const rows = zones.map((zone): CardZoneMatrixRow => {
    const rowCards = cardsByZone.get(zone) ?? [];
    return {
      zone,
      cards: rowCards,
      columns: columnDefinitions.map((column) => {
        const group = groupsByZone.get(groupKey(column))?.get(zone);
        return {
          label: column.label,
          cards: group?.cards ?? [],
          quantity: group?.quantity ?? 0,
          ...(groupBy === "tags" ? { tagId: column.tagId ?? null } : {}),
        };
      }),
      totalQuantity: rowCards.reduce((total, card) => total + card.quantity, 0),
      distinctCardCount: new Set(rowCards.map((card) => card.oracle_id)).size,
    };
  });

  return { columns, rows };
}
