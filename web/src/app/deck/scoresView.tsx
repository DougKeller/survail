/* eslint-disable max-lines */
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ClickableCardImage,
  InlineCardText,
} from "../../modules/cards/ui/cardPresentation";
import type { CardZone, Deck } from "../../modules/decks/contracts";
import type {
  CardEvaluationProgress,
  CardRoleEvaluation,
} from "../../modules/decks/evaluations/contracts";
import { CoreCardToggle } from "./coreCardToggle";
import {
  createDeckScoreContext,
  displayedRoles,
  rankScores,
  scoreContextDescription,
  type ScoreSortDirection,
  type ScoreSortKey,
} from "./scoreHelpers";
import { formatDuration } from "./time";
import { MaterialIcon, titleize, zoneLabel } from "./text";

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

function regexFilter(query: string): RegExp | null {
  const trimmed = query.trim();
  if (trimmed === "") return null;
  const pattern = trimmed
    .split("")
    .map((character) =>
      character.replaceAll(/[$()*+.?[\\\]^{|}]/g, "\\$&"),
    )
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
  const segments: Array<{ text: string; highlighted: boolean }> = [];
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
          <mark className="score-name-match" key={`${segment.text}-${String(index)}`}>
            {segment.text}
          </mark>
        ) : (
          <span key={`${segment.text}-${String(index)}`}>{segment.text}</span>
        ),
      )}
    </>
  );
}

export function DeckScoresView({
  deck,
  scores,
  scoring,
  scoreCards,
  progress,
  editGoal,
  refreshCardScore,
  refreshingOracleIds,
  toggleCoreCard,
}: {
  deck: Deck;
  scores: ReadonlyMap<string, CardRoleEvaluation>;
  scoring: boolean;
  scoreCards: () => void;
  progress: CardEvaluationProgress | null;
  editGoal: () => void;
  refreshCardScore: (oracleId: string) => void;
  refreshingOracleIds: ReadonlySet<string>;
  toggleCoreCard: (oracleId: string) => void;
}) {
  const typeMenuRef = useRef<HTMLDetailsElement | null>(null);
  const roleMenuRef = useRef<HTMLDetailsElement | null>(null);
  const zoneMenuRef = useRef<HTMLDetailsElement | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [expandedOracleId, setExpandedOracleId] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [zoneMenuOpen, setZoneMenuOpen] = useState(false);
  const [excludedTypes, setExcludedTypes] = useState<string[]>([]);
  const [excludedRoles, setExcludedRoles] = useState<string[]>([]);
  const [excludedZones, setExcludedZones] = useState<CardZone[]>([]);
  const [nameFilter, setNameFilter] = useState("");
  const { uniqueCards, roleScore, rows } = createDeckScoreContext(deck);
  const scoreRows = rows(scores);
  const activeNameFilter = regexFilter(nameFilter);
  const roleColumns = displayedRoles(scores);
  const roleFilterOptions = [
    ...roleColumns,
    ...(scoreRows.some((row) => row.evaluation === null || row.evaluation.roles.length === 0)
      ? ["Unscored"]
      : []),
  ];
  const typeFilterOptions = [
    ...SCORE_TYPE_ORDER.filter((type) =>
      scoreRows.some((row) => scoreTypeLabels(row.card?.scryfall.type_line).includes(type)),
    ),
    ...[...new Set(
      scoreRows.flatMap((row) => scoreTypeLabels(row.card?.scryfall.type_line)),
    )]
      .filter((type) => !SCORE_TYPE_ORDER.includes(type as (typeof SCORE_TYPE_ORDER)[number]))
      .sort((left, right) => left.localeCompare(right)),
  ];
  const zoneFilterOptions = [
    ...SCORE_ZONE_ORDER.filter((zone) =>
      scoreRows.some((row) => row.card?.zone === zone),
    ),
  ];
  const activeExcludedTypes = excludedTypes.filter((type) => typeFilterOptions.includes(type));
  const activeExcludedRoles = excludedRoles.filter((role) => roleFilterOptions.includes(role));
  const activeExcludedZones = excludedZones.filter((zone) => zoneFilterOptions.includes(zone));
  const scoreSortKey = searchParams.get("scoreSort");
  const scoreSortDirection = searchParams.get("scoreDir");
  const activeScoreSort: { key: ScoreSortKey; direction: ScoreSortDirection } = {
    key:
      scoreSortKey === "card" ||
      scoreSortKey === "overall" ||
      scoreSortKey === "starred" ||
      (scoreSortKey !== null && scoreSortKey.trim() !== "")
        ? scoreSortKey
        : "overall",
    direction:
      scoreSortDirection === "asc" || scoreSortDirection === "desc"
        ? scoreSortDirection
        : "desc",
  };
  const rankedScores = rankScores(scoreRows, activeScoreSort, roleScore);
  const visibleRoleColumns = roleColumns.filter((role) => !activeExcludedRoles.includes(role));
  const filteredScores = rankedScores.filter((row) => {
    const typeMatch = scoreTypeLabels(row.card?.scryfall.type_line).some(
      (type) => !activeExcludedTypes.includes(type),
    );
    const roleMatch = scoreRoleLabels(row.evaluation).some(
      (role) => !activeExcludedRoles.includes(role),
    );
    const zoneMatch =
      row.card !== undefined && !activeExcludedZones.includes(row.card.zone);
    const nameMatch = activeNameFilter === null || activeNameFilter.test(row.name);
    return typeMatch && roleMatch && zoneMatch && nameMatch;
  });
  const totalScore = scoreRows.reduce(
    (total, row) => total + (row.evaluation?.overall_score ?? 0),
    0,
  );
  const filteredTotalScore = filteredScores.reduce(
    (total, row) => total + (row.evaluation?.overall_score ?? 0),
    0,
  );

  useEffect(() => {
    function handlePointerDown(event: PointerEvent): void {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (typeMenuRef.current?.contains(target) === true) return;
      if (roleMenuRef.current?.contains(target) === true) return;
      if (zoneMenuRef.current?.contains(target) === true) return;
      setTypeMenuOpen(false);
      setRoleMenuOpen(false);
      setZoneMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    const toggleThreshold = 360;
    const syncBackToTop = () => {
      setShowBackToTop(window.scrollY > toggleThreshold);
    };

    syncBackToTop();
    window.addEventListener("scroll", syncBackToTop, { passive: true });
    return () => {
      window.removeEventListener("scroll", syncBackToTop);
    };
  }, []);

  function setSort(key: ScoreSortKey): void {
    const next =
      activeScoreSort.key === key
        ? {
            key,
            direction: activeScoreSort.direction === "asc" ? "desc" : "asc",
          }
        : { key, direction: key === "card" ? "asc" : "desc" };
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set("scoreSort", next.key);
    nextSearchParams.set("scoreDir", next.direction);
    setSearchParams(nextSearchParams, { replace: true });
  }

  function sortLabel(label: string, key: ScoreSortKey): string {
    if (activeScoreSort.key !== key) return label;
    return `${label} ${activeScoreSort.direction === "asc" ? "↑" : "↓"}`;
  }

  function selectedTypeCount(): number {
    return typeFilterOptions.length - activeExcludedTypes.length;
  }

  function selectedRoleCount(): number {
    return roleFilterOptions.length - activeExcludedRoles.length;
  }

  function selectedZoneCount(): number {
    return zoneFilterOptions.length - activeExcludedZones.length;
  }

  function toggleType(type: string): void {
    setExcludedTypes((current) =>
      current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type],
    );
  }

  function toggleRole(role: string): void {
    setExcludedRoles((current) =>
      current.includes(role)
        ? current.filter((item) => item !== role)
        : [...current, role],
    );
  }

  function toggleZone(zone: CardZone): void {
    setExcludedZones((current) =>
      current.includes(zone)
        ? current.filter((item) => item !== zone)
        : [...current, zone],
    );
  }

  return (
    <section aria-labelledby="scores-title" className="scores-view">
      <div className="view-heading">
        <div>
          <span className="eyebrow">Card evaluations</span>
          <h2 id="scores-title">Scores and role fit</h2>
        </div>
        <button
          disabled={scoring || uniqueCards === 0 || deck.goal.trim() === ""}
          onClick={scoreCards}
        >
          <MaterialIcon name="fact_check" />{" "}
          {scoring ? "Evaluating cards…" : "Evaluate cards"}
        </button>
      </div>
      {deck.goal.trim() === "" && (
        <section className="evaluation-goal-required" role="status">
          <div>
            <MaterialIcon name="flag" />
            <span>
              <strong>Add a Goal / North Star before evaluating cards</strong>
              <small>
                Scores judge how well each card supports the deck&apos;s
                intended game plan.
              </small>
            </span>
          </div>
          <button className="secondary-button" onClick={editGoal}>
            <MaterialIcon name="edit" /> Add goal
          </button>
        </section>
      )}
      <div className="evaluation-summary">
        <div className="evaluation-count">
          <strong>
            {progress === null ? scores.size : progress.completed}/{uniqueCards}
          </strong>
          <span>cards evaluated</span>
        </div>
        <div className="evaluation-count">
          <strong>{totalScore}</strong>
          <span>Total score</span>
        </div>
        {progress === null ? (
          <p className="muted">
            Cards are tagged by role and judged against{" "}
            {scoreContextDescription(deck)} using role-specific qualitative rubrics.
          </p>
        ) : (
          <p className="muted" role="status">
            Evaluating cards at{" "}
            {progress.average_seconds_per_card === null
              ? "an estimated rate"
              : `${progress.average_seconds_per_card.toFixed(1)} seconds per card`}
            .{" "}
            {progress.eta_seconds === null
              ? "Estimating time remaining…"
              : `About ${formatDuration(progress.eta_seconds)} remaining.`}
          </p>
        )}
      </div>
      {rankedScores.length > 0 && (
        <div className="score-breakdown">
          <div className="score-filters deck-toolbar">
            <div className="score-filter-group">
              <label className="score-name-filter">
                <span>Filter cards</span>
                <input
                  onChange={(event) => {
                    setNameFilter(event.target.value);
                  }}
                  placeholder="Regex-style name filter"
                  type="text"
                  value={nameFilter}
                />
              </label>
              <details
                className="score-filter-menu"
                ref={typeMenuRef}
                onToggle={(event) => {
                  const open = event.currentTarget.open;
                  setTypeMenuOpen(open);
                  if (open) {
                    setRoleMenuOpen(false);
                    setZoneMenuOpen(false);
                  }
                }}
                open={typeMenuOpen}
              >
                <summary>
                  <span>Card types</span>
                  <b>{selectedTypeCount()}/{typeFilterOptions.length}</b>
                </summary>
                <div className="score-filter-panel">
                  <div className="score-filter-actions">
                    <button
                      className="text-button"
                      onClick={() => {
                        setExcludedTypes([]);
                      }}
                      type="button"
                    >
                      Select all
                    </button>
                    <button
                      className="text-button"
                      onClick={() => {
                        setExcludedTypes([...typeFilterOptions]);
                      }}
                      type="button"
                    >
                      Select none
                    </button>
                  </div>
                  <div className="score-filter-options">
                    {typeFilterOptions.map((type) => (
                      <label key={type}>
                        <input
                          checked={!activeExcludedTypes.includes(type)}
                          onChange={() => {
                            toggleType(type);
                          }}
                          type="checkbox"
                        />
                        <span>{type}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </details>
              <details
                className="score-filter-menu"
                ref={zoneMenuRef}
                onToggle={(event) => {
                  const open = event.currentTarget.open;
                  setZoneMenuOpen(open);
                  if (open) {
                    setTypeMenuOpen(false);
                    setRoleMenuOpen(false);
                  }
                }}
                open={zoneMenuOpen}
              >
                <summary>
                  <span>Zones</span>
                  <b>{selectedZoneCount()}/{zoneFilterOptions.length}</b>
                </summary>
                <div className="score-filter-panel">
                  <div className="score-filter-actions">
                    <button
                      className="text-button"
                      onClick={() => {
                        setExcludedZones([]);
                      }}
                      type="button"
                    >
                      Select all
                    </button>
                    <button
                      className="text-button"
                      onClick={() => {
                        setExcludedZones([...zoneFilterOptions]);
                      }}
                      type="button"
                    >
                      Select none
                    </button>
                  </div>
                  <div className="score-filter-options">
                    {zoneFilterOptions.map((zone) => (
                      <label key={zone}>
                        <input
                          checked={!activeExcludedZones.includes(zone)}
                          onChange={() => {
                            toggleZone(zone);
                          }}
                          type="checkbox"
                        />
                        <span>{zoneLabel(zone)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </details>
              <details
                className="score-filter-menu"
                ref={roleMenuRef}
                onToggle={(event) => {
                  const open = event.currentTarget.open;
                  setRoleMenuOpen(open);
                  if (open) {
                    setTypeMenuOpen(false);
                    setZoneMenuOpen(false);
                  }
                }}
                open={roleMenuOpen}
              >
                <summary>
                  <span>Roles</span>
                  <b>{selectedRoleCount()}/{roleFilterOptions.length}</b>
                </summary>
                <div className="score-filter-panel">
                  <div className="score-filter-actions">
                    <button
                      className="text-button"
                      onClick={() => {
                        setExcludedRoles([]);
                      }}
                      type="button"
                    >
                      Select all
                    </button>
                    <button
                      className="text-button"
                      onClick={() => {
                        setExcludedRoles([...roleFilterOptions]);
                      }}
                      type="button"
                    >
                      Select none
                    </button>
                  </div>
                  <div className="score-filter-options">
                    {roleFilterOptions.map((role) => (
                      <label key={role}>
                        <input
                          checked={!activeExcludedRoles.includes(role)}
                          onChange={() => {
                            toggleRole(role);
                          }}
                          type="checkbox"
                        />
                        <span>{titleize(role)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </details>
            </div>
            <p className="muted">
              Showing {filteredScores.length} of {rankedScores.length} cards · visible
              total score {filteredTotalScore}
            </p>
          </div>
          <div className="score-table-wrap">
            <table className="score-table">
              <thead>
                <tr>
                  <th>
                    <button
                      className="score-sort-button"
                      onClick={() => {
                        setSort("card");
                      }}
                      type="button"
                    >
                      {sortLabel("Card", "card")}
                    </button>
                  </th>
                  <th>
                    <button
                      className="score-sort-button"
                      onClick={() => {
                        setSort("starred");
                      }}
                      type="button"
                    >
                      {sortLabel("Starred", "starred")}
                    </button>
                  </th>
                  <th>
                    <button
                      className="score-sort-button"
                      onClick={() => {
                        setSort("overall");
                      }}
                      type="button"
                    >
                      {sortLabel("Overall", "overall")}
                    </button>
                  </th>
                  {visibleRoleColumns.map((role) => (
                    <th key={role}>
                      <button
                        className="score-sort-button"
                        onClick={() => {
                          setSort(role);
                        }}
                        type="button"
                      >
                        {sortLabel(titleize(role), role)}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredScores.map((row) => {
                  const refreshing = refreshingOracleIds.has(row.oracleId);
                  const expanded = expandedOracleId === row.oracleId;
                  const roleMap = new Map<string, CardRoleEvaluation["roles"][number]>(
                    row.evaluation?.roles.map((role) => [role.role, role]) ?? [],
                  );
                  return (
                    <>
                      <tr className="score-table-row" key={row.oracleId}>
                        <th scope="row">
                          <div className="score-table-card">
                            {row.card !== undefined && (
                              <ClickableCardImage
                                card={row.card}
                                className="score-table-image"
                              />
                            )}
                            <div className="score-table-card-copy">
                              <div className="score-table-card-header">
                                <span>{highlightedName(row.name, activeNameFilter)}</span>
                                <button
                                  aria-expanded={expanded}
                                  aria-label={
                                    expanded
                                      ? `Collapse ${row.name} score details`
                                      : `Expand ${row.name} score details`
                                  }
                                  className="icon-action score-row-expand"
                                  disabled={row.evaluation === null}
                                  onClick={() => {
                                    setExpandedOracleId((current) =>
                                      current === row.oracleId ? null : row.oracleId,
                                    );
                                  }}
                                  type="button"
                                >
                                  <MaterialIcon
                                    name={expanded ? "expand_less" : "expand_more"}
                                  />
                                </button>
                                <button
                                  aria-label={`Reload ${row.name} score`}
                                  className="icon-action score-row-reload"
                                  disabled={scoring || refreshing || deck.goal.trim() === ""}
                                  onClick={() => {
                                    refreshCardScore(row.oracleId);
                                  }}
                                  type="button"
                                >
                                  <MaterialIcon
                                    name={refreshing ? "progress_activity" : "refresh"}
                                  />
                                </button>
                              </div>
                              <div className="score-table-zones">
                                {row.zones.map((zone) => (
                                  <small
                                    className={`score-table-zone score-table-zone-${zone}`}
                                    key={zone}
                                  >
                                    {zoneLabel(zone)}
                                  </small>
                                ))}
                              </div>
                            </div>
                          </div>
                        </th>
                        <td className="score-table-starred">
                          <CoreCardToggle
                            active={row.card?.core === true}
                            disabled={row.card === undefined}
                            label={row.name}
                            onClick={() => {
                              toggleCoreCard(row.oracleId);
                            }}
                          />
                        </td>
                        <td className="score-table-overall">
                          {row.evaluation?.overall_score ?? (
                            <span className="score-table-empty">-</span>
                          )}
                        </td>
                        {visibleRoleColumns.map((role) => {
                          const roleResult = roleMap.get(role);
                          return (
                            <td key={role}>
                              {roleResult === undefined ? (
                                <span className="score-table-empty">-</span>
                              ) : (
                                <strong className="score-table-score">
                                  {roleResult.score}
                                </strong>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                      {expanded && row.evaluation !== null && (
                        <tr className="score-row-details" key={`${row.oracleId}-details`}>
                          <td colSpan={3 + visibleRoleColumns.length}>
                            <div className="score-row-preview">
                              <div className="score-row-preview-header">
                                {row.card !== undefined && (
                                  <ClickableCardImage
                                    card={row.card}
                                    className="score-row-preview-image"
                                  />
                                )}
                                <div className="score-row-preview-meta">
                                  <strong>{row.name}</strong>
                                  <small>
                                    Overall score {row.evaluation.overall_score}
                                  </small>
                                  <p className="score-row-preview-comment">
                                    <InlineCardText text={row.evaluation.overall_comment} />
                                  </p>
                                </div>
                              </div>
                              <div className="score-row-preview-roles">
                                {row.evaluation.roles.map((role) => (
                                  <section className="score-row-preview-role" key={role.role}>
                                    <header>
                                      <b className={`role-tag ${role.role}`}>
                                        {titleize(role.role)}
                                      </b>
                                      <strong>{role.score}</strong>
                                    </header>
                                    <p>
                                      <InlineCardText text={role.description} />
                                    </p>
                                    <ul>
                                      {Object.entries(role.answers).map(([criterion, rating]) => (
                                        <li key={criterion}>
                                          <strong>{titleize(criterion)}</strong>
                                          <b>{titleize(rating)}</b>
                                        </li>
                                      ))}
                                    </ul>
                                  </section>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <button
        aria-hidden={!showBackToTop}
        aria-label="Back to top"
        className={`back-to-top ${showBackToTop ? "visible" : ""}`}
        onClick={() => {
          window.scrollTo({ left: 0, top: 0, behavior: "smooth" });
        }}
        tabIndex={showBackToTop ? 0 : -1}
        type="button"
      >
        <MaterialIcon name="arrow_upward" />
        <span>Back to top</span>
      </button>
    </section>
  );
}
