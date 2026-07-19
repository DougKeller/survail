import { useEffect, useMemo, useState } from "react";
import { PanelRightClose, PanelRightOpen, Search } from "lucide-react";

import type { CardSet, CardZone } from "../../modules/decks/contracts";
import { Button, IconButton } from "../../designsystem/primitives/button";
import {
  Segmented,
  SegmentedButtons,
} from "../../designsystem/primitives/choice";
import { Input } from "../../designsystem/primitives/input";
import { PopoverAnchor } from "../../designsystem/primitives/popover";
import { Select } from "../../designsystem/primitives/select";
import { Dialog } from "../../designsystem/primitives/dialog";
import { FlexSpacer, Inline } from "../../designsystem/layout/inline";
import {
  CardsViewBody,
  CardsViewShell,
} from "../../designsystem/layout/cardZoneWorkspace";
import { NavBar } from "../../designsystem/primitives/nav";
import { Kicker } from "../../designsystem/layout/typography";
import type { DeckView, GroupBy, SortBy } from "../deck/constants";
import {
  searchAddZonesFor,
  storeDeckSummaryOpen,
  storedDeckSummaryOpen,
  titleize,
  useDismissibleSurface,
} from "../deckPrimitives";
import { DECK_SUMMARY_ID, DeckRail } from "./deckRail";
import { CardsZoneMatrix } from "./cardsZoneMatrixProvider";
import { SearchDrawer } from "./searchDrawer";
import { TagNameDialog } from "./tagControls";
import { useDeckEditorContext } from "./deckEditorContext";

const GROUP_OPTIONS: { label: string; value: GroupBy }[] = [
  { label: "Type", value: "type" },
  { label: "Color", value: "color" },
  { label: "Mana Value", value: "mana-value" },
  { label: "Role", value: "role" },
  { label: "Tags", value: "tags" },
];

const SORT_OPTIONS: { label: string; value: SortBy }[] = [
  { label: "Alphabetical", value: "alphabetical" },
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
    actions: { createTag },
    data: { busy },
    deck,
    display: { displayPreferences, setDisplayPreferences },
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
  const [compactSummary, setCompactSummary] = useState(
    () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia("(width <= 1100px)").matches,
  );
  const [creatingTag, setCreatingTag] = useState(false);
  const [showDeckSummary, setShowDeckSummary] = useState(() => {
    const defaultsOpen =
      typeof window.matchMedia !== "function" ||
      window.matchMedia("(width > 1440px)").matches;
    return storedDeckSummaryOpen(defaultsOpen);
  });

  useEffect(() => {
    if (addZoneOptions.includes(searchAddZone)) return;
    setSearchAddZone("mainboard");
  }, [addZoneOptions, searchAddZone]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(width <= 1100px)");
    const update = () => {
      setCompactSummary(media.matches);
    };
    media.addEventListener("change", update);
    return () => {
      media.removeEventListener("change", update);
    };
  }, []);

  const defaultPreview =
    previewCard ??
    deck.cardsets.find((card) => card.zone === "commander") ??
    null;

  return (
    <CardsViewShell>
      <NavBar aria-label="Card display controls" divided scrollOnCompact>
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
        {groupBy === "tags" && (
          <Button
            disabled={busy}
            onClick={() => {
              setCreatingTag(true);
            }}
            variant="secondary"
          >
            New tag
          </Button>
        )}
        <FlexSpacer />
        <Inline align="center" gap={2}>
          <Kicker>Group</Kicker>
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
        </Inline>
        <Inline align="center" gap={2}>
          <Kicker>Sort</Kicker>
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
        </Inline>
        <Inline align="center" gap={2}>
          <Kicker>View</Kicker>
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
        </Inline>
        <Button
          aria-controls={DECK_SUMMARY_ID}
          aria-expanded={showDeckSummary}
          aria-label={`${showDeckSummary ? "Hide" : "Show"} deck summary`}
          onClick={() => {
            setShowDeckSummary((current) => {
              const next = !current;
              storeDeckSummaryOpen(next);
              return next;
            });
          }}
          title={`${showDeckSummary ? "Hide" : "Show"} deck summary`}
          variant="ghost"
        >
          {showDeckSummary ? (
            <PanelRightClose size={16} strokeWidth={2.75} />
          ) : (
            <PanelRightOpen size={16} strokeWidth={2.75} />
          )}
          Summary
        </Button>
      </NavBar>
      <CardsViewBody>
        <CardsZoneMatrix onPreview={setPreviewCard} />
        {showDeckSummary && !compactSummary && (
          <DeckRail previewCard={defaultPreview} />
        )}
      </CardsViewBody>
      <Dialog
        closeLabel="Close deck summary"
        onClose={() => {
          setShowDeckSummary(false);
          storeDeckSummaryOpen(false);
        }}
        open={showDeckSummary && compactSummary}
        size="wide"
        title="Deck summary"
      >
        <DeckRail contained previewCard={defaultPreview} />
      </Dialog>
      <TagNameDialog
        busy={busy}
        initialName=""
        onCancel={() => {
          if (!busy) setCreatingTag(false);
        }}
        onSubmit={(name) => {
          void createTag(name).then((created) => {
            if (created) setCreatingTag(false);
            return undefined;
          });
        }}
        open={creatingTag}
        title="New tag"
      />
    </CardsViewShell>
  );
}
