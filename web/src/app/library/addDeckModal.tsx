import type { ChangeEvent, RefObject } from "react";

import type { DeckFormat } from "../../modules/decks/contracts";
import { DECK_FORMATS, MaterialIcon } from "../deckPrimitives";

export function AddDeckModal({
  busy,
  close,
  dialogRef,
  format,
  handleFormatChange,
  handleSubmit,
  title,
  setTitle,
}: {
  busy: boolean;
  close: () => void;
  dialogRef: RefObject<HTMLFormElement | null>;
  format: DeckFormat;
  handleFormatChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  handleSubmit: () => Promise<void>;
  title: string;
  setTitle: (value: string) => void;
}) {
  return (
    <div className="modal-backdrop" onClick={close}>
      <form
        aria-describedby="add-deck-description"
        aria-labelledby="add-deck-title"
        aria-modal="true"
        className="add-deck-modal stack"
        onClick={(event) => {
          event.stopPropagation();
        }}
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="page-heading">
          <h2 id="add-deck-title">Add Deck</h2>
          <button
            aria-label="Close add deck dialog"
            className="icon-action"
            onClick={close}
            type="button"
          >
            <MaterialIcon name="close" />
          </button>
        </div>
        <p className="muted" id="add-deck-description">
          Choose a title and format to create an empty deck.
        </p>
        <label>
          Title
          <input
            autoFocus
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
        <button disabled={busy || title.trim() === ""}>Create deck</button>
      </form>
    </div>
  );
}
