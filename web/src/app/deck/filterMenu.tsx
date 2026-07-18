import { Button } from "../../designsystem/primitives/button";
import { Checkbox } from "../../designsystem/primitives/choice";
import { Disclosure } from "../../designsystem/primitives/disclosure";
import { Fieldset } from "../../designsystem/primitives/fieldset";
import { Inline } from "../../designsystem/layout/inline";
import { Stack } from "../../designsystem/layout/stack";

import type { CardZone } from "../../modules/decks/contracts";
import type { CardRoleEvaluation } from "../../modules/decks/evaluations/contracts";
import { useDismissibleSurface } from "./hooks";
import type { ScoreRow } from "./scoreHelpers";
import { titleize, zoneLabel } from "./text";

const SCORE_TYPE_ORDER = [
  "Creature",
  "Land",
  "Instant",
  "Sorcery",
  "Artifact",
  "Enchantment",
  "Planeswalker",
  "Battle",
  "Other",
  "Unknown",
] as const;

const SCORE_ZONE_ORDER: readonly CardZone[] = [
  "commander",
  "mainboard",
  "sideboard",
  "companion",
  "considering",
];

export interface FilterOption<T extends string = string> {
  value: T;
  label: string;
}

function scoreTypeLabels(typeLine: string | undefined): string[] {
  if (typeLine === undefined || typeLine.trim() === "") return ["Unknown"];
  const matches = SCORE_TYPE_ORDER.filter(
    (type) => type !== "Other" && type !== "Unknown" && typeLine.includes(type),
  );
  return matches.length === 0 ? ["Other"] : [...matches];
}

function scoreRoleLabels(evaluation: CardRoleEvaluation | null): string[] {
  if (evaluation === null || evaluation.roles.length === 0) return ["Unscored"];
  return evaluation.roles.map((role) => role.role);
}

export function applyScoreFilters(
  rows: readonly ScoreRow[],
  filters: {
    excludedTypes: readonly string[];
    excludedRoles: readonly string[];
    excludedZones: readonly CardZone[];
    nameFilter: RegExp | null;
  },
): ScoreRow[] {
  return rows.filter((row) => {
    const typeMatch = scoreTypeLabels(row.card?.scryfall.type_line).some(
      (type) => !filters.excludedTypes.includes(type),
    );
    const roleMatch = scoreRoleLabels(row.evaluation).some(
      (role) => !filters.excludedRoles.includes(role),
    );
    const zoneMatch =
      row.card !== undefined && !filters.excludedZones.includes(row.card.zone);
    const nameMatch =
      filters.nameFilter === null || filters.nameFilter.test(row.name);
    return typeMatch && roleMatch && zoneMatch && nameMatch;
  });
}

export function typeFilterOptions(
  scoreRows: readonly ScoreRow[],
): FilterOption[] {
  return [
    ...SCORE_TYPE_ORDER.filter((type) =>
      scoreRows.some((row) =>
        scoreTypeLabels(row.card?.scryfall.type_line).includes(type),
      ),
    ),
    ...[
      ...new Set(
        scoreRows.flatMap((row) =>
          scoreTypeLabels(row.card?.scryfall.type_line),
        ),
      ),
    ]
      .filter(
        (type) =>
          !SCORE_TYPE_ORDER.includes(type as (typeof SCORE_TYPE_ORDER)[number]),
      )
      .sort((left, right) => left.localeCompare(right)),
  ].map((type) => ({ value: type, label: type }));
}

export function zoneFilterOptions(
  scoreRows: readonly ScoreRow[],
): FilterOption<CardZone>[] {
  return SCORE_ZONE_ORDER.filter((zone) =>
    scoreRows.some((row) => row.card?.zone === zone),
  ).map((zone) => ({ value: zone, label: zoneLabel(zone) }));
}

export function roleFilterOptions(
  scoreRows: readonly ScoreRow[],
  roleColumns: readonly string[],
): FilterOption[] {
  return [
    ...roleColumns,
    ...(scoreRows.some(
      (row) => row.evaluation === null || row.evaluation.roles.length === 0,
    )
      ? ["Unscored"]
      : []),
  ].map((role) => ({ value: role, label: titleize(role) }));
}

interface FilterControlsProps<T extends string> {
  options: readonly FilterOption<T>[];
  excluded: readonly T[];
  onToggle: (value: T) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
}

function FilterActions({
  onSelectAll,
  onSelectNone,
}: {
  onSelectAll: () => void;
  onSelectNone: () => void;
}) {
  return (
    <Inline gap={1}>
      <Button onClick={onSelectAll} variant="ghost">
        Select all
      </Button>
      <Button onClick={onSelectNone} variant="ghost">
        Select none
      </Button>
    </Inline>
  );
}

function FilterCheckboxes<T extends string>({
  options,
  excluded,
  onToggle,
}: {
  options: readonly FilterOption<T>[];
  excluded: readonly T[];
  onToggle: (value: T) => void;
}) {
  return (
    <>
      {options.map((option) => (
        <Checkbox
          checked={!excluded.includes(option.value)}
          key={option.value}
          label={option.label}
          onChange={() => {
            onToggle(option.value);
          }}
        />
      ))}
    </>
  );
}

export function FilterMenu<T extends string>({
  label,
  options,
  excluded,
  onToggle,
  onSelectAll,
  onSelectNone,
  open,
  onOpenChange,
}: FilterControlsProps<T> & {
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const menuRef = useDismissibleSurface<HTMLDetailsElement>(
    open,
    () => {
      onOpenChange(false);
    },
    { manageFocus: false },
  );
  return (
    <Disclosure
      count={`${String(options.length - excluded.length)}/${String(options.length)}`}
      label={label}
      onOpenChange={onOpenChange}
      open={open}
      ref={menuRef}
    >
      <FilterActions onSelectAll={onSelectAll} onSelectNone={onSelectNone} />
      <Stack gap={1}>
        <FilterCheckboxes
          excluded={excluded}
          onToggle={onToggle}
          options={options}
        />
      </Stack>
    </Disclosure>
  );
}

export function InlineFilterGroup<T extends string>({
  label,
  options,
  excluded,
  onToggle,
  onSelectAll,
  onSelectNone,
}: FilterControlsProps<T> & { label: string }) {
  return (
    <Fieldset
      count={`${String(options.length - excluded.length)}/${String(options.length)}`}
      legend={label}
    >
      <FilterActions onSelectAll={onSelectAll} onSelectNone={onSelectNone} />
      <FilterCheckboxes
        excluded={excluded}
        onToggle={onToggle}
        options={options}
      />
    </Fieldset>
  );
}
