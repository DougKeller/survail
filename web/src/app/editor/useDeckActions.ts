import { useCallback } from "react";
import type { NavigateFunction } from "react-router-dom";

import { ApiError } from "../../core/http/client";
import type { ScryfallCard } from "../../modules/cards/contracts";
import type {
  CardFinish,
  CardSet,
  Deck,
  DeckOperation,
  DeckOperationChangeInput,
  Validation,
} from "../../modules/decks/contracts";
import type { ImportPreferences } from "../../modules/imports/contracts";
import { api } from "../api";
import { bulkEditChanges, decklistText, messageFor } from "../deckPrimitives";
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
  setPrintingCardset,
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
  setPrintingCardset: (value: CardSet | null) => void;
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

  const applyChanges = useCallback(
    (changes: DeckOperationChangeInput[], reason: string) => {
      if (deck === null || busy) return;
      setBusy(true);
      setError(null);
      void (async () => {
        try {
          const result = await api.applyOperation(
            id,
            deck.revision,
            changes,
            reason,
          );
          setDeck(result.deck);
          setValidation(result.validation);
          setOperations(await api.operations(id));
          setAnnouncement(reason);
        } catch (caught) {
          await setConflictError(caught);
        } finally {
          setBusy(false);
        }
      })();
    },
    [
      busy,
      deck,
      id,
      setAnnouncement,
      setBusy,
      setConflictError,
      setDeck,
      setError,
      setOperations,
      setValidation,
    ],
  );

  const metadataActions = useDeckMetadataActions({
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
  });

  const changeQuantity = (cardset: CardSet, quantityDelta: number): void => {
    applyChanges(
      [
        {
          printing_id: cardset.printing_id,
          quantity_delta: quantityDelta,
          zone: cardset.zone,
          finish: cardset.finish,
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
        },
        {
          printing_id: cardset.printing_id,
          quantity_delta: 1,
          zone: "commander",
          finish: cardset.finish,
          tags: cardset.tags,
        },
      ],
      `Set ${cardset.card_name} as commander`,
    );
  };

  const changePrinting = (
    cardset: CardSet,
    printing: ScryfallCard,
    finish: CardFinish,
  ): void => {
    applyChanges(
      [
        {
          printing_id: cardset.printing_id,
          quantity_delta: -cardset.quantity,
          zone: cardset.zone,
          finish: cardset.finish,
        },
        {
          printing_id: printing.id,
          quantity_delta: cardset.quantity,
          zone: cardset.zone,
          finish,
          tags: cardset.tags,
        },
      ],
      `Change ${cardset.card_name} printing`,
    );
    setPrintingCardset(null);
  };

  const addSearchResult = (card: ScryfallCard, finish: CardFinish): void => {
    applyChanges(
      [{ printing_id: card.id, quantity_delta: 1, zone: "mainboard", finish }],
      `Add ${card.name}`,
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
        true,
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
      setError(
        reason instanceof Error
          ? messageFor(reason)
          : "Could not update decklist",
      );
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
    changePrinting,
    changeQuantity,
    markAsCommander,
    openBulkEdit,
    ...metadataActions,
  };
}
