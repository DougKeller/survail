import type { RefObject, SyntheticEvent } from "react";

import type { Deck } from "../../modules/decks/contracts";
import { MaterialIcon } from "../deckPrimitives";

export function EditDeckModal({
  busy,
  close,
  deck,
  description,
  dialogRef,
  goal,
  handleSubmit,
  setDescription,
  setGoal,
  setTitle,
  title,
}: {
  busy: boolean;
  close: () => void;
  deck: Deck;
  description: string;
  dialogRef: RefObject<HTMLFormElement | null>;
  goal: string;
  handleSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  setDescription: (value: string) => void;
  setGoal: (value: string) => void;
  setTitle: (value: string) => void;
  title: string;
}) {
  return (
    <div className="modal-backdrop" onClick={close}>
      <form
        aria-describedby="edit-deck-description"
        aria-labelledby="edit-deck-title"
        aria-modal="true"
        className="add-deck-modal guidance-edit-modal stack"
        onClick={(event) => {
          event.stopPropagation();
        }}
        onSubmit={handleSubmit}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="page-heading">
          <h2 id="edit-deck-title">Edit deck</h2>
          <button
            aria-label="Close"
            className="icon-action"
            onClick={close}
            type="button"
          >
            <MaterialIcon name="close" />
          </button>
        </div>
        <p className="muted" id="edit-deck-description">
          Define the deck&apos;s North Star. Card roles and scores are evaluated
          manually.
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
          Description
          <textarea
            onChange={(event) => {
              setDescription(event.target.value);
            }}
            value={description}
          />
        </label>
        <label>
          Goal / North Star
          <textarea
            onChange={(event) => {
              setGoal(event.target.value);
            }}
            placeholder="What should this deck consistently accomplish?"
            value={goal}
          />
        </label>
        <label>
          Format
          <input readOnly value={deck.format} />
        </label>
        <button disabled={busy}>Save changes</button>
      </form>
    </div>
  );
}
