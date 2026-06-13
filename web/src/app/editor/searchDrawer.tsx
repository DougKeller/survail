import type { RefObject } from "react";

import { ClickableCardImage } from "../../modules/cards/ui/cardPresentation";
import type { ScryfallCard } from "../../modules/cards/contracts";
import type { CardFinish } from "../../modules/decks/contracts";
import {
  isCardFinish,
  MaterialIcon,
  preferredFinish,
  Price,
} from "../deckPrimitives";

export function SearchDrawer({
  addResult,
  busy,
  close,
  results,
  searchDrawerRef,
}: {
  addResult: (card: ScryfallCard, finish: CardFinish) => void;
  busy: boolean;
  close: () => void;
  results: ScryfallCard[];
  searchDrawerRef: RefObject<HTMLElement | null>;
}) {
  return (
    <aside
      aria-labelledby="search-results-title"
      aria-modal="false"
      className="search-drawer"
      ref={searchDrawerRef}
      role="dialog"
      tabIndex={-1}
    >
      <div className="page-heading">
        <div>
          <h2 id="search-results-title">Search results</h2>
          <p>{results.length} cards found</p>
        </div>
        <button
          aria-label="Close search results"
          className="icon-action"
          onClick={close}
        >
          <MaterialIcon name="close" />
        </button>
      </div>
      {results.length === 0 && (
        <p className="muted" role="status">
          No cards matched this search.
        </p>
      )}
      <div className="search-drawer-grid">
        {results.slice(0, 60).map((card) => (
          <article className="search-result" key={card.id}>
            <ClickableCardImage card={card} className="search-image" />
            <div>
              <strong>{card.name}</strong>
              <small>{card.set.toUpperCase()}</small>
              <Price card={card} finish={preferredFinish(card, "nonfoil")} />
              <div className="button-row">
                {card.finishes.filter(isCardFinish).map((finish) => (
                  <button
                    disabled={busy}
                    key={finish}
                    onClick={() => {
                      addResult(card, finish);
                    }}
                  >
                    <MaterialIcon name="add" /> {finish}
                  </button>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}
