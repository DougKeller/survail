import { ClickableCardImage } from "../../modules/cards/ui/cardPresentation";
import type { MoxfieldImportPreview } from "../../modules/imports/contracts";
import { Price, titleize, zoneLabel } from "../deckPrimitives";

export function ImportPreviewPanel({
  busy,
  createImportedDeck,
  preview,
  title,
}: {
  busy: boolean;
  createImportedDeck: () => Promise<void>;
  preview: MoxfieldImportPreview | null;
  title: string;
}) {
  return (
    <div className="import-preview">
      <header className="import-preview-header">
        <h2>Resolved preview</h2>
        {preview !== null && (
          <p>
            {preview.cardsets.reduce((total, card) => total + card.quantity, 0)}{" "}
            cards · {preview.cardsets.length} unique cards
          </p>
        )}
      </header>
      <div className="import-preview-scroll">
        {preview === null && (
          <p className="muted">
            Preview the import to review selected printings.
          </p>
        )}
        {preview !== null && preview.errors.length > 0 && (
          <div className="notice error" role="alert">
            <strong>{preview.errors.length} lines need attention</strong>
            {preview.errors.map((issue) => (
              <p key={`${String(issue.line_number)}-${issue.code}`}>
                <strong>
                  Line {issue.line_number}: {titleize(issue.code)}
                </strong>
                <br />
                {issue.message}
                <br />
                <small>{issue.raw_line}</small>
              </p>
            ))}
          </div>
        )}
        {preview?.used_ai_fallback === true && (
          <p className="notice" role="status">
            AI-assisted import extracted cards from the supplied text. Review
            the resolved cards before creating the deck.
          </p>
        )}
        {preview !== null && (
          <div className="preview-grid">
            {preview.cardsets.map((card) => (
              <article
                className="preview-card"
                key={`${card.printing_id}-${card.finish}-${card.zone}`}
              >
                <ClickableCardImage
                  card={card.scryfall}
                  className="preview-image"
                />
                <strong>
                  {card.quantity}× {card.card_name}
                </strong>
                <small>
                  {zoneLabel(card.zone)} · {card.set_code.toUpperCase()}
                </small>
                <Price card={card.scryfall} finish={card.finish} />
                {card.tags.length > 0 && <small>{card.tags.join(" · ")}</small>}
              </article>
            ))}
          </div>
        )}
      </div>
      <footer className="import-actions">
        {preview === null ? (
          <p className="muted">
            Preview the decklist before creating the deck.
          </p>
        ) : (
          <button
            disabled={busy || preview.errors.length > 0 || title.trim() === ""}
            onClick={() => void createImportedDeck()}
          >
            Create imported deck
          </button>
        )}
      </footer>
    </div>
  );
}
