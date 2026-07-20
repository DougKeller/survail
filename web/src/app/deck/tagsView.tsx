import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { ClickableCardImage } from "../../modules/cards/ui/cardPresentation";
import type { CardSet, Deck, DeckTag } from "../../modules/decks/contracts";
import { Chip } from "../../designsystem/primitives/chip";
import { SortableHeader, Table, TableScroll } from "../../designsystem/primitives/table";
import { ToggleChip } from "../../designsystem/primitives/toggleChip";
import { Inline } from "../../designsystem/layout/inline";
import { PageHeader } from "../../designsystem/layout/page";
import { Stack } from "../../designsystem/layout/stack";
import { Heading, Kicker, Text } from "../../designsystem/layout/typography";
import { FilterMenu } from "./filterMenu";
import { tagSwatches } from "./groupColors";
import { zoneLabel } from "./text";

type TagSortDirection = "asc" | "desc";
type TagSortKey = "name" | "tags";

interface TagDeckRow {
  card: CardSet;
  tags: DeckTag[];
}

function toggled(current: readonly string[], item: string): string[] {
  return current.includes(item)
    ? current.filter((entry) => entry !== item)
    : [...current, item];
}

function assignedTags(card: CardSet, tags: readonly DeckTag[]): DeckTag[] {
  const assigned =
    card.tag_ids === undefined
      ? tags.filter((tag) => card.tags.includes(tag.name))
      : tags.filter((tag) => card.tag_ids?.includes(tag.id) === true);
  return assigned.sort((left, right) => left.name.localeCompare(right.name));
}

export function tagDeckRows(
  deck: Deck,
  shownTagIds: readonly string[],
  selectedTagIds: readonly string[],
  sort: { direction: TagSortDirection; key: TagSortKey },
): TagDeckRow[] {
  const shown = new Set(shownTagIds);
  const selected = new Set(selectedTagIds);
  const rows = deck.cardsets
    .filter((card) => card.quantity > 0)
    .map((card) => ({
      card,
      tags: assignedTags(card, deck.tags ?? []).filter((tag) => shown.has(tag.id)),
    }))
    .filter(
      (row) =>
        selected.size === 0 || row.tags.some((tag) => selected.has(tag.id)),
    );
  const direction = sort.direction === "asc" ? 1 : -1;
  return rows.sort((left, right) => {
    const primary =
      sort.key === "tags"
        ? left.tags.length - right.tags.length
        : left.card.card_name.localeCompare(right.card.card_name);
    return (
      primary * direction ||
      left.card.card_name.localeCompare(right.card.card_name) ||
      left.card.zone.localeCompare(right.card.zone)
    );
  });
}

function tagSortFromSearchParams(searchParams: URLSearchParams): {
  direction: TagSortDirection;
  key: TagSortKey;
} {
  const key = searchParams.get("tagSort") === "tags" ? "tags" : "name";
  const requestedDirection = searchParams.get("tagDir");
  return {
    direction:
      requestedDirection === "asc" || requestedDirection === "desc"
        ? requestedDirection
        : key === "tags"
          ? "desc"
          : "asc",
    key,
  };
}

export function DeckTagsView({ deck }: { deck: Deck }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [hiddenTagIds, setHiddenTagIds] = useState<string[]>([]);
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const tags = [...(deck.tags ?? [])].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const validIds = new Set(tags.map((tag) => tag.id));
  const activeHiddenIds = hiddenTagIds.filter((id) => validIds.has(id));
  const shownTags = tags.filter((tag) => !activeHiddenIds.includes(tag.id));
  const shownIds = shownTags.map((tag) => tag.id);
  const activeSelectedIds = selectedTagIds.filter((id) => shownIds.includes(id));
  const sort = tagSortFromSearchParams(searchParams);
  const rows = tagDeckRows(deck, shownIds, activeSelectedIds, sort);
  const colors = tagSwatches(tags.map((tag) => tag.id));

  function setSort(key: TagSortKey): void {
    const nextDirection =
      sort.key === key
        ? sort.direction === "asc"
          ? "desc"
          : "asc"
        : key === "tags"
          ? "desc"
          : "asc";
    const next = new URLSearchParams(window.location.search);
    next.set("tagSort", key);
    next.set("tagDir", nextDirection);
    setSearchParams(next, { replace: true });
  }

  return (
    <Stack as="section" gap={6} labelledBy="tags-title">
      <PageHeader>
        <Stack gap={1}>
          <Kicker>Deck organization</Kicker>
          <Heading id="tags-title" level={2} size="2xl">
            Tags and card assignments
          </Heading>
        </Stack>
      </PageHeader>
      <Stack gap={3}>
        <Inline align="end" gap={3} justify="between" wrap>
          <Inline align="end" gap={3} wrap>
            <Stack gap={1}>
              <Kicker as="span">Filter cards · match any</Kicker>
              <Inline gap={1} wrap>
                {shownTags.map((tag) => (
                  <ToggleChip
                    aria-label={`Filter cards by ${tag.name}`}
                    key={tag.id}
                    onClick={() => {
                      setSelectedTagIds((current) => toggled(current, tag.id));
                    }}
                    pressed={activeSelectedIds.includes(tag.id)}
                  >
                    {tag.name}
                  </ToggleChip>
                ))}
              </Inline>
            </Stack>
            <FilterMenu
              excluded={activeHiddenIds}
              label="Shown tags"
              onOpenChange={setVisibilityOpen}
              onSelectAll={() => {
                setHiddenTagIds([]);
              }}
              onSelectNone={() => {
                setHiddenTagIds(tags.map((tag) => tag.id));
                setSelectedTagIds([]);
              }}
              onToggle={(tagId) => {
                setHiddenTagIds((current) => toggled(current, tagId));
                setSelectedTagIds((current) =>
                  current.filter((selected) => selected !== tagId),
                );
              }}
              open={visibilityOpen}
              options={tags.map((tag) => ({ label: tag.name, value: tag.id }))}
            />
          </Inline>
          <Text muted size="md">
            Showing {rows.length} of {deck.cardsets.length} card entries
          </Text>
        </Inline>
        <TableScroll>
          <Table>
            <thead>
              <tr>
                <th>
                  <SortableHeader
                    active={sort.key === "name"}
                    direction={sort.direction}
                    onClick={() => {
                      setSort("name");
                    }}
                  >
                    Name
                  </SortableHeader>
                </th>
                <th>
                  <SortableHeader
                    active={sort.key === "tags"}
                    direction={sort.direction}
                    onClick={() => {
                      setSort("tags");
                    }}
                  >
                    Tags
                  </SortableHeader>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.card.id}>
                  <th scope="row">
                    <Inline align="center" gap={2}>
                      <ClickableCardImage card={row.card} size="thumb" />
                      <Stack gap={1}>
                        <Text as="span">{row.card.card_name}</Text>
                        <Text as="span" muted size="sm">
                          ×{row.card.quantity} · {zoneLabel(row.card.zone)}
                        </Text>
                      </Stack>
                    </Inline>
                  </th>
                  <td>
                    {row.tags.length === 0 ? (
                      <Text as="span" muted>
                        —
                      </Text>
                    ) : (
                      <Inline gap={1} wrap>
                        {row.tags.map((tag) => (
                          <Chip
                            accent={colors.get(tag.id) ?? "#8f95b2"}
                            key={tag.id}
                          >
                            {tag.name}
                          </Chip>
                        ))}
                      </Inline>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableScroll>
      </Stack>
    </Stack>
  );
}
