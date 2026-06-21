import { useEffect, useState, type RefObject } from "react";

import type { CardSet } from "../../modules/decks/contracts";
import { MaterialIcon } from "../deckPrimitives";

export function CardNoteModal({
  busy,
  cardset,
  close,
  dialogRef,
  save,
}: {
  busy: boolean;
  cardset: CardSet;
  close: () => void;
  dialogRef: RefObject<HTMLFormElement | null>;
  save: (note: string) => void;
}) {
  const [note, setNote] = useState(cardset.note);

  useEffect(() => {
    setNote(cardset.note);
  }, [cardset.id, cardset.note]);

  return (
    <div className="modal-backdrop" onClick={close}>
      <form
        aria-describedby="card-note-description"
        aria-labelledby="card-note-title"
        aria-modal="true"
        className="add-deck-modal guidance-edit-modal stack"
        onClick={(event) => {
          event.stopPropagation();
        }}
        onSubmit={(event) => {
          event.preventDefault();
          save(note);
        }}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="page-heading">
          <div>
            <h2 id="card-note-title">Card note</h2>
            <p className="muted" id="card-note-description">
              This note is included when AI evaluates or reasons about this card
              in the context of the deck.
            </p>
          </div>
          <button
            aria-label="Close card note editor"
            className="icon-action"
            onClick={close}
            type="button"
          >
            <MaterialIcon name="close" />
          </button>
        </div>
        <label>
          {cardset.card_name}
          <textarea
            autoFocus
            maxLength={2000}
            onChange={(event) => {
              setNote(event.target.value);
            }}
            placeholder="Add context for AI evaluation, combo lines, exclusions, or role expectations."
            value={note}
          />
        </label>
        <div className="button-row bulk-edit-actions">
          <button
            className="secondary-button"
            disabled={busy}
            onClick={close}
            type="button"
          >
            Cancel
          </button>
          <button disabled={busy} type="submit">
            Save note
          </button>
        </div>
      </form>
    </div>
  );
}
