import type { RefObject } from "react";

import { InlineCardText } from "../../modules/cards/ui/cardPresentation";
import type { DeckOperation } from "../../modules/decks/contracts";
import { MaterialIcon, zoneLabel } from "../deckPrimitives";

export function HistoryModal({
  busy,
  close,
  dialogRef,
  handleRevert,
  operations,
}: {
  busy: boolean;
  close: () => void;
  dialogRef: RefObject<HTMLElement | null>;
  handleRevert: (operation: DeckOperation) => Promise<void>;
  operations: DeckOperation[];
}) {
  return (
    <div className="modal-backdrop" onClick={close}>
      <section
        aria-describedby="history-description"
        aria-labelledby="history-title"
        aria-modal="true"
        className="history-modal"
        onClick={(event) => {
          event.stopPropagation();
        }}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="page-heading">
          <div>
            <h2 id="history-title">Deck history</h2>
            <p id="history-description">
              {operations.length} recorded{" "}
              {operations.length === 1 ? "change" : "changes"}
            </p>
          </div>
          <button
            aria-label="Close deck history"
            className="icon-action"
            onClick={close}
          >
            <MaterialIcon name="close" />
          </button>
        </div>
        <div className="history-list">
          {operations.length === 0 && (
            <p className="muted">No changes have been recorded.</p>
          )}
          {operations.map((operation) => (
            <details className="history-entry" key={operation.id}>
              <summary>
                <span>
                  <strong>
                    <InlineCardText text={operation.reason ?? "Deck update"} />
                  </strong>
                  <small>
                    Version {operation.revision_after} ·{" "}
                    {new Date(operation.created_at).toLocaleString()} ·{" "}
                    {operation.changes.length}{" "}
                    {operation.changes.length === 1 ? "change" : "changes"}
                  </small>
                </span>
                <button
                  disabled={busy}
                  onClick={(event) => {
                    event.preventDefault();
                    void handleRevert(operation);
                  }}
                >
                  Undo
                </button>
              </summary>
              <div>
                {operation.changes.map((change, index) => (
                  <small key={`${change.printing_id}-${String(index)}`}>
                    {change.quantity_delta > 0 ? "+" : ""}
                    {change.quantity_delta}{" "}
                    <InlineCardText text={`[[${change.card_name}]]`} /> ·{" "}
                    {zoneLabel(change.zone)}
                  </small>
                ))}
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
