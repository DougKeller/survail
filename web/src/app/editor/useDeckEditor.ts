import { useCallback, useContext, useEffect, useState } from "react";
import type { NavigateFunction } from "react-router-dom";

import { api } from "../api";
import {
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
import { useDeckActions } from "./useDeckActions";
import { useDeckScoring } from "./useDeckScoring";

export function useDeckEditor(id: string, navigate: NavigateFunction) {
  const priceProvider = useContext(PriceProviderContext);
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
  const [printingCardset, setPrintingCardset] = useState<CardSet | null>(null);
  const [displayPreferences, setDisplayPreferences] =
    useState<DeckDisplayPreferences>(storedDeckDisplayPreferences);
  const [editorView, setEditorView] = useState<EditorView>("cards");
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

  const { evaluationProgress, evaluateCurrentDeck, scoring, scores } =
    useDeckScoring({ deck, setAnnouncement, setError });
  const {
    addSearchResult,
    applyBulkEdit,
    changePrinting,
    changeQuantity,
    handleDelete,
    handleGenerateDescription,
    handleRevert,
    handleSaveDetails,
    handleSearch,
    markAsCommander,
    openBulkEdit,
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
    setPrintingCardset,
    setResults,
    setShowBulkEdit,
    setShowSearchResults,
    setValidation,
    title,
  });

  return {
    addSearchResult,
    announcement,
    applyBulkEdit,
    busy,
    bulkDecklist,
    bulkEditErrors,
    changePrinting,
    changeQuantity,
    deck,
    description,
    displayPreferences,
    editorView,
    error,
    evaluationProgress,
    evaluateCurrentDeck,
    goal,
    handleDelete,
    handleGenerateDescription,
    handleRevert,
    handleSaveDetails,
    handleSearch,
    loadDeck,
    markAsCommander,
    openBulkEdit,
    operations,
    priceProvider,
    printingCardset,
    query,
    results,
    scoring,
    scores,
    setAnnouncement,
    setBulkDecklist,
    setDeck,
    setDescription,
    setDisplayPreferences,
    setEditorView,
    setError,
    setGoal,
    setPrintingCardset,
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
    validation,
  };
}
