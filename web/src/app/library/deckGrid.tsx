import { Link } from "react-router-dom";
import type { Dispatch, SetStateAction } from "react";

import { ClickableCardImage } from "../../modules/cards/ui/cardPresentation";
import type { Deck } from "../../modules/decks/contracts";

export function DeckGrid({
  decks,
  openDeckMenu,
  setOpenDeckMenu,
  deleteDeck,
}: {
  decks: Deck[];
  openDeckMenu: string | null;
  setOpenDeckMenu: Dispatch<SetStateAction<string | null>>;
  deleteDeck: (deck: Deck) => Promise<void>;
}) {
  return (
    <section className="deck-grid">
      {decks.map((deck) => (
        <article className="deck-card" key={deck.id}>
          <button
            aria-controls={`deck-menu-${deck.id}`}
            aria-expanded={openDeckMenu === deck.id}
            aria-haspopup="menu"
            aria-label={`Actions for ${deck.title}`}
            className="kebab-button"
            onClick={() => {
              setOpenDeckMenu((current) =>
                current === deck.id ? null : deck.id,
              );
            }}
          >
            •••
          </button>
          {openDeckMenu === deck.id && (
            <div className="deck-menu" id={`deck-menu-${deck.id}`} role="menu">
              <button
                autoFocus
                className="danger"
                role="menuitem"
                onClick={() => void deleteDeck(deck)}
              >
                Delete deck
              </button>
            </div>
          )}
          <div className="deck-cover">
            {deck.cardsets.slice(0, 3).map((card) => (
              <ClickableCardImage
                card={card}
                className="cover-image"
                key={card.id}
              />
            ))}
          </div>
          <Link className="deck-card-link" to={`/decks/${deck.id}`}>
            <h2>{deck.title}</h2>
            <p>
              {deck.format} ·{" "}
              {deck.cardsets.reduce((total, card) => total + card.quantity, 0)}{" "}
              cards
            </p>
            <small>Updated {new Date(deck.updated_at).toLocaleString()}</small>
          </Link>
        </article>
      ))}
    </section>
  );
}
