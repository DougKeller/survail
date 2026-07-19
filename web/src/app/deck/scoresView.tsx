import { useId, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ClipboardCheck, Trash2 } from "lucide-react";

import { Button } from "../../designsystem/primitives/button";
import { Field, Input } from "../../designsystem/primitives/input";
import { Table, TableScroll } from "../../designsystem/primitives/table";
import { Inline } from "../../designsystem/layout/inline";
import { PageHeader } from "../../designsystem/layout/page";
import { Stack } from "../../designsystem/layout/stack";
import { Heading, Kicker, Text } from "../../designsystem/layout/typography";

import type { CardZone, Deck } from "../../modules/decks/contracts";
import type {
  CardEvaluationProgress,
  CardRoleEvaluation,
  EvaluationFeedbackRequest,
} from "../../modules/decks/evaluations/contracts";
import { api } from "../api";
import {
  EvaluationStatus,
  EvaluationSummary,
  GoalRequiredNotice,
} from "./scoreSummary";
import {
  applyScoreFilters,
  FilterMenu,
  InlineFilterGroup,
  roleFilterOptions,
  typeFilterOptions,
  zoneFilterOptions,
} from "./filterMenu";
import {
  createDeckScoreContext,
  displayedRoles,
  nextScoreSort,
  rankScores,
  scoreSortFromSearchParams,
  type ScoreSortKey,
} from "./scoreHelpers";
import { regexFilter, ScoreTableHeader, ScoreTableRow } from "./scoreTable";
import { BackToTop } from "./text";
import { ClearScoreCacheDialog } from "./clearScoreCacheDialog";

function toggled<T>(current: readonly T[], item: T): T[] {
  return current.includes(item)
    ? current.filter((entry) => entry !== item)
    : [...current, item];
}

export function DeckScoresView({
  clearScores,
  clearing,
  deck,
  scores,
  scoring,
  scoreCards,
  progress,
  editGoal,
}: {
  clearScores: () => Promise<boolean>;
  clearing: boolean;
  deck: Deck;
  scores: ReadonlyMap<string, CardRoleEvaluation>;
  scoring: boolean;
  scoreCards: () => void;
  progress: CardEvaluationProgress | null;
  editGoal: () => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [expandedOracleId, setExpandedOracleId] = useState<string | null>(null);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [excludedTypes, setExcludedTypes] = useState<string[]>([]);
  const [excludedRoles, setExcludedRoles] = useState<string[]>([]);
  const [excludedZones, setExcludedZones] = useState<CardZone[]>([]);
  const [nameFilter, setNameFilter] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const nameFilterId = useId();
  const { uniqueCards, roleScore, rows } = createDeckScoreContext(deck);
  const scoreRows = rows(scores);
  const activeNameFilter = regexFilter(nameFilter);
  const roleColumns = displayedRoles(scores);
  const roleOptions = roleFilterOptions(scoreRows, roleColumns);
  const typeOptions = typeFilterOptions(scoreRows);
  const zoneOptions = zoneFilterOptions(scoreRows);
  const activeExcludedTypes = excludedTypes.filter((type) =>
    typeOptions.some((option) => option.value === type),
  );
  const activeExcludedRoles = excludedRoles.filter((role) =>
    roleOptions.some((option) => option.value === role),
  );
  const activeExcludedZones = excludedZones.filter((zone) =>
    zoneOptions.some((option) => option.value === zone),
  );
  const activeScoreSort = scoreSortFromSearchParams(searchParams);
  const rankedScores = rankScores(scoreRows, activeScoreSort, roleScore);
  const visibleRoleColumns = roleColumns.filter(
    (role) => !activeExcludedRoles.includes(role),
  );
  const filteredScores = applyScoreFilters(rankedScores, {
    excludedTypes: activeExcludedTypes,
    excludedRoles: activeExcludedRoles,
    excludedZones: activeExcludedZones,
    nameFilter: activeNameFilter,
  });
  const totalScore = scoreRows.reduce(
    (total, row) => total + (row.evaluation?.overall_score ?? 0),
    0,
  );
  const filteredTotalScore = filteredScores.reduce(
    (total, row) => total + (row.evaluation?.overall_score ?? 0),
    0,
  );

  async function submitFeedback(
    request: EvaluationFeedbackRequest,
  ): Promise<void> {
    await api.submitEvaluationFeedback(deck.id, request);
  }

  function setSort(key: ScoreSortKey): void {
    const next = nextScoreSort(activeScoreSort, key);
    // window.location is always current; render-time params can clobber
    // updates landed since the last render (see setDisplayPreferences).
    const nextSearchParams = new URLSearchParams(window.location.search);
    nextSearchParams.set("scoreSort", next.key);
    nextSearchParams.set("scoreDir", next.direction);
    setSearchParams(nextSearchParams, { replace: true });
  }

  return (
    <Stack as="section" gap={6} labelledBy="scores-title">
      <PageHeader
        actions={
          <Inline gap={2} wrap>
            <Button
              disabled={scoring || clearing || scores.size === 0}
              icon={<Trash2 size={16} strokeWidth={2.75} />}
              onClick={() => {
                setConfirmClear(true);
              }}
              variant="secondary"
            >
              Clear score cache
            </Button>
            <Button
              disabled={
                scoring ||
                clearing ||
                uniqueCards === 0 ||
                deck.goal.trim() === ""
              }
              icon={<ClipboardCheck size={16} strokeWidth={2.75} />}
              onClick={scoreCards}
            >
              {scoring ? "Evaluating cards…" : "Evaluate cards"}
            </Button>
          </Inline>
        }
      >
        <Stack gap={1}>
          <Kicker>Card evaluations</Kicker>
          <Heading id="scores-title" level={2} size="2xl">
            Scores and role fit
          </Heading>
        </Stack>
      </PageHeader>
      {deck.goal.trim() === "" && <GoalRequiredNotice editGoal={editGoal} />}
      <EvaluationSummary
        completed={progress === null ? scores.size : progress.completed}
        totalScore={totalScore}
        uniqueCards={uniqueCards}
      />
      <EvaluationStatus deck={deck} progress={progress} />
      {rankedScores.length > 0 && (
        <Stack gap={4}>
          <Inline align="end" gap={3} justify="between" wrap>
            <Inline align="end" gap={3} wrap>
              <Field htmlFor={nameFilterId} label="Filter cards">
                <Input
                  id={nameFilterId}
                  onChange={(event) => {
                    setNameFilter(event.target.value);
                  }}
                  placeholder="Regex-style name filter"
                  type="text"
                  value={nameFilter}
                />
              </Field>
              <FilterMenu
                excluded={activeExcludedTypes}
                label="Card types"
                onOpenChange={(open) => {
                  setTypeMenuOpen(open);
                  if (open) {
                    setRoleMenuOpen(false);
                  }
                }}
                onSelectAll={() => {
                  setExcludedTypes([]);
                }}
                onSelectNone={() => {
                  setExcludedTypes(typeOptions.map((option) => option.value));
                }}
                onToggle={(type) => {
                  setExcludedTypes((current) => toggled(current, type));
                }}
                open={typeMenuOpen}
                options={typeOptions}
              />
              <InlineFilterGroup
                excluded={activeExcludedZones}
                label="Zones"
                onSelectAll={() => {
                  setExcludedZones([]);
                }}
                onSelectNone={() => {
                  setExcludedZones(zoneOptions.map((option) => option.value));
                }}
                onToggle={(zone) => {
                  setExcludedZones((current) => toggled(current, zone));
                }}
                options={zoneOptions}
              />
              <FilterMenu
                excluded={activeExcludedRoles}
                label="Roles"
                onOpenChange={(open) => {
                  setRoleMenuOpen(open);
                  if (open) {
                    setTypeMenuOpen(false);
                  }
                }}
                onSelectAll={() => {
                  setExcludedRoles([]);
                }}
                onSelectNone={() => {
                  setExcludedRoles(roleOptions.map((option) => option.value));
                }}
                onToggle={(role) => {
                  setExcludedRoles((current) => toggled(current, role));
                }}
                open={roleMenuOpen}
                options={roleOptions}
              />
            </Inline>
            <Text muted size="md">
              Showing {filteredScores.length} of {rankedScores.length} cards ·
              visible total score {filteredTotalScore}
            </Text>
          </Inline>
          <TableScroll>
            <Table>
              <ScoreTableHeader
                onSort={setSort}
                sort={activeScoreSort}
                visibleRoleColumns={visibleRoleColumns}
              />
              <tbody>
                {filteredScores.map((row) => (
                  <ScoreTableRow
                    expanded={expandedOracleId === row.oracleId}
                    key={row.oracleId}
                    nameFilter={activeNameFilter}
                    onToggleExpanded={() => {
                      setExpandedOracleId((current) =>
                        current === row.oracleId ? null : row.oracleId,
                      );
                    }}
                    row={row}
                    submitFeedback={submitFeedback}
                    visibleRoleColumns={visibleRoleColumns}
                  />
                ))}
              </tbody>
            </Table>
          </TableScroll>
        </Stack>
      )}
      <BackToTop />
      <ClearScoreCacheDialog
        clearing={clearing}
        onCancel={() => {
          if (!clearing) setConfirmClear(false);
        }}
        onConfirm={() => {
          void clearScores().then((cleared) => {
            if (cleared) setConfirmClear(false);
            return undefined;
          });
        }}
        open={confirmClear}
      />
    </Stack>
  );
}
