import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type SetStateAction,
} from "react";
import { useSearchParams, type NavigateFunction } from "react-router-dom";

import { api } from "../api";
import {
  deckDisplayPreferencesFromSearchParams,
  editorViewFromSearchParams,
  messageFor,
  PriceProviderContext,
  scoringAwareDeckDisplayPreferences,
  scoringAwareEditorView,
  storeDeckDisplayPreferences,
  storedDeckDisplayPreferences,
  storedImportPreferences,
} from "../deckPrimitives";

import type { ScryfallCard } from "../../modules/cards/contracts";
import type {
  CardSet,
  CardZone,
  Deck,
  DeckOperation,
  Validation,
} from "../../modules/decks/contracts";
import type { ImportPreferences } from "../../modules/imports/contracts";
import type { DeckDisplayPreferences, EditorView } from "../deck/constants";
import { ScoringEnabledContext } from "../deck/constants";
import { useDeckAnalytics } from "./useDeckAnalytics";
import { useDeckActions } from "./useDeckActions";
import { useDeckScoring } from "./useDeckScoring";

/** Editor-level dialogs opened from the top bar (wireframes 1e/1f/1g). */
export type EditorDialog = "describe" | "history" | "validation";

export function useDeckEditor(id: string, navigate: NavigateFunction) {
  const priceProvider = useContext(PriceProviderContext);
  const scoringEnabled = useContext(ScoringEnabledContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const initialDisplayPreferences = useRef<DeckDisplayPreferences>(
    storedDeckDisplayPreferences(),
  );
  const [deck, setDeck] = useState<Deck | null>(null);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [operations, setOperations] = useState<DeckOperation[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ScryfallCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const { analytics, analyticsError, analyticsLoading, loadAnalytics } =
    useDeckAnalytics(id);
  const [printingPreferences] = useState<ImportPreferences>(
    storedImportPreferences,
  );
  const [openDialog, setOpenDialog] = useState<EditorDialog | null>(null);
  const [showEditDeck, setShowEditDeck] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkDecklist, setBulkDecklist] = useState("");
  const [bulkEditErrors, setBulkEditErrors] = useState<string[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [activeCardNote, setActiveCardNote] = useState<CardSet | null>(null);
  const requestedDisplayPreferences = deckDisplayPreferencesFromSearchParams(
    searchParams,
    initialDisplayPreferences.current,
  );
  const displayPreferences = scoringAwareDeckDisplayPreferences(
    requestedDisplayPreferences,
    scoringEnabled,
  );
  const editorView = scoringAwareEditorView(
    editorViewFromSearchParams(searchParams),
    scoringEnabled,
  );

  const loadDeck = useCallback(async (): Promise<void> => {
    const [loadedDeck, loadedValidation, loadedOperations] = await Promise.all([
      api.deck(id),
      api.validation(id),
      api.operations(id),
    ]);
    setDeck(loadedDeck);
    setTitle(loadedDeck.title);
    setDescription(loadedDeck.description);
    setGoal(loadedDeck.goal);
    setValidation(loadedValidation);
    setOperations(loadedOperations);
  }, [
    id,
    setDeck,
    setDescription,
    setGoal,
    setOperations,
    setTitle,
    setValidation,
  ]);

  useEffect(() => {
    void loadDeck().catch((reason: unknown) => {
      setError(reason instanceof Error ? messageFor(reason) : "Request failed");
    });
  }, [loadDeck]);

  useEffect(() => {
    storeDeckDisplayPreferences(displayPreferences);
  }, [displayPreferences]);

  // Derive updates from window.location, which history updates synchronously.
  // Render-time search params (even via the functional setter, which resolves
  // against them) go stale when consecutive changes land within one render,
  // letting the later update clobber the earlier one.
  const setDisplayPreferences = useCallback(
    (update: SetStateAction<DeckDisplayPreferences>) => {
      const nextSearchParams = new URLSearchParams(window.location.search);
      const current = deckDisplayPreferencesFromSearchParams(
        nextSearchParams,
        initialDisplayPreferences.current,
      );
      const effectiveCurrent = scoringAwareDeckDisplayPreferences(
        current,
        scoringEnabled,
      );
      const next =
        typeof update === "function" ? update(effectiveCurrent) : update;
      nextSearchParams.set("view", next.view);
      nextSearchParams.set("group", next.groupBy);
      nextSearchParams.set("sort", next.sortBy);
      setSearchParams(nextSearchParams, { replace: true });
    },
    [scoringEnabled, setSearchParams],
  );

  const setEditorView = useCallback(
    (view: EditorView) => {
      const nextSearchParams = new URLSearchParams(window.location.search);
      nextSearchParams.set("tab", view);
      setSearchParams(nextSearchParams, { replace: true });
    },
    [setSearchParams],
  );

  const {
    clearScoreCache,
    clearingScores,
    evaluationProgress,
    evaluateCurrentDeck,
    loadCachedScores,
    scoring,
    scores,
  } = useDeckScoring({ deck, scoringEnabled, setAnnouncement, setError });
  const {
    addTagToCard,
    addSearchResult,
    applyBulkEdit,
    changeQuantity,
    createTag,
    deleteTag,
    handleDelete,
    handleGenerateDescription,
    handleRevert,
    handleSaveDetails,
    handleSearch,
    markAsCommander,
    moveAllToConsidering,
    moveCardToZone,
    openBulkEdit,
    removeTagFromCard,
    setTagWeight,
    updateTag,
    updateCardNote,
  } = useDeckActions({
    bulkDecklist,
    busy,
    deck,
    description,
    goal,
    id,
    loadDeck,
    navigate,
    printingPreferences,
    query,
    setAnnouncement,
    setBulkDecklist,
    setBulkEditErrors,
    setBusy,
    setDeck,
    setError,
    setOperations,
    setResults,
    setShowBulkEdit,
    setShowSearchResults,
    setValidation,
    title,
  });

  function addCardFromSearch(card: ScryfallCard, zone: CardZone): void {
    addSearchResult(card, zone);
    setShowSearchResults(false);
    setResults([]);
    setQuery("");
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }

  useEffect(() => {
    if (editorView !== "cards") return;
    if (query.trim() === "") {
      setResults([]);
      setShowSearchResults(false);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      void handleSearch();
    }, 1000);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [editorView, handleSearch, query]);

  useEffect(() => {
    if (editorView !== "charts") return;
    void loadAnalytics();
  }, [deck?.revision, editorView, loadAnalytics, scores.size]);

  return {
    actions: {
      addTagToCard,
      changeQuantity,
      createTag,
      deleteTag,
      handleDelete,
      handleRevert,
      markAsCommander,
      moveAllToConsidering,
      moveCardToZone,
      removeTagFromCard,
      setTagWeight,
      updateTag,
      updateCardNote,
    },
    analytics: { analytics, analyticsError, analyticsLoading, loadAnalytics },
    data: {
      announcement,
      busy,
      deck,
      error,
      loadDeck,
      operations,
      setAnnouncement,
      setError,
      validation,
    },
    details: {
      description,
      goal,
      handleGenerateDescription,
      handleSaveDetails,
      setDescription,
      setGoal,
      setTitle,
      title,
    },
    display: {
      displayPreferences,
      editorView,
      priceProvider,
      scoringEnabled,
      setDisplayPreferences,
      setEditorView,
    },
    modals: {
      activeCardNote,
      applyBulkEdit,
      bulkDecklist,
      bulkEditErrors,
      openBulkEdit,
      openDialog,
      setActiveCardNote,
      setBulkDecklist,
      setOpenDialog,
      setShowBulkEdit,
      setShowEditDeck,
      showBulkEdit,
      showEditDeck,
    },
    scoring: {
      clearScoreCache,
      clearingScores,
      evaluateCurrentDeck,
      evaluationProgress,
      loadCachedScores,
      scores,
      scoring,
    },
    search: {
      addCardFromSearch,
      handleSearch,
      query,
      results,
      searchInputRef,
      setQuery,
      setShowSearchResults,
      showSearchResults,
    },
  };
}
