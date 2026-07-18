import { ChevronDown, ChevronUp, Loader2, RefreshCw } from "lucide-react";

import { Card } from "../../designsystem/primitives/card";
import { IconButton } from "../../designsystem/primitives/button";
import { SortableHeader } from "../../designsystem/primitives/table";
import { Tag, type TagTone } from "../../designsystem/primitives/tag";
import { Divided } from "../../designsystem/layout/divided";
import { Grid } from "../../designsystem/layout/grid";
import { Inline } from "../../designsystem/layout/inline";
import { Stack } from "../../designsystem/layout/stack";
import { Mark, Text } from "../../designsystem/layout/typography";

import {
  ClickableCardImage,
  InlineCardText,
} from "../../modules/cards/ui/cardPresentation";
import type { CardZone } from "../../modules/decks/contracts";
import type { CardRoleEvaluation } from "../../modules/decks/evaluations/contracts";
import { CoreCardToggle } from "./coreCardToggle";
import type {
  ScoreRow,
  ScoreSortDirection,
  ScoreSortKey,
} from "./scoreHelpers";
import { titleize, zoneLabel } from "./text";

const ZONE_TONES: Partial<Record<CardZone, TagTone>> = {
  commander: "accent",
  mainboard: "accent2",
  considering: "outline",
};

export function regexFilter(query: string): RegExp | null {
  const trimmed = query.trim();
  if (trimmed === "") return null;
  const pattern = trimmed
    .split("")
    .map((character) => character.replaceAll(/[$()*+.?[\\\]^{|}]/g, "\\$&"))
    .join(".*?");
  return new RegExp(`.*?${pattern}.*?`, "i");
}

function highlightedName(
  name: string,
  filter: RegExp | null,
): React.JSX.Element | string {
  if (filter === null) return name;
  const matched = filter.exec(name);
  if (matched === null || matched[0].length === 0) return name;
  const target = matched[0];
  const segments: { text: string; highlighted: boolean }[] = [];
  let cursor = 0;

  for (const character of target) {
    const index = name
      .toLocaleLowerCase()
      .indexOf(character.toLocaleLowerCase(), cursor);
    if (index === -1) continue;
    if (index > cursor) {
      segments.push({ text: name.slice(cursor, index), highlighted: false });
    }
    segments.push({ text: name.slice(index, index + 1), highlighted: true });
    cursor = index + 1;
  }

  if (segments.length === 0) return name;
  if (cursor < name.length) {
    segments.push({ text: name.slice(cursor), highlighted: false });
  }

  return (
    <>
      {segments.map((segment, index) =>
        segment.highlighted ? (
          <Mark key={`${segment.text}-${String(index)}`}>{segment.text}</Mark>
        ) : (
          <span key={`${segment.text}-${String(index)}`}>{segment.text}</span>
        ),
      )}
    </>
  );
}

export function ScoreTableHeader({
  sort,
  onSort,
  visibleRoleColumns,
}: {
  sort: { key: ScoreSortKey; direction: ScoreSortDirection };
  onSort: (key: ScoreSortKey) => void;
  visibleRoleColumns: readonly string[];
}) {
  const columns: [string, ScoreSortKey][] = [
    ["Card", "card"],
    ["Starred", "starred"],
    ["Overall", "overall"],
    ...visibleRoleColumns.map((role): [string, ScoreSortKey] => [
      titleize(role),
      role,
    ]),
  ];
  return (
    <thead>
      <tr>
        {columns.map(([label, key]) => (
          <th key={key}>
            <SortableHeader
              active={sort.key === key}
              direction={sort.direction}
              onClick={() => {
                onSort(key);
              }}
            >
              {label}
            </SortableHeader>
          </th>
        ))}
      </tr>
    </thead>
  );
}

function ScoreRowDetails({
  row,
  evaluation,
  columnCount,
}: {
  row: ScoreRow;
  evaluation: CardRoleEvaluation;
  columnCount: number;
}) {
  return (
    <tr>
      <td colSpan={columnCount}>
        <Stack gap={4}>
          <Inline align="start" gap={4}>
            {row.card !== undefined && (
              <ClickableCardImage card={row.card} size="preview" />
            )}
            <Stack gap={1}>
              <Text size="base">
                <strong>{row.name}</strong>
              </Text>
              <Text muted size="sm">
                Overall score {evaluation.overall_score}
              </Text>
              <Text size="md">
                <InlineCardText text={evaluation.overall_comment} />
              </Text>
            </Stack>
          </Inline>
          <Grid gap={3}>
            {evaluation.roles.map((role) => (
              <Card as="article" key={role.role}>
                <Inline gap={3} justify="between">
                  <Tag tone="accent2">{titleize(role.role)}</Tag>
                  <Text as="span" size="base">
                    <strong>{role.score}</strong>
                  </Text>
                </Inline>
                <Text size="md">
                  <InlineCardText text={role.description} />
                </Text>
                <Divided>
                  {Object.entries(role.answers).map(([criterion, rating]) => (
                    <Inline gap={3} justify="between" key={criterion}>
                      <Text as="span" size="sm">
                        {titleize(criterion)}
                      </Text>
                      <Text as="span" size="sm">
                        <strong>{titleize(rating)}</strong>
                      </Text>
                    </Inline>
                  ))}
                </Divided>
              </Card>
            ))}
          </Grid>
        </Stack>
      </td>
    </tr>
  );
}

export function ScoreTableRow({
  row,
  nameFilter,
  visibleRoleColumns,
  expanded,
  onToggleExpanded,
  refreshing,
  refreshDisabled,
  onRefresh,
  onToggleCore,
}: {
  row: ScoreRow;
  nameFilter: RegExp | null;
  visibleRoleColumns: readonly string[];
  expanded: boolean;
  onToggleExpanded: () => void;
  refreshing: boolean;
  refreshDisabled: boolean;
  onRefresh: () => void;
  onToggleCore: () => void;
}) {
  const roleMap = new Map<string, CardRoleEvaluation["roles"][number]>(
    row.evaluation?.roles.map((role) => [role.role, role]) ?? [],
  );
  return (
    <>
      <tr>
        <th scope="row">
          <Inline align="start" gap={2}>
            {row.card !== undefined && (
              <ClickableCardImage card={row.card} size="thumb" />
            )}
            <Stack gap={1}>
              <Inline gap={1}>
                <Text as="span" size="base">
                  {highlightedName(row.name, nameFilter)}
                </Text>
                <IconButton
                  aria-expanded={expanded}
                  disabled={row.evaluation === null}
                  label={
                    expanded
                      ? `Collapse ${row.name} score details`
                      : `Expand ${row.name} score details`
                  }
                  onClick={onToggleExpanded}
                  variant="ghost"
                >
                  {expanded ? (
                    <ChevronUp size={15} strokeWidth={2.75} />
                  ) : (
                    <ChevronDown size={15} strokeWidth={2.75} />
                  )}
                </IconButton>
                <IconButton
                  disabled={refreshDisabled}
                  label={`Reload ${row.name} score`}
                  onClick={onRefresh}
                  variant="ghost"
                >
                  {refreshing ? (
                    <Loader2 size={15} strokeWidth={2.75} />
                  ) : (
                    <RefreshCw size={15} strokeWidth={2.75} />
                  )}
                </IconButton>
              </Inline>
              <Inline gap={1} wrap>
                {row.zones.map((zone) => (
                  <Tag key={zone} tone={ZONE_TONES[zone] ?? "neutral"}>
                    {zoneLabel(zone)}
                  </Tag>
                ))}
              </Inline>
            </Stack>
          </Inline>
        </th>
        <td>
          <CoreCardToggle
            active={row.card?.core === true}
            disabled={row.card === undefined}
            label={row.name}
            onClick={onToggleCore}
          />
        </td>
        <td>
          {row.evaluation === null ? (
            <Text as="span" muted size="md">
              -
            </Text>
          ) : (
            <Text as="span" size="base">
              <strong>{row.evaluation.overall_score}</strong>
            </Text>
          )}
        </td>
        {visibleRoleColumns.map((role) => {
          const roleResult = roleMap.get(role);
          return (
            <td key={role}>
              {roleResult === undefined ? (
                <Text as="span" muted size="md">
                  -
                </Text>
              ) : (
                <Text as="span" size="base">
                  <strong>{roleResult.score}</strong>
                </Text>
              )}
            </td>
          );
        })}
      </tr>
      {expanded && row.evaluation !== null && (
        <ScoreRowDetails
          columnCount={3 + visibleRoleColumns.length}
          evaluation={row.evaluation}
          row={row}
        />
      )}
    </>
  );
}
