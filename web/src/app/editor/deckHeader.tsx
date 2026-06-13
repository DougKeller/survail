import { InlineCardText } from "../../modules/cards/ui/cardPresentation";
import type { Validation } from "../../modules/decks/contracts";
import {
  groupedValidationErrors,
  MaterialIcon,
  titleize,
} from "../deckPrimitives";

export function DeckHeader({
  deckTitle,
  deckFormat,
  editorView,
  onDelete,
  onEdit,
  onOpenBulkEdit,
  onOpenHistory,
  onSelectView,
  showAgent,
  toggleAgent,
  validation,
}: {
  deckTitle: string;
  deckFormat: string;
  editorView: "cards" | "scores" | "info";
  onDelete: () => Promise<void>;
  onEdit: () => void;
  onOpenBulkEdit: () => void;
  onOpenHistory: () => void;
  onSelectView: (view: "cards" | "scores" | "info") => void;
  showAgent: boolean;
  toggleAgent: () => void;
  validation: Validation | null;
}) {
  return (
    <>
      <div aria-label="Deck controls" className="deck-app-bar">
        <div className="deck-readonly-details">
          <strong>{deckTitle}</strong>
          <span className="pill">{titleize(deckFormat)}</span>
        </div>
        <details className="validation-menu">
          <summary
            aria-label={`${validation?.valid === true ? "Valid deck" : "Deck needs attention"}, ${String(validation?.card_count ?? 0)} cards`}
            className={
              validation?.valid === true
                ? "validation-summary valid"
                : "validation-summary invalid"
            }
          >
            <MaterialIcon
              name={validation?.valid === true ? "check" : "error"}
            />
          </summary>
          <div className="subheader-menu">
            {validation?.errors.length === 0 && <p>No validation errors.</p>}
            {groupedValidationErrors(validation).map((group) => (
              <details className="validation-error-group" key={group.errorId}>
                <summary>
                  <strong>{titleize(group.errorId)}</strong>
                  <span>{group.errors.length}</span>
                </summary>
                <div>
                  {group.errors.map((validationError, index) => (
                    <p key={`${validationError.error_id}-${String(index)}`}>
                      <InlineCardText text={validationError.message} />
                    </p>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </details>
        <button className="secondary-button labeled-action" onClick={onEdit}>
          <MaterialIcon name="edit" /> Edit
        </button>
        <button
          aria-pressed={showAgent}
          className={`secondary-button labeled-action ${showAgent ? "selected" : ""}`}
          onClick={toggleAgent}
        >
          <MaterialIcon name="forum" /> Advisor
        </button>
        <details className="overflow-menu">
          <summary aria-label="More deck actions" className="icon-action">
            <MaterialIcon name="more_vert" />
          </summary>
          <div className="subheader-menu action-menu">
            <button onClick={onOpenBulkEdit}>
              <MaterialIcon name="edit_note" /> Bulk edit decklist
            </button>
            <button onClick={onOpenHistory}>
              <MaterialIcon name="history" /> History
            </button>
            <button className="danger" onClick={() => void onDelete()}>
              <MaterialIcon name="delete" /> Delete deck
            </button>
          </div>
        </details>
      </div>
      <nav aria-label="Deck views" className="editor-tabs">
        {(["cards", "scores", "info"] as const).map((view) => (
          <button
            aria-current={editorView === view ? "page" : undefined}
            className={editorView === view ? "active" : ""}
            key={view}
            onClick={() => {
              onSelectView(view);
            }}
          >
            {titleize(view)}
          </button>
        ))}
      </nav>
    </>
  );
}
