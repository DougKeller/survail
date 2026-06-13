import type { RefObject } from "react";

import { MaterialIcon } from "../deckPrimitives";

export function BulkEditModal({
  applyBulkEdit,
  bulkDecklist,
  bulkEditDialogRef,
  bulkEditErrors,
  busy,
  close,
  setBulkDecklist,
}: {
  applyBulkEdit: () => Promise<void>;
  bulkDecklist: string;
  bulkEditDialogRef: RefObject<HTMLElement | null>;
  bulkEditErrors: string[];
  busy: boolean;
  close: () => void;
  setBulkDecklist: (value: string) => void;
}) {
  return (
    <div className="modal-backdrop" onClick={close}>
      <section
        aria-describedby="bulk-edit-description"
        aria-labelledby="bulk-edit-title"
        aria-modal="true"
        className="bulk-edit-modal"
        onClick={(event) => {
          event.stopPropagation();
        }}
        ref={bulkEditDialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="page-heading">
          <div>
            <h2 id="bulk-edit-title">Bulk edit decklist</h2>
            <p className="muted" id="bulk-edit-description">
              Edit quantities, cards, or sections as free text. Changes are
              applied together.
            </p>
          </div>
          <button
            aria-label="Close bulk decklist editor"
            className="icon-action"
            onClick={close}
          >
            <MaterialIcon name="close" />
          </button>
        </div>
        {bulkEditErrors.length > 0 && (
          <div className="notice error" role="alert">
            {bulkEditErrors.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        )}
        <label className="bulk-edit-field">
          Decklist
          <textarea
            aria-label="Decklist"
            onChange={(event) => {
              setBulkDecklist(event.target.value);
            }}
            spellCheck={false}
            value={bulkDecklist}
          />
        </label>
        <div className="button-row bulk-edit-actions">
          <button className="secondary-button" disabled={busy} onClick={close}>
            Cancel
          </button>
          <button
            disabled={busy || bulkDecklist.trim() === ""}
            onClick={() => void applyBulkEdit()}
          >
            {busy ? "Applying changes…" : "Apply changes"}
          </button>
        </div>
      </section>
    </div>
  );
}
