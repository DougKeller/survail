/* eslint-disable max-lines */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";

import type {
  CardSet,
  CardZone,
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
  searchAddZonesFor,
  titleize,
  VisualCardGroups,
  zoneLabel,
} from "../deckPrimitives";
import { zonesFor } from "../deck/constants";
import { moveZoneOptionsFor } from "../deck/cardZones";
import { InlineCardText } from "../../modules/cards/ui/cardPresentation";

function searchAddZoneLabel(zone: CardZone): string {
  return zone === "commander"
    ? "Commander"
    : zone.charAt(0).toUpperCase() + zone.slice(1);
}

function TextCardRowActions({
  busy,
  card,
  applyQuantityChange,
  editCardNote,
  moveCardToZone,
  format,
  toggleCoreCard,
}: {
  busy: boolean;
  card: CardSet;
  applyQuantityChange: (card: CardSet, quantityDelta: number) => void;
  editCardNote: (card: CardSet) => void;
  moveCardToZone: (card: CardSet, zone: CardZone) => void;
  format: Deck["format"];
  toggleCoreCard: (card: CardSet) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const moveOptions = moveZoneOptionsFor(card, format);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent): void {
      if (
        containerRef.current !== null &&
        event.target instanceof Node &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (card.quantity <= 0) setOpen(false);
  }, [card.quantity]);

  return (
    <div
      className={`text-card-actions${open ? " open" : ""}`}
      ref={containerRef}
    >
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Open quick actions for ${card.card_name}`}
        className="text-card-caret"
        disabled={busy}
        onClick={() => {
          setOpen((current) => !current);
        }}
        title="Open quick actions"
        type="button"
      >
        <MaterialIcon name={open ? "expand_less" : "expand_more"} />
      </button>
      {open && (
        <div
          aria-label={`${card.card_name} quick actions`}
          className="text-card-popover"
          role="dialog"
        >
          <div className="text-card-popover-quantity">
            <button
              aria-label={`Remove one ${card.card_name}`}
              disabled={busy}
              onClick={() => {
                if (card.quantity <= 1) setOpen(false);
                applyQuantityChange(card, -1);
              }}
              title="Remove one"
              type="button"
            >
              <MaterialIcon name="remove" />
            </button>
            <span aria-live="polite">{card.quantity}</span>
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
          </div>
          <div className="text-card-popover-actions">
            <CoreCardToggle
              active={card.core}
              disabled={busy}
              label={card.card_name}
              onClick={() => {
                toggleCoreCard(card);
              }}
            />
            <button
              aria-label={`${card.note.trim() === "" ? "Add" : "Edit"} note for ${card.card_name}`}
              className="icon-action"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                editCardNote(card);
              }}
              title={card.note.trim() === "" ? "Add note" : "Edit note"}
              type="button"
            >
              <MaterialIcon name="edit_note" />
            </button>
          </div>
          {moveOptions.length > 0 && (
            <label className="text-card-popover-move">
              <span>Move to</span>
              <select
                aria-label={`Move ${card.card_name} to another zone`}
                defaultValue=""
                disabled={busy}
                onChange={(event) => {
                  const zone = event.target.value;
                  event.target.value = "";
                  if (zone === "") return;
                  setOpen(false);
                  moveCardToZone(card, zone as CardZone);
                }}
              >
                <option value="">Select zone</option>
                {moveOptions.map((zone) => (
                  <option key={zone} value={zone}>
                    {zoneLabel(zone)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
    </div>
  );
}

export function DeckCardsView({
  addSearchResult,
  applyQuantityChange,
  busy,
  deck,
  displayPreferences,
  markCommander,
  moveCardToZone,
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
  editCardNote,
}: {
  addSearchResult: (card: CardSet["scryfall"], zone: CardZone) => void;
  applyQuantityChange: (card: CardSet, quantityDelta: number) => void;
  busy: boolean;
  deck: Deck;
  displayPreferences: DeckDisplayPreferences;
  markCommander: (card: CardSet) => void;
  moveCardToZone: (card: CardSet, zone: CardZone) => void;
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
  editCardNote: (card: CardSet) => void;
}) {
  const { groupBy, sortBy, view } = displayPreferences;
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const addZoneOptions = useMemo(
    () => searchAddZonesFor(deck.format),
    [deck.format],
  );
  const [searchAddZone, setSearchAddZone] = useState<CardZone>("mainboard");

  useEffect(() => {
    if (addZoneOptions.includes(searchAddZone)) return;
    setSearchAddZone("mainboard");
  }, [addZoneOptions, searchAddZone]);

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
            <div className="card-search-row">
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
            </div>
            <div className="card-search-options">
              <label className="compact-control">
                <span>Group by</span>
                <select
                  aria-label="Group by"
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
              <label className="compact-control">
                <span>Sort by</span>
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
              <fieldset className="board-selector">
                <legend>Add to</legend>
                {addZoneOptions.map((zone) => (
                  <label key={zone}>
                    <input
                      checked={searchAddZone === zone}
                      name="search-add-zone"
                      onChange={() => {
                        setSearchAddZone(zone);
                      }}
                      type="radio"
                    />
                    <span>{searchAddZoneLabel(zone)}</span>
                  </label>
                ))}
              </fieldset>
            </div>
          </form>
          {showSearchResults && (
            <SearchDrawer
              addResult={(card) => {
                addSearchResult(card, searchAddZone);
              }}
              busy={busy}
              results={results}
              searchDrawerRef={searchContainerRef}
              targetZone={searchAddZone}
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
                  <section className="text-group-section" key={group.label}>
                    <h3>
                      <span className="group-title-text">{group.label}</span>{" "}
                      <small>{group.quantity}</small>
                    </h3>
                    <div className="card-grid">
                      {group.cards.map((card) => (
                        <article className="card-row" key={card.id}>
                          <div className="text-card-main">
                            <strong className="text-card-name">
                              <InlineCardText
                                cards={[card]}
                                text={`[[${card.card_name}]]`}
                              />
                            </strong>
                            {card.core && (
                              <span
                                aria-label={`${card.card_name} is starred as a core card`}
                                className="text-card-star"
                                title="Starred core card"
                              >
                                <MaterialIcon name="star" />
                              </span>
                            )}
                          </div>
                          <TextCardRowActions
                            applyQuantityChange={applyQuantityChange}
                            busy={busy}
                            card={card}
                            editCardNote={editCardNote}
                            format={deck.format}
                            moveCardToZone={moveCardToZone}
                            toggleCoreCard={toggleCoreCard}
                          />
                          {card.note.trim() !== "" && (
                            <p className="card-note-preview">{card.note}</p>
                          )}
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
                moveCardToZone={moveCardToZone}
                removeCard={(card) => {
                  applyQuantityChange(card, -1);
                }}
                scores={scores}
                sortBy={sortBy}
                editCardNote={editCardNote}
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
