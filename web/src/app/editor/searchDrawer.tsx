import type { RefObject } from "react";

import { ClickableCardImage } from "../../modules/cards/ui/cardPresentation";
import type { ScryfallCard } from "../../modules/cards/contracts";
import type { CardZone } from "../../modules/decks/contracts";
import { MaterialIcon } from "../deckPrimitives";

function addZoneLabel(zone: CardZone): string {
  return zone === "commander"
    ? "Commander"
    : zone.charAt(0).toUpperCase() + zone.slice(1);
}

export function SearchDrawer({
  addResult,
  busy,
  results,
  searchDrawerRef,
  targetZone,
}: {
  addResult: (card: ScryfallCard) => void;
  busy: boolean;
  results: ScryfallCard[];
  searchDrawerRef: RefObject<HTMLDivElement | null>;
  targetZone: CardZone;
}) {
  return (
    <div
      aria-label="Search results"
      className="search-drawer"
      ref={searchDrawerRef}
      role="dialog"
    >
      {results.length === 0 ? (
        <p className="muted search-drawer-empty" role="status">
          No cards matched this search.
        </p>
      ) : (
        <div className="search-drawer-grid">
          {results.slice(0, 60).map((card) => (
            <article className="search-result" key={card.id}>
              <ClickableCardImage card={card} className="search-image" />
              <button
                aria-label={`Add ${card.name} to ${addZoneLabel(targetZone)}`}
                className="search-result-add"
                disabled={busy}
                onClick={() => {
                  addResult(card);
                }}
                type="button"
              >
                <MaterialIcon name="add" /> Add to {addZoneLabel(targetZone)}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
