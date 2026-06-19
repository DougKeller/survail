import type {
  ChangeEvent,
  Dispatch,
  SetStateAction,
  SyntheticEvent,
} from "react";

import type { DeckFormat } from "../../modules/decks/contracts";
import type {
  ImportPreferences,
  MoxfieldImportPreview,
} from "../../modules/imports/contracts";
import { DECK_FORMATS } from "../deckPrimitives";
import { ImportPreviewPanel } from "./importPreviewPanel";

export function ImportPanel({
  busy,
  createImportedDeck,
  decklist,
  format,
  handleFormatChange,
  handlePreview,
  importPreferences,
  preview,
  setDecklist,
  setImportPreferences,
  title,
  setTitle,
}: {
  busy: boolean;
  createImportedDeck: () => Promise<void>;
  decklist: string;
  format: DeckFormat;
  handleFormatChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  handlePreview: (event: SyntheticEvent<HTMLFormElement>) => Promise<void>;
  importPreferences: ImportPreferences;
  preview: MoxfieldImportPreview | null;
  setDecklist: (value: string) => void;
  setImportPreferences: Dispatch<SetStateAction<ImportPreferences>>;
  setTitle: (value: string) => void;
  title: string;
}) {
  return (
    <section className="import-panel">
      <div className="import-settings">
        <h2>Import Moxfield decklist</h2>
        <p className="muted">
          Paste an exported list. Imported cards begin in the Mainboard; move
          commanders and sideboard cards after creation. Imports resolve to the
          original non-foil printing when available.
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
            <label>
              <input
                checked={importPreferences.preserveTags}
                onChange={(event) => {
                  setImportPreferences({
                    preserveTags: event.target.checked,
                  });
                }}
                type="checkbox"
              />{" "}
              Preserve tags
            </label>
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
