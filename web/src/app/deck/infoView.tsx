import type { Deck, Validation } from "../../modules/decks/contracts";

import {
  GeneratedDescription,
  MaterialIcon,
  RichTextBlock,
  titleize,
} from "./text";

export function DeckInfoView({
  deck,
  edit,
  refreshOverview,
  busy,
  validation,
}: {
  deck: Deck;
  edit: () => void;
  refreshOverview: () => void;
  busy: boolean;
  validation: Validation | null;
}) {
  const hasGeneratedDescription =
    deck.generated_description !== null &&
    (typeof deck.generated_description !== "string" ||
      deck.generated_description.trim() !== "");
  const generatedDescription = hasGeneratedDescription
    ? deck.generated_description
    : null;

  return (
    <section aria-labelledby="deck-info-title" className="info-view">
      <div className="view-heading">
        <div>
          <span className="eyebrow">Deck information</span>
          <h2 id="deck-info-title">Purpose and overview</h2>
        </div>
        <button className="secondary-button" onClick={edit}>
          <MaterialIcon name="edit" /> Edit deck info
        </button>
      </div>
      <div className="info-grid">
        <article className="info-card prominent">
          <span className="eyebrow">Goal / North Star</span>
          {deck.goal === "" ? (
            <p className="muted">
              Define what this deck should consistently accomplish.
            </p>
          ) : (
            <RichTextBlock cards={deck.cardsets} text={deck.goal} />
          )}
        </article>
        <article className="info-card">
          <span className="eyebrow">About this deck</span>
          {deck.description === "" ? (
            <p className="muted">No user description yet.</p>
          ) : (
            <RichTextBlock cards={deck.cardsets} text={deck.description} />
          )}
        </article>
        <article className="info-card ai-overview">
          <div className="info-card-heading">
            <span className="eyebrow">AI-generated overview</span>
            <button
              className="text-button"
              disabled={busy}
              onClick={refreshOverview}
            >
              <MaterialIcon name="refresh" /> Refresh overview
            </button>
          </div>
          {generatedDescription === null ? (
            <p className="muted" role="status">
              {busy
                ? "Generating an overview…"
                : "An overview will be generated when this view opens."}
            </p>
          ) : (
            <GeneratedDescription
              cards={deck.cardsets}
              description={generatedDescription}
            />
          )}
        </article>
        <article className="info-card details-card">
          <span className="eyebrow">Deck details</span>
          <dl>
            <div>
              <dt>Format</dt>
              <dd>{titleize(deck.format)}</dd>
            </div>
            <div>
              <dt>Cards</dt>
              <dd>
                {validation?.card_count ??
                  deck.cardsets.reduce(
                    (total, card) => total + card.quantity,
                    0,
                  )}
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                {validation?.valid === true ? "Valid" : "Needs attention"}
              </dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{deck.revision}</dd>
            </div>
          </dl>
        </article>
      </div>
    </section>
  );
}
