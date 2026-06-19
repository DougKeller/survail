/* eslint-disable max-lines */
import { useState } from "react";
import {
  ClickableCardImage,
  InlineCardText,
} from "../../modules/cards/ui/cardPresentation";
import type { Deck } from "../../modules/decks/contracts";
import type {
  CardEvaluationProgress,
  CardRoleEvaluation,
} from "../../modules/decks/evaluations/contracts";
import { CARD_ROLE_ORDER } from "./constants";
import { CoreCardToggle } from "./coreCardToggle";
import {
  createDeckScoreContext,
  rankScores,
  scoreContextDescription,
  type ScoreSortDirection,
  type ScoreSortKey,
  updateHoverPreview,
} from "./scoreHelpers";
import { formatDuration } from "./time";
import { MaterialIcon, titleize } from "./text";

export function DeckScoresView({
  deck,
  scores,
  scoring,
  scoreCards,
  progress,
  editGoal,
  toggleCoreCard,
}: {
  deck: Deck;
  scores: ReadonlyMap<string, CardRoleEvaluation>;
  scoring: boolean;
  scoreCards: () => void;
  progress: CardEvaluationProgress | null;
  editGoal: () => void;
  toggleCoreCard: (oracleId: string) => void;
}) {
  const [scoreSort, setScoreSort] = useState<{
    key: ScoreSortKey;
    direction: ScoreSortDirection;
  }>({
    key: "overall",
    direction: "desc",
  });
  const [hoveredScore, setHoveredScore] =
    useState<ReturnType<typeof updateHoverPreview> | null>(null);
  const { uniqueCards, roleScore, rows } = createDeckScoreContext(deck);
  const rankedScores = rankScores(rows(scores), scoreSort, roleScore);

  function setSort(key: ScoreSortKey): void {
    setScoreSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "card" ? "asc" : "desc" },
    );
  }

  function sortLabel(label: string, key: ScoreSortKey): string {
    if (scoreSort.key !== key) return label;
    return `${label} ${scoreSort.direction === "asc" ? "↑" : "↓"}`;
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
                  {CARD_ROLE_ORDER.map((role) => (
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
                {rankedScores.map((row) => {
                  const roleMap = new Map(
                    row.evaluation?.roles.map((role) => [role.role, role]) ?? [],
                  );
                  return (
                    <tr
                      className="score-table-row"
                      key={row.oracleId}
                      onMouseEnter={(event) => {
                        if (row.evaluation === null) return;
                        setHoveredScore(
                          updateHoverPreview(event, row.evaluation, row.card, row.name),
                        );
                      }}
                      onMouseLeave={() => {
                        setHoveredScore(null);
                      }}
                      onMouseMove={(event) => {
                        if (row.evaluation === null) return;
                        setHoveredScore(
                          updateHoverPreview(event, row.evaluation, row.card, row.name),
                        );
                      }}
                    >
                      <th scope="row">
                        <div className="score-table-card">
                          {row.card !== undefined && (
                            <ClickableCardImage
                              card={row.card}
                              className="score-table-image"
                            />
                          )}
                          <span>{row.name}</span>
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
                      {CARD_ROLE_ORDER.map((role) => {
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
                  );
                })}
              </tbody>
            </table>
            {hoveredScore !== null && (
              <aside
                className="score-hover-preview"
                style={{
                  left: `${String(hoveredScore.left)}px`,
                  top: `${String(hoveredScore.top)}px`,
                  width: `${String(hoveredScore.width)}px`,
                }}
              >
                <div className="score-row-preview-header">
                  {hoveredScore.card !== undefined && (
                    <ClickableCardImage
                      card={hoveredScore.card}
                      className="score-row-preview-image"
                    />
                  )}
                  <div className="score-row-preview-meta">
                    <strong>{hoveredScore.name}</strong>
                    <small>
                      Overall score {hoveredScore.score.overall_score}
                    </small>
                    <p className="score-row-preview-comment">
                      <InlineCardText
                        text={hoveredScore.score.overall_comment}
                      />
                    </p>
                  </div>
                </div>
                <div className="score-row-preview-roles">
                  {hoveredScore.score.roles.map((role) => (
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
                        {role.answers.map((answer) => (
                          <li key={answer.criterion_id}>
                            <strong>{titleize(answer.criterion_id)}</strong>
                            <b>
                              {titleize(answer.rating)} · {answer.score}
                            </b>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </aside>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
