import type { Dispatch, SetStateAction } from "react";

import type {
  ImportPreferenceKind,
  ImportPreferenceRule,
  ImportPreferences,
} from "../../modules/imports/contracts";
import { PREFERENCE_LABELS } from "../deckPrimitives";

function moveLabel(index: number, kind: ImportPreferenceKind) {
  return `${String(index + 1)}. ${PREFERENCE_LABELS[kind]}`;
}

export function ImportPreferencesEditor({
  draggedPreference,
  importPreferences,
  movePreference,
  setDraggedPreference,
  setImportPreferences,
  updateCheapestBuffer,
  updateFrame,
}: {
  draggedPreference: ImportPreferenceKind | null;
  importPreferences: ImportPreferences;
  movePreference: (
    source: ImportPreferenceKind,
    target: ImportPreferenceKind,
  ) => void;
  setDraggedPreference: (value: ImportPreferenceKind | null) => void;
  setImportPreferences: Dispatch<SetStateAction<ImportPreferences>>;
  updateCheapestBuffer: (bufferPercent: number) => void;
  updateFrame: (
    frame: Extract<ImportPreferenceRule, { kind: "frame" }>["frame"],
  ) => void;
}) {
  return (
    <fieldset className="import-options">
      <legend>Printing priority</legend>
      <p className="muted">
        Drag rules into priority order. Each rule falls through when it cannot
        choose between available printings.
      </p>
      <div
        aria-label="Printing preference priority"
        className="preference-list"
        role="list"
      >
        {importPreferences.rules.map((rule, index) => (
          <div
            aria-label={moveLabel(index, rule.kind)}
            className="preference-rule"
            draggable
            key={rule.kind}
            onDragEnd={() => {
              setDraggedPreference(null);
            }}
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDragStart={() => {
              setDraggedPreference(rule.kind);
            }}
            onDrop={() => {
              if (draggedPreference !== null)
                movePreference(draggedPreference, rule.kind);
            }}
            role="listitem"
          >
            <span aria-hidden="true" className="drag-handle">
              ⋮⋮
            </span>
            <strong>{moveLabel(index, rule.kind)}</strong>
            {rule.kind === "cheapest" && (
              <label>
                Price buffer
                <span>
                  <input
                    max="100"
                    min="0"
                    onChange={(event) => {
                      updateCheapestBuffer(Number(event.target.value));
                    }}
                    type="number"
                    value={rule.bufferPercent}
                  />
                  %
                </span>
              </label>
            )}
            {rule.kind === "frame" && (
              <label>
                Style
                <select
                  onChange={(event) => {
                    updateFrame(
                      event.target.value as Extract<
                        ImportPreferenceRule,
                        { kind: "frame" }
                      >["frame"],
                    );
                  }}
                  value={rule.frame}
                >
                  <option value="1993">Original (1993)</option>
                  <option value="1997">Classic (1997)</option>
                  <option value="2003">Modern (2003)</option>
                  <option value="2015">M15/current (2015)</option>
                  <option value="future">Future</option>
                </select>
              </label>
            )}
            <div className="priority-buttons">
              <button
                aria-label={`Move ${PREFERENCE_LABELS[rule.kind]} up`}
                disabled={index === 0}
                onClick={() => {
                  const previous = importPreferences.rules[index - 1];
                  if (previous !== undefined)
                    movePreference(rule.kind, previous.kind);
                }}
                type="button"
              >
                ↑
              </button>
              <button
                aria-label={`Move ${PREFERENCE_LABELS[rule.kind]} down`}
                disabled={index === importPreferences.rules.length - 1}
                onClick={() => {
                  const next = importPreferences.rules[index + 1];
                  if (next !== undefined) movePreference(rule.kind, next.kind);
                }}
                type="button"
              >
                ↓
              </button>
            </div>
          </div>
        ))}
      </div>
      <label>
        <input
          checked={importPreferences.preserveTags}
          onChange={(event) => {
            setImportPreferences((current) => ({
              ...current,
              preserveTags: event.target.checked,
            }));
          }}
          type="checkbox"
        />{" "}
        Preserve tags
      </label>
    </fieldset>
  );
}
