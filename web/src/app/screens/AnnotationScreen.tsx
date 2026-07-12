import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api } from "../api";
import { useDeckScoring } from "../editor/useDeckScoring";
import { MaterialIcon, titleize } from "../deckPrimitives";

import type { Deck } from "../../modules/decks/contracts";
import type {
  CardRole,
  QualitativeRating,
  RoleAnnotationCapture,
  RoleAnnotationLabel,
} from "../../modules/decks/evaluations/contracts";

const ROLE_NAMES: CardRole[] = [
  "land",
  "mana_ramp",
  "card_advantage",
  "selection_tutor",
  "interaction",
  "board_control",
  "protection",
  "engine_enabler",
  "engine_support",
  "payoff",
];
const RATINGS: QualitativeRating[] = [
  "very_low",
  "low",
  "neutral",
  "high",
  "very_high",
];

type ListedCapture = RoleAnnotationCapture & { status: "unlabeled" | "labeled" };

function combineCaptures(
  unlabeled: RoleAnnotationCapture[],
  labeled: RoleAnnotationCapture[],
): ListedCapture[] {
  return [
    ...unlabeled.map((item) => ({ ...item, status: "unlabeled" as const })),
    ...labeled.map((item) => ({ ...item, status: "labeled" as const })),
  ];
}

function predictedRoles(capture: RoleAnnotationCapture): CardRole[] {
  return ROLE_NAMES.filter((role) => capture.output[role] !== "N/A");
}

function predictedCriteria(
  capture: RoleAnnotationCapture,
  role: CardRole,
): Record<string, QualitativeRating> {
  const value = capture.output[role];
  if (typeof value !== "object" || value === null || !("answers" in value)) return {};
  const answers = value.answers;
  return typeof answers === "object" && answers !== null
    ? (answers as Record<string, QualitativeRating>)
    : {};
}

function extractContext(inputText: string): string {
  const marker = "Card under evaluation:\n";
  const [, after] = inputText.split(marker);
  if (after === undefined) return inputText;
  return after.split("\n\nRole rubrics:\n")[0] ?? after;
}

function emptyLabel(): RoleAnnotationLabel {
  return { roles: [] };
}

export function AnnotationScreen() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const {
    annotationLoading,
    annotationQueue,
    loadAnnotationQueue,
    runSandbox,
    sandboxRun,
    sandboxRunning,
    saveAnnotationLabel,
  } = useDeckScoring({
    deck,
    setAnnouncement,
    setError,
  });
  const captures = useMemo(
    () =>
      annotationQueue === null
        ? []
        : combineCaptures(annotationQueue.unlabeled, annotationQueue.labeled),
    [annotationQueue],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [label, setLabel] = useState<RoleAnnotationLabel>(emptyLabel);
  const [sandboxPrompt, setSandboxPrompt] = useState("");
  const [sandboxModel, setSandboxModel] = useState("gpt-5.4-mini");
  const selected =
    captures.find((item) => item.id === selectedId) ?? captures[0] ?? null;

  useEffect(() => {
    void api.deck(id).then(setDeck, (reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Could not load deck");
    });
  }, [id]);

  useEffect(() => {
    if (deck === null) return;
    void loadAnnotationQueue();
  }, [deck, loadAnnotationQueue]);

  useEffect(() => {
    setSelectedId((current) => current ?? captures[0]?.id ?? null);
  }, [captures]);

  useEffect(() => {
    setLabel(selected?.label ?? emptyLabel());
    setSandboxPrompt(selected?.system_prompt ?? "");
  }, [selected?.id]);

  function hasRole(role: CardRole): boolean {
    return label.roles.some((item) => item.role === role);
  }

  function toggleRole(role: CardRole): void {
    setLabel((current) => ({
      roles: hasRole(role)
        ? current.roles.filter((item) => item.role !== role)
        : [...current.roles, { role, notes: null, criteria: {} }],
    }));
  }

  function updateRole(
    role: CardRole,
    update: (current: RoleAnnotationLabel["roles"][number]) => RoleAnnotationLabel["roles"][number],
  ): void {
    setLabel((current) => ({
      roles: current.roles.map((item) => (item.role === role ? update(item) : item)),
    }));
  }

  if (deck === null) {
    return <main>{error ?? "Loading…"}</main>;
  }

  return (
    <main className="annotation-screen">
      <div aria-atomic="true" aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <section className="annotation-screen-header">
        <div>
          <Link className="annotation-back-link" to={`/decks/${deck.id}`}>
            <MaterialIcon name="arrow_back" /> {deck.title}
          </Link>
          <span className="eyebrow">Annotation portal</span>
          <h1>Prompt refinement workspace</h1>
          <p className="muted">
            Review completions, label expected roles, and test revised prompts against the labeled set.
          </p>
        </div>
        <div className="annotation-header-actions">
          <button
            className="secondary-button labeled-action"
            onClick={() => {
              navigate(`/decks/${deck.id}`);
            }}
            type="button"
          >
            <MaterialIcon name="table_chart" /> Deck editor
          </button>
        </div>
      </section>
      {error !== null && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <section className="annotation-workspace">
        <aside className="annotation-list-pane">
          <div className="annotation-pane-header">
            <div>
              <h2>Entries</h2>
              <p className="muted">
                {annotationLoading ? "Loading…" : `${captures.length} total captures`}
              </p>
            </div>
          </div>
          <div className="annotation-entry-list">
            {captures.map((capture) => (
              <button
                className={`annotation-entry ${selected?.id === capture.id ? "selected" : ""}`}
                key={capture.id}
                onClick={() => {
                  setSelectedId(capture.id);
                }}
                type="button"
              >
                <div className="annotation-entry-header">
                  <strong>{capture.oracle_id}</strong>
                  <span className={`annotation-status ${capture.status}`}>
                    {capture.status}
                  </span>
                </div>
                <span className="annotation-entry-meta">
                  {predictedRoles(capture).map((role) => titleize(role)).join(", ") || "No roles"}
                </span>
                <span className="annotation-entry-meta">
                  {capture.model} · rev {capture.deck_revision}
                </span>
              </button>
            ))}
            {!annotationLoading && captures.length === 0 && (
              <p className="muted">No annotation captures exist yet.</p>
            )}
          </div>
        </aside>
        <section className="annotation-detail-pane">
          {selected === null ? (
            <p className="muted">Select an entry to inspect it.</p>
          ) : (
            <>
              <div className="annotation-pane-header">
                <div>
                  <h2>{selected.oracle_id}</h2>
                  <p className="muted">
                    {selected.model} · {selected.evaluator_version}
                  </p>
                </div>
                <span className={`annotation-status ${selected.status}`}>
                  {selected.status}
                </span>
              </div>
              <div className="annotation-detail-grid">
                <div className="annotation-editor-panel">
                  <div className="annotation-editor-section">
                    <strong>Expected roles</strong>
                    <div className="annotation-role-grid">
                      {ROLE_NAMES.map((role) => (
                        <label className="annotation-role-option" key={role}>
                          <input
                            checked={hasRole(role)}
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
                  <div className="annotation-editor-section">
                    <strong>Predicted roles</strong>
                    <p className="muted">
                      {predictedRoles(selected).map((role) => titleize(role)).join(", ") || "None"}
                    </p>
                  </div>
                  {label.roles.map((role) => (
                    <section className="annotation-role-editor" key={role.role}>
                      <header>
                        <strong>{titleize(role.role)}</strong>
                        <button
                          className="text-button"
                          onClick={() => {
                            setAdvanced((current) => !current);
                          }}
                          type="button"
                        >
                          {advanced ? "Hide criteria" : "Advanced criteria"}
                        </button>
                      </header>
                      <textarea
                        onChange={(event) => {
                          updateRole(role.role, (current) => ({
                            ...current,
                            notes: event.target.value === "" ? null : event.target.value,
                          }));
                        }}
                        placeholder="Optional rationale"
                        value={role.notes ?? ""}
                      />
                      {advanced && (
                        <div className="annotation-criteria">
                          {Object.entries(predictedCriteria(selected, role.role)).map(
                            ([criterion, predicted]) => (
                              <label className="annotation-criterion" key={criterion}>
                                <span>{titleize(criterion)}</span>
                                <small>Predicted: {titleize(predicted)}</small>
                                <select
                                  onChange={(event) => {
                                    const expected = event.target.value as QualitativeRating;
                                    updateRole(role.role, (current) => ({
                                      ...current,
                                      criteria: {
                                        ...current.criteria,
                                        [criterion]: {
                                          expected_rating: expected,
                                          acceptable_min: expected,
                                          acceptable_max: expected,
                                        },
                                      },
                                    }));
                                  }}
                                  value={role.criteria[criterion]?.expected_rating ?? "neutral"}
                                >
                                  {RATINGS.map((rating) => (
                                    <option key={rating} value={rating}>
                                      {titleize(rating)}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            ),
                          )}
                        </div>
                      )}
                    </section>
                  ))}
                  <div className="annotation-actions">
                    <button
                      onClick={() => {
                        void saveAnnotationLabel(selected.id, label);
                      }}
                      type="button"
                    >
                      <MaterialIcon name="save" /> Save label
                    </button>
                  </div>
                  <div className="annotation-sandbox-panel">
                    <strong>Sandbox</strong>
                    <label className="annotation-sandbox-field">
                      <span>Model</span>
                      <input
                        onChange={(event) => {
                          setSandboxModel(event.target.value);
                        }}
                        value={sandboxModel}
                      />
                    </label>
                    <label className="annotation-sandbox-field">
                      <span>System prompt</span>
                      <textarea
                        className="annotation-sandbox-prompt"
                        onChange={(event) => {
                          setSandboxPrompt(event.target.value);
                        }}
                        value={sandboxPrompt}
                      />
                    </label>
                    <button
                      disabled={sandboxRunning || sandboxPrompt.trim() === ""}
                      onClick={() => {
                        void runSandbox(sandboxPrompt, sandboxModel);
                      }}
                      type="button"
                    >
                      <MaterialIcon name="science" /> {sandboxRunning ? "Running…" : "Run sandbox"}
                    </button>
                    {sandboxRun !== null && (
                      <div className="annotation-sandbox-results">
                        <div className="annotation-metric-grid">
                          <div>
                            <strong>{sandboxRun.example_count}</strong>
                            <span>Examples</span>
                          </div>
                          <div>
                            <strong>{sandboxRun.overall_role_metrics.accuracy ?? "-"}</strong>
                            <span>Role accuracy</span>
                          </div>
                          <div>
                            <strong>{sandboxRun.overall_role_metrics.precision ?? "-"}</strong>
                            <span>Role precision</span>
                          </div>
                          <div>
                            <strong>{sandboxRun.overall_role_metrics.recall ?? "-"}</strong>
                            <span>Role recall</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="annotation-inspector-pane">
                  <section className="annotation-inspector-section">
                    <header>
                      <strong>System prompt</strong>
                    </header>
                    <pre>{selected.system_prompt}</pre>
                  </section>
                  <section className="annotation-inspector-section">
                    <header>
                      <strong>Card context</strong>
                    </header>
                    <pre>{extractContext(selected.input_text)}</pre>
                  </section>
                  <section className="annotation-inspector-section">
                    <header>
                      <strong>LLM output</strong>
                    </header>
                    <pre>{JSON.stringify(selected.output, null, 2)}</pre>
                  </section>
                </div>
              </div>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
