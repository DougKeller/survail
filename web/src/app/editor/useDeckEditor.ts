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
  storedDeckDisplayPreferences,
  storedImportPreferences,
} from "../deckPrimitives";

import type { ScryfallCard } from "../../modules/cards/contracts";
import type {
  CardSet,
  Deck,
  DeckOperation,
  Validation,
} from "../../modules/decks/contracts";
import type { ImportPreferences } from "../../modules/imports/contracts";
import type { DeckDisplayPreferences, EditorView } from "../deck/constants";
import type { DeckAnalytics } from "../../modules/decks/analytics/contracts";
import { useDeckActions } from "./useDeckActions";
import { useDeckScoring } from "./useDeckScoring";

export function useDeckEditor(id: string, navigate: NavigateFunction) {
  const priceProvider = useContext(PriceProviderContext);
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
  const [analytics, setAnalytics] = useState<DeckAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [printingPreferences] = useState<ImportPreferences>(
    storedImportPreferences,
  );
  const [showHistory, setShowHistory] = useState(false);
  const [showEditDeck, setShowEditDeck] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkDecklist, setBulkDecklist] = useState("");
  const [bulkEditErrors, setBulkEditErrors] = useState<string[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [activeCardNote, setActiveCardNote] = useState<CardSet | null>(null);
  const displayPreferences = deckDisplayPreferencesFromSearchParams(
    searchParams,
    initialDisplayPreferences.current,
  );
  const editorView = editorViewFromSearchParams(searchParams);

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
  }, [id]);

  useEffect(() => {
    void loadDeck().catch((reason: unknown) => {
      setError(reason instanceof Error ? messageFor(reason) : "Request failed");
    });
  }, [loadDeck]);

  useEffect(() => {
    localStorage.setItem(
      "survail.deck-display-preferences",
      JSON.stringify(displayPreferences),
    );
  }, [displayPreferences]);

  const loadAnalytics = useCallback(async (): Promise<void> => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      setAnalytics(await api.deckAnalytics(id));
    } catch (reason) {
      setAnalyticsError(
        reason instanceof Error ? reason.message : "Could not load deck analytics",
      );
    } finally {
      setAnalyticsLoading(false);
    }
  }, [id]);

  const setDisplayPreferences = useCallback(
    (update: SetStateAction<DeckDisplayPreferences>) => {
      const next =
        typeof update === "function" ? update(displayPreferences) : update;
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.set("view", next.view);
      nextSearchParams.set("group", next.groupBy);
      nextSearchParams.set("sort", next.sortBy);
      setSearchParams(nextSearchParams, { replace: true });
    },
    [displayPreferences, searchParams, setSearchParams],
  );

  const setEditorView = useCallback(
    (view: EditorView) => {
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.set("tab", view);
      setSearchParams(nextSearchParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const {
    annotationLoading,
    annotationQueue,
    evaluationProgress,
    evaluateCard,
    evaluateCurrentDeck,
    loadAnnotationQueue,
    loadCachedScores,
    refreshingOracleIds,
    runSandbox,
    sandboxRun,
    sandboxRunning,
    saveAnnotationLabel,
    scoring,
    scores,
  } = useDeckScoring({ deck, setAnnouncement, setError });
  const {
    addSearchResult,
    applyBulkEdit,
    changeQuantity,
    handleDelete,
    handleGenerateDescription,
    handleRevert,
    handleSaveDetails,
    handleSearch,
    markAsCommander,
    moveCardToZone,
    openBulkEdit,
    toggleCoreCard,
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
    addSearchResult,
    analytics,
    analyticsError,
    analyticsLoading,
    announcement,
    annotationLoading,
    annotationQueue,
    applyBulkEdit,
    busy,
    bulkDecklist,
    bulkEditErrors,
    changeQuantity,
    deck,
    description,
    displayPreferences,
    editorView,
    error,
    evaluationProgress,
    evaluateCard,
    evaluateCurrentDeck,
    handleDelete,
    handleGenerateDescription,
    handleRevert,
    handleSaveDetails,
    handleSearch,
    loadAnalytics,
    loadAnnotationQueue,
    loadCachedScores,
    loadDeck,
    goal,
    markAsCommander,
    moveCardToZone,
    openBulkEdit,
    operations,
    priceProvider,
    query,
    refreshingOracleIds,
    results,
    runSandbox,
    sandboxRun,
    sandboxRunning,
    saveAnnotationLabel,
    activeCardNote,
    scoring,
    scores,
    searchInputRef,
    setAnnouncement,
    setBulkDecklist,
    setActiveCardNote,
    setDeck,
    setDescription,
    setDisplayPreferences,
    setEditorView,
    setError,
    setGoal,
    setQuery,
    setResults,
    setShowBulkEdit,
    setShowEditDeck,
    setShowHistory,
    setShowSearchResults,
    setTitle,
    showBulkEdit,
    showEditDeck,
    showHistory,
    showSearchResults,
    title,
    toggleCoreCard,
    updateCardNote,
    validation,
  };
}
