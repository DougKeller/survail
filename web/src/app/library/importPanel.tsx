import type {
  ChangeEvent,
  Dispatch,
  SetStateAction,
  SyntheticEvent,
} from "react";

import type { DeckFormat } from "../../modules/decks/contracts";
import type {
  ImportPreferenceKind,
  ImportPreferenceRule,
  ImportPreferences,
  MoxfieldImportPreview,
} from "../../modules/imports/contracts";
import { DECK_FORMATS } from "../deckPrimitives";
import { ImportPreferencesEditor } from "./importPreferencesEditor";
import { ImportPreviewPanel } from "./importPreviewPanel";

export function ImportPanel({
  busy,
  createImportedDeck,
  decklist,
  draggedPreference,
  format,
  handleFormatChange,
  handlePreview,
  importPreferences,
  movePreference,
  preview,
  setDecklist,
  setDraggedPreference,
  setImportPreferences,
  title,
  setTitle,
  updateCheapestBuffer,
  updateFrame,
}: {
  busy: boolean;
  createImportedDeck: () => Promise<void>;
  decklist: string;
  draggedPreference: ImportPreferenceKind | null;
  format: DeckFormat;
  handleFormatChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  handlePreview: (event: SyntheticEvent<HTMLFormElement>) => Promise<void>;
  importPreferences: ImportPreferences;
  movePreference: (
    source: ImportPreferenceKind,
    target: ImportPreferenceKind,
  ) => void;
  preview: MoxfieldImportPreview | null;
  setDecklist: (value: string) => void;
  setDraggedPreference: (value: ImportPreferenceKind | null) => void;
  setImportPreferences: Dispatch<SetStateAction<ImportPreferences>>;
  setTitle: (value: string) => void;
  title: string;
  updateCheapestBuffer: (bufferPercent: number) => void;
  updateFrame: (
    frame: Extract<ImportPreferenceRule, { kind: "frame" }>["frame"],
  ) => void;
}) {
  return (
    <section className="import-panel">
      <div className="import-settings">
        <h2>Import Moxfield decklist</h2>
        <p className="muted">
          Paste an exported list. Imported cards begin in the Mainboard; move
          commanders and sideboard cards after creation.
        </p>
        <form
          className="import-form"
          onSubmit={(event) => void handlePreview(event)}
        >
          <div className="import-settings-scroll stack">
            <label>
              Deck title
              <input
                maxLength={120}
                onChange={(event) => {
                  setTitle(event.target.value);
                }}
                required
                value={title}
              />
            </label>
            <label>
              Format
              <select onChange={handleFormatChange} required value={format}>
                {DECK_FORMATS.map((deckFormat) => (
                  <option key={deckFormat}>{deckFormat}</option>
                ))}
              </select>
            </label>
            <label>
              Decklist
              <textarea
                onChange={(event) => {
                  setDecklist(event.target.value);
                }}
                placeholder={"1 Arcane Signet (CMM) 379\n1 Sol Ring (CMM) 396"}
                required
                value={decklist}
              />
            </label>
            <ImportPreferencesEditor
              draggedPreference={draggedPreference}
              importPreferences={importPreferences}
              movePreference={movePreference}
              setDraggedPreference={setDraggedPreference}
              setImportPreferences={setImportPreferences}
              updateCheapestBuffer={updateCheapestBuffer}
              updateFrame={updateFrame}
            />
          </div>
          <footer className="import-actions">
            <button disabled={busy}>
              {busy ? "Resolving…" : "Preview import"}
            </button>
          </footer>
        </form>
      </div>
      <ImportPreviewPanel
        busy={busy}
        createImportedDeck={createImportedDeck}
        preview={preview}
        title={title}
      />
    </section>
  );
}
