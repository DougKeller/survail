import { useCallback } from "react";
import type { NavigateFunction } from "react-router-dom";

import { ApiError } from "../../core/http/client";
import type { ScryfallCard } from "../../modules/cards/contracts";
import type {
  CardSet,
  CardZone,
  Deck,
  DeckOperation,
  DeckOperationChangeInput,
  Validation,
} from "../../modules/decks/contracts";
import type { ImportPreferences } from "../../modules/imports/contracts";
import { api } from "../api";
import {
  bulkEditChanges,
  decklistText,
  messageFor,
  preferredFinish,
} from "../deckPrimitives";
import { useDeckMetadataActions } from "./useDeckMetadataActions";

export function useDeckActions({
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
}: {
  bulkDecklist: string;
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
  setBulkDecklist: (value: string) => void;
  setBulkEditErrors: (value: string[]) => void;
  setBusy: (value: boolean) => void;
  setDeck: (
    value: Deck | ((current: Deck | null) => Deck | null) | null,
  ) => void;
  setError: (value: string | null) => void;
  setOperations: (value: DeckOperation[]) => void;
  setResults: (value: ScryfallCard[]) => void;
  setShowBulkEdit: (value: boolean) => void;
  setShowSearchResults: (value: boolean) => void;
  setValidation: (value: Validation | null) => void;
  title: string;
}) {
  const setConflictError = useCallback(
    async (reason: unknown): Promise<void> => {
      setError(reason instanceof Error ? messageFor(reason) : "Request failed");
      if (reason instanceof ApiError && reason.status === 409) await loadDeck();
    },
    [loadDeck, setError],
  );

  const runMutation = useCallback(
    (mutate: (currentDeck: Deck) => Promise<void>): void => {
      if (deck === null || busy) return;
      setBusy(true);
      setError(null);
      void (async () => {
        try {
          await mutate(deck);
        } catch (caught) {
          await setConflictError(caught);
        } finally {
          setBusy(false);
        }
      })();
    },
    [busy, deck, setBusy, setConflictError, setError],
  );

  const applyChanges = useCallback(
    (changes: DeckOperationChangeInput[], reason: string) => {
      runMutation(async (currentDeck) => {
        const result = await api.applyOperation(
          id,
          currentDeck.revision,
          changes,
          reason,
        );
        setDeck(result.deck);
        setValidation(result.validation);
        setOperations(await api.operations(id));
        setAnnouncement(reason);
      });
    },
    [id, runMutation, setAnnouncement, setDeck, setOperations, setValidation],
  );

  const metadataActions = useDeckMetadataActions({
    busy,
    deck,
    description,
    goal,
    id,
    loadDeck,
    navigate,
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
  });

  const changeQuantity = (cardset: CardSet, quantityDelta: number): void => {
    applyChanges(
      [
        {
          printing_id: cardset.printing_id,
          quantity_delta: quantityDelta,
          zone: cardset.zone,
          finish: cardset.finish,
          note: cardset.note,
          tags: cardset.tags,
        },
      ],
      `${quantityDelta > 0 ? "Add" : "Remove"} ${cardset.card_name}`,
    );
  };

  const markAsCommander = (cardset: CardSet): void => {
    applyChanges(
      [
        {
          printing_id: cardset.printing_id,
          quantity_delta: -1,
          zone: cardset.zone,
          finish: cardset.finish,
          note: cardset.note,
        },
        {
          printing_id: cardset.printing_id,
          quantity_delta: 1,
          zone: "commander",
          finish: cardset.finish,
          note: cardset.note,
          tags: cardset.tags,
        },
      ],
      `Set ${cardset.card_name} as commander`,
    );
  };

  const moveCardToZone = (cardset: CardSet, zone: CardZone): void => {
    if (cardset.zone === zone) return;
    applyChanges(
      [
        {
          printing_id: cardset.printing_id,
          quantity_delta: -1,
          zone: cardset.zone,
          finish: cardset.finish,
          note: cardset.note,
          tags: cardset.tags,
        },
        {
          printing_id: cardset.printing_id,
          quantity_delta: 1,
          zone,
          finish: cardset.finish,
          note: cardset.note,
          tags: cardset.tags,
        },
      ],
      `Move ${cardset.card_name} to ${zone}`,
    );
  };

  const toggleCoreCard = (cardset: CardSet): void => {
    runMutation(async (currentDeck) => {
      const nextCore = !cardset.core;
      const nextDeck = await api.setCardCore(
        currentDeck.id,
        cardset.id,
        nextCore,
      );
      setDeck(nextDeck);
      setValidation(await api.validation(currentDeck.id));
      setAnnouncement(
        `${nextCore ? "Starred" : "Unstarred"} ${cardset.card_name} as a core card`,
      );
    });
  };

  const updateCardNote = (cardset: CardSet, note: string): void => {
    runMutation(async (currentDeck) => {
      const trimmedNote = note.trim();
      const nextDeck = await api.setCardNote(
        currentDeck.id,
        cardset.id,
        trimmedNote,
      );
      setDeck(nextDeck);
      setAnnouncement(
        trimmedNote === ""
          ? `Cleared note for ${cardset.card_name}`
          : `Saved note for ${cardset.card_name}`,
      );
    });
  };

  const addSearchResult = (card: ScryfallCard, zone: CardZone): void => {
    applyChanges(
      [
        {
          printing_id: card.id,
          quantity_delta: 1,
          zone,
          finish: preferredFinish(card, "nonfoil"),
        },
      ],
      `Add ${card.name} to ${zone}`,
    );
  };

  async function applyBulkEdit(): Promise<void> {
    if (deck === null || busy) return;
    setBusy(true);
    setBulkEditErrors([]);
    setError(null);
    try {
      const preview = await api.importMoxfield(
        bulkDecklist,
        printingPreferences,
      );
      if (preview.errors.length > 0) {
        setBulkEditErrors(
          preview.errors.map(
            (issue) => `Line ${String(issue.line_number)}: ${issue.message}`,
          ),
        );
        return;
      }
      const changes = bulkEditChanges(deck, preview);
      if (changes.length === 0) {
        setShowBulkEdit(false);
        setAnnouncement("Decklist is unchanged");
        return;
      }
      const result = await api.applyOperation(
        deck.id,
        deck.revision,
        changes,
        "Bulk edit decklist",
      );
      setDeck(result.deck);
      setValidation(result.validation);
      setOperations(await api.operations(deck.id));
      setShowBulkEdit(false);
      setAnnouncement("Decklist updated");
    } catch (reason) {
      await setConflictError(reason);
    } finally {
      setBusy(false);
    }
  }

  function openBulkEdit(): void {
    if (deck === null) return;
    setBulkDecklist(decklistText(deck));
    setBulkEditErrors([]);
    setShowBulkEdit(true);
  }

  return {
    addSearchResult,
    applyBulkEdit,
    changeQuantity,
    markAsCommander,
    moveCardToZone,
    openBulkEdit,
    toggleCoreCard,
    updateCardNote,
    ...metadataActions,
  };
}
