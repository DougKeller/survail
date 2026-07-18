import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

import type { CardSet, CardZone } from "../../modules/decks/contracts";
import { IconButton } from "../../designsystem/primitives/button";
import {
  Segmented,
  SegmentedButtons,
} from "../../designsystem/primitives/choice";
import { Input } from "../../designsystem/primitives/input";
import { PopoverAnchor } from "../../designsystem/primitives/popover";
import { Select } from "../../designsystem/primitives/select";
import { BoardLayout } from "../../designsystem/layout/board";
import { FlexSpacer, Inline } from "../../designsystem/layout/inline";
import { NavBar } from "../../designsystem/primitives/nav";
import { Page } from "../../designsystem/layout/page";
import { Stack } from "../../designsystem/layout/stack";
import { Heading, Kicker, Text } from "../../designsystem/layout/typography";
import type { DeckView, GroupBy, SortBy } from "../deck/constants";
import {
  searchAddZonesFor,
  titleize,
  useDismissibleSurface,
  VisualCardGroups,
  zoneLabel,
  zonesFor,
} from "../deckPrimitives";
import { DeckBoard } from "./boardView";
import { DeckRail } from "./deckRail";
import { SearchDrawer } from "./searchDrawer";
import { useDeckEditorContext } from "./deckEditorContext";

const GROUP_OPTIONS: { label: string; value: GroupBy }[] = [
  { label: "Type", value: "type" },
  { label: "Color", value: "color" },
  { label: "Mana Value", value: "mana-value" },
  { label: "Role", value: "role" },
];

const SORT_OPTIONS: { label: string; value: SortBy }[] = [
  { label: "Alphabetical", value: "alphabetical" },
  { label: "Starred", value: "starred" },
  { label: "Mana Value", value: "mana-value" },
  { label: "Price", value: "price" },
  { label: "Role Score", value: "score" },
];

function searchAddZoneLabel(zone: CardZone): string {
  return zone === "commander"
    ? "Commander"
    : zone.charAt(0).toUpperCase() + zone.slice(1);
}

export function DeckCardsView() {
  const {
    actions: {
      changeQuantity: applyQuantityChange,
      markAsCommander: markCommander,
      moveCardToZone,
      toggleCoreCard,
    },
    data: { busy },
    deck,
    display: { displayPreferences, setDisplayPreferences },
    modals: { setActiveCardNote: editCardNote },
    scoring: { scores },
    search: {
      addCardFromSearch,
      handleSearch: openSearch,
      query: searchForm,
      results,
      searchInputRef,
      setQuery,
      setShowSearchResults,
      showSearchResults,
    },
  } = useDeckEditorContext();
  const { groupBy, sortBy, view } = displayPreferences;
  const searchContainerRef = useDismissibleSurface<HTMLDivElement>(
    showSearchResults,
    () => {
      setShowSearchResults(false);
    },
    { manageFocus: false },
  );
  const addZoneOptions = useMemo(
    () => searchAddZonesFor(deck.format),
    [deck.format],
  );
  const [searchAddZone, setSearchAddZone] = useState<CardZone>("mainboard");
  const [previewCard, setPreviewCard] = useState<CardSet | null>(null);

  useEffect(() => {
    if (addZoneOptions.includes(searchAddZone)) return;
    setSearchAddZone("mainboard");
  }, [addZoneOptions, searchAddZone]);

  const addToZone = (zone: CardZone): void => {
    if (addZoneOptions.includes(zone)) setSearchAddZone(zone);
    searchInputRef.current?.focus();
    if (searchForm.trim() !== "") void openSearch();
  };
  const defaultPreview =
    previewCard ??
    deck.cardsets.find((card) => card.zone === "commander") ??
    null;

  return (
    <>
      <NavBar aria-label="Card display controls" divided>
        <PopoverAnchor grow ref={searchContainerRef}>
          <Inline
            as="form"
            gap={2}
            onSubmit={(event) => {
              event.preventDefault();
              void openSearch();
            }}
          >
            <Input
              aria-label="Card search"
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder="Add a card…"
              ref={searchInputRef}
              value={searchForm}
            />
            <IconButton label="Search" title="Search" type="submit">
              <Search size={16} strokeWidth={2.75} />
            </IconButton>
          </Inline>
          {showSearchResults && (
            <SearchDrawer
              addResult={(card) => {
                addCardFromSearch(card, searchAddZone);
              }}
              busy={busy}
              results={results}
              targetZone={searchAddZone}
            />
          )}
        </PopoverAnchor>
        <Inline align="center" gap={2}>
          <Kicker>Add to</Kicker>
          <Segmented
            label="Add to"
            name="search-add-zone"
            onChange={(zone) => {
              setSearchAddZone(zone as CardZone);
            }}
            options={addZoneOptions.map((zone) => ({
              label: searchAddZoneLabel(zone),
              value: zone,
            }))}
            value={searchAddZone}
          />
        </Inline>
        <FlexSpacer />
        <Select
          aria-label="Group by"
          onChange={(event) => {
            setDisplayPreferences((current) => ({
              ...current,
              groupBy: event.target.value as GroupBy,
            }));
          }}
          options={GROUP_OPTIONS}
          value={groupBy}
        />
        <Select
          aria-label="Card sort"
          onChange={(event) => {
            setDisplayPreferences((current) => ({
              ...current,
              sortBy: event.target.value as SortBy,
            }));
          }}
          options={SORT_OPTIONS}
          value={sortBy}
        />
        <SegmentedButtons
          label="Card view"
          onChange={(deckView) => {
            setDisplayPreferences((current) => ({
              ...current,
              view: deckView as DeckView,
            }));
          }}
          options={(["stacks", "grid", "text"] as const).map((deckView) => ({
            label: titleize(deckView),
            value: deckView,
          }))}
          value={view}
        />
      </NavBar>
      {view === "text" ? (
        <BoardLayout>
          <DeckBoard onAddToZone={addToZone} onPreview={setPreviewCard} />
          <DeckRail previewCard={defaultPreview} />
        </BoardLayout>
      ) : (
        <BoardLayout>
          <Page as="div">
            <Stack gap={6}>
              {zonesFor(deck.format).map((zone) => {
                const cards = deck.cardsets.filter(
                  (card) => card.zone === zone,
                );
                if (cards.length === 0 && zone !== "mainboard") return null;
                const total = cards.reduce(
                  (sum, card) => sum + card.quantity,
                  0,
                );
                return (
                  <Stack as="section" gap={2} key={zone}>
                    <Heading level={2} size="xl">
                      {zoneLabel(zone)}{" "}
                      <Text as="span" muted size="base">
                        {total}
                      </Text>
                    </Heading>
                    <VisualCardGroups
                      addCard={(card) => {
                        applyQuantityChange(card, 1);
                      }}
                      busy={busy}
                      cards={cards}
                      editCardNote={editCardNote}
                      format={deck.format}
                      groupBy={groupBy}
                      markCommander={markCommander}
                      moveCardToZone={moveCardToZone}
                      removeCard={(card) => {
                        applyQuantityChange(card, -1);
                      }}
                      scores={scores}
                      sortBy={sortBy}
                      toggleCoreCard={toggleCoreCard}
                      view={view}
                    />
                  </Stack>
                );
              })}
            </Stack>
          </Page>
          <DeckRail previewCard={defaultPreview} />
        </BoardLayout>
      )}
    </>
  );
}
