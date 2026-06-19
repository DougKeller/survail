/* eslint-disable max-lines */
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";

import type {
  CardSet,
  Deck,
  PriceProvider,
} from "../../modules/decks/contracts";
import type { CardRoleEvaluation } from "../../modules/decks/evaluations/contracts";
import { SearchDrawer } from "./searchDrawer";
import type {
  DeckDisplayPreferences,
  GroupBy,
  SortBy,
} from "../deck/constants";
import { groupedCards } from "../deck/grouping";
import {
  CoreCardToggle,
  MaterialIcon,
  titleize,
  VisualCardGroups,
  zoneLabel,
  zonesFor,
} from "../deckPrimitives";
import { InlineCardText } from "../../modules/cards/ui/cardPresentation";

export function DeckCardsView({
  addSearchResult,
  applyQuantityChange,
  busy,
  deck,
  displayPreferences,
  markCommander,
  openSearch,
  priceProvider,
  results,
  scores,
  searchForm,
  searchInputRef,
  setShowSearchResults,
  setDisplayPreferences,
  setQuery,
  showSearchResults,
  toggleCoreCard,
}: {
  addSearchResult: (card: CardSet["scryfall"]) => void;
  applyQuantityChange: (card: CardSet, quantityDelta: number) => void;
  busy: boolean;
  deck: Deck;
  displayPreferences: DeckDisplayPreferences;
  markCommander: (card: CardSet) => void;
  openSearch: () => Promise<void>;
  priceProvider: PriceProvider;
  results: CardSet["scryfall"][];
  scores: ReadonlyMap<string, CardRoleEvaluation>;
  searchForm: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  setShowSearchResults: (value: boolean) => void;
  setDisplayPreferences: Dispatch<SetStateAction<DeckDisplayPreferences>>;
  setQuery: (value: string) => void;
  showSearchResults: boolean;
  toggleCoreCard: (card: CardSet) => void;
}) {
  const { groupBy, sortBy, view } = displayPreferences;
  const [organizeOpen, setOrganizeOpen] = useState(false);
  const organizeRef = useRef<HTMLDetailsElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!organizeOpen) return;
    function handlePointerDown(event: PointerEvent): void {
      if (
        organizeRef.current !== null &&
        event.target instanceof Node &&
        !organizeRef.current.contains(event.target)
      ) {
        setOrganizeOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [organizeOpen]);

  useEffect(() => {
    if (!showSearchResults) return;
    function handlePointerDown(event: PointerEvent): void {
      if (
        searchContainerRef.current !== null &&
        event.target instanceof Node &&
        !searchContainerRef.current.contains(event.target)
      ) {
        setShowSearchResults(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") setShowSearchResults(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [setShowSearchResults, showSearchResults]);

  return (
    <>
      <div aria-label="Card display controls" className="deck-toolbar">
        <div className="card-search-wrap" ref={searchContainerRef}>
          <form
            className="card-search"
            onSubmit={(event) => {
              event.preventDefault();
              void openSearch();
            }}
          >
            <input
              aria-label="Card search"
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder="Search cards"
              ref={searchInputRef}
              value={searchForm}
            />
            <button
              aria-label="Search"
              className="icon-action"
              title="Search"
              type="submit"
            >
              <MaterialIcon name="search" />
            </button>
          </form>
          {showSearchResults && (
            <SearchDrawer
              addResult={addSearchResult}
              busy={busy}
              results={results}
              searchDrawerRef={searchContainerRef}
            />
          )}
        </div>
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
        <details
          className="organize-menu"
          onToggle={(event) => {
            setOrganizeOpen(event.currentTarget.open);
          }}
          open={organizeOpen}
          ref={organizeRef}
        >
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
                <option value="starred">Starred</option>
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
                          <strong className="text-card-name">
                            <InlineCardText
                              cards={[card]}
                              text={`[[${card.card_name}]]`}
                            />
                          </strong>
                          <div className="inline-quantity">
                            <button
                              aria-label={`Remove one ${card.card_name}`}
                              disabled={busy}
                              onClick={() => {
                                applyQuantityChange(card, -1);
                              }}
                              title="Remove one"
                              type="button"
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
                              type="button"
                            >
                              <MaterialIcon name="add" />
                            </button>
                            <CoreCardToggle
                              active={card.core}
                              disabled={busy}
                              label={card.card_name}
                              onClick={() => {
                                toggleCoreCard(card);
                              }}
                            />
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
                removeCard={(card) => {
                  applyQuantityChange(card, -1);
                }}
                scores={scores}
                sortBy={sortBy}
                toggleCoreCard={toggleCoreCard}
                view={view}
              />
            )}
          </section>
        );
      })}
    </>
  );
}
