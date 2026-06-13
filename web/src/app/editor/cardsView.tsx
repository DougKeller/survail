import type React from "react";

import {
  MaterialIcon,
  titleize,
  VisualCardGroups,
  zoneLabel,
  zonesFor,
} from "../deckPrimitives";
import { groupedCards } from "../deck/grouping";
import type {
  DeckDisplayPreferences,
  GroupBy,
  SortBy,
} from "../deck/constants";
import type {
  CardSet,
  Deck,
  PriceProvider,
} from "../../modules/decks/contracts";
import type { CardRoleEvaluation } from "../../modules/decks/evaluations/contracts";

export function DeckCardsView({
  applyQuantityChange,
  busy,
  deck,
  displayPreferences,
  markCommander,
  openPrinting,
  openSearch,
  priceProvider,
  scores,
  searchForm,
  setDisplayPreferences,
  setQuery,
}: {
  applyQuantityChange: (card: CardSet, quantityDelta: number) => void;
  busy: boolean;
  deck: Deck;
  displayPreferences: DeckDisplayPreferences;
  markCommander: (card: CardSet) => void;
  openPrinting: (card: CardSet) => void;
  openSearch: (event: React.SyntheticEvent<HTMLFormElement>) => Promise<void>;
  priceProvider: PriceProvider;
  scores: ReadonlyMap<string, CardRoleEvaluation>;
  searchForm: string;
  setDisplayPreferences: React.Dispatch<
    React.SetStateAction<DeckDisplayPreferences>
  >;
  setQuery: (value: string) => void;
}) {
  const { groupBy, sortBy, view } = displayPreferences;

  return (
    <>
      <div aria-label="Card display controls" className="deck-toolbar">
        <form
          className="card-search"
          onSubmit={(event) => void openSearch(event)}
        >
          <input
            aria-label="Card search"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder="Search cards"
            value={searchForm}
          />
          <button aria-label="Search" className="icon-action" title="Search">
            <MaterialIcon name="search" />
          </button>
        </form>
        <div aria-label="Card view" className="view-selector">
          {(["stacks", "grid", "text"] as const).map((deckView) => (
            <button
              aria-pressed={view === deckView}
              className={view === deckView ? "active" : ""}
              key={deckView}
              onClick={() => {
                setDisplayPreferences((current) => ({
                  ...current,
                  view: deckView,
                }));
              }}
            >
              {titleize(deckView)}
            </button>
          ))}
        </div>
        <details className="organize-menu">
          <summary className="secondary-button">
            <MaterialIcon name="tune" /> Organize
          </summary>
          <div className="subheader-menu">
            <label>
              Group by
              <select
                onChange={(event) => {
                  setDisplayPreferences((current) => ({
                    ...current,
                    groupBy: event.target.value as GroupBy,
                  }));
                }}
                value={groupBy}
              >
                <option value="type">Type</option>
                <option value="color">Color</option>
                <option value="mana-value">Mana Value</option>
                <option value="role">Role</option>
              </select>
            </label>
            <label>
              Sort by
              <select
                aria-label="Card sort"
                onChange={(event) => {
                  setDisplayPreferences((current) => ({
                    ...current,
                    sortBy: event.target.value as SortBy,
                  }));
                }}
                value={sortBy}
              >
                <option value="alphabetical">Alphabetical</option>
                <option value="mana-value">Mana Value</option>
                <option value="price">Price</option>
                <option value="score">Role Score</option>
              </select>
            </label>
          </div>
        </details>
      </div>
      {zonesFor(deck.format).map((zone) => {
        const cards = deck.cardsets.filter((card) => card.zone === zone);
        const groups = groupedCards(
          cards,
          groupBy,
          sortBy,
          priceProvider,
          scores,
        );
        if (cards.length === 0 && zone !== "mainboard") return null;
        return (
          <section className="zone" key={zone}>
            <h2>
              {zoneLabel(zone)}{" "}
              <small>
                {cards.reduce((total, card) => total + card.quantity, 0)}
              </small>
            </h2>
            {view === "text" ? (
              <div className="text-groups">
                {groups.map((group) => (
                  <section key={group.label}>
                    <h3>
                      {group.label} <small>{group.quantity}</small>
                    </h3>
                    <div className="card-grid">
                      {group.cards.map((card) => (
                        <article className="card-row" key={card.id}>
                          <strong>{card.card_name}</strong>
                          <div className="inline-quantity">
                            <button
                              aria-label={`Remove one ${card.card_name}`}
                              disabled={busy}
                              onClick={() => {
                                applyQuantityChange(card, -1);
                              }}
                              title="Remove one"
                            >
                              <MaterialIcon name="remove" />
                            </button>
                            <span>{card.quantity}</span>
                            <button
                              aria-label={`Add one ${card.card_name}`}
                              disabled={busy}
                              onClick={() => {
                                applyQuantityChange(card, 1);
                              }}
                              title="Add one"
                            >
                              <MaterialIcon name="add" />
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <VisualCardGroups
                addCard={(card) => {
                  applyQuantityChange(card, 1);
                }}
                busy={busy}
                cards={cards}
                format={deck.format}
                groupBy={groupBy}
                markCommander={markCommander}
                openPrinting={openPrinting}
                removeCard={(card) => {
                  applyQuantityChange(card, -1);
                }}
                scores={scores}
                sortBy={sortBy}
                view={view}
              />
            )}
          </section>
        );
      })}
    </>
  );
}
