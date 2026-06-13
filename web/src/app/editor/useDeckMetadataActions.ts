import type { SyntheticEvent } from "react";
import type { NavigateFunction } from "react-router-dom";

import { ApiError } from "../../core/http/client";
import type { ScryfallCard } from "../../modules/cards/contracts";
import type {
  Deck,
  DeckOperation,
  Validation,
} from "../../modules/decks/contracts";
import type { ImportPreferences } from "../../modules/imports/contracts";
import { api } from "../api";
import { messageFor, queryForDeckFormat } from "../deckPrimitives";

export function useDeckMetadataActions({
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
  setBusy,
  setDeck,
  setError,
  setOperations,
  setResults,
  setShowSearchResults,
  setValidation,
  title,
}: {
  busy: boolean;
  deck: Deck | null;
  description: string;
  goal: string;
  id: string;
  loadDeck: () => Promise<void>;
  navigate: NavigateFunction;
  printingPreferences: ImportPreferences;
  query: string;
  setAnnouncement: (value: string) => void;
  setBusy: (value: boolean) => void;
  setDeck: (
    value: Deck | ((current: Deck | null) => Deck | null) | null,
  ) => void;
  setError: (value: string | null) => void;
  setOperations: (value: DeckOperation[]) => void;
  setResults: (value: ScryfallCard[]) => void;
  setShowSearchResults: (value: boolean) => void;
  setValidation: (value: Validation | null) => void;
  title: string;
}) {
  async function handleSearch(
    event: SyntheticEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (deck === null) return;
    setError(null);
    try {
      const cards = (
        await api.search(
          queryForDeckFormat(query, deck.format),
          printingPreferences,
        )
      ).cards;
      setResults(cards);
      setShowSearchResults(true);
      setAnnouncement(`${String(cards.length)} cards found`);
    } catch (reason) {
      setError(reason instanceof Error ? messageFor(reason) : "Request failed");
    }
  }

  async function handleSaveDetails(
    event: SyntheticEvent<HTMLFormElement>,
  ): Promise<boolean> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setDeck(await api.updateDeck(id, { title, description, goal }));
      setAnnouncement("Deck details updated");
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? messageFor(reason) : "Request failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!confirm("Delete this deck?")) return;
    try {
      await api.deleteDeck(id);
      void navigate("/decks");
    } catch (reason) {
      setError(reason instanceof Error ? messageFor(reason) : "Request failed");
    }
  }

  async function handleGenerateDescription(refresh = false): Promise<void> {
    if (deck === null || busy) return;
    setBusy(true);
    setError(null);
    try {
      const generated = await api.generateDescription(deck.id, refresh);
      setDeck((current) =>
        current === null
          ? null
          : { ...current, generated_description: generated.description },
      );
      setAnnouncement(
        generated.cached
          ? "Cached deck overview loaded"
          : "Deck overview generated",
      );
    } catch (reason) {
      setError(reason instanceof Error ? messageFor(reason) : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevert(operation: DeckOperation): Promise<void> {
    if (
      deck === null ||
      busy ||
      !confirm(`Undo change ${String(operation.revision_after)}?`)
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.revertOperation(
        deck.id,
        operation.id,
        deck.revision,
      );
      setDeck(result.deck);
      setValidation(result.validation);
      setOperations(await api.operations(deck.id));
    } catch (reason) {
      setError(reason instanceof Error ? messageFor(reason) : "Request failed");
      if (reason instanceof ApiError && reason.status === 409) await loadDeck();
    } finally {
      setBusy(false);
    }
  }

  return {
    handleDelete,
    handleGenerateDescription,
    handleRevert,
    handleSaveDetails,
    handleSearch,
  };
}
