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
import {
  bulkMoveSummary,
  moveAllAnnouncement,
  moveAllToConsideringChanges,
  moveOneAnnouncement,
  moveOneChanges,
  type BulkMoveSource,
} from "./zoneMovement";

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

  const runMutationAsync = useCallback(
    async (mutate: (currentDeck: Deck) => Promise<void>): Promise<boolean> => {
      if (deck === null || busy) return false;
      setBusy(true);
      setError(null);
      try {
        await mutate(deck);
        return true;
      } catch (caught) {
        await setConflictError(caught);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [busy, deck, setBusy, setConflictError, setError],
  );

  const runMutation = useCallback(
    (mutate: (currentDeck: Deck) => Promise<void>): void => {
      void runMutationAsync(mutate);
    },
    [runMutationAsync],
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

  const changeQuantity = useCallback(
    (cardset: CardSet, quantityDelta: number): void => {
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
    },
    [applyChanges],
  );

  const markAsCommander = useCallback(
    (cardset: CardSet): void => {
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
    },
    [applyChanges],
  );

  const moveCardToZone = useCallback(
    (cardset: CardSet, zone: CardZone): void => {
      const changes = moveOneChanges(cardset, zone);
      if (changes.length === 0) return;
      applyChanges(changes, moveOneAnnouncement(cardset.card_name, zone));
    },
    [applyChanges],
  );

  const moveAllToConsidering = useCallback(
    (source: BulkMoveSource): void => {
      if (deck === null) return;
      const changes = moveAllToConsideringChanges(deck.cardsets, source);
      if (changes.length === 0) return;
      const { totalQuantity } = bulkMoveSummary(deck.cardsets, source);
      applyChanges(changes, moveAllAnnouncement(source, totalQuantity));
    },
    [applyChanges, deck],
  );

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

  const createTag = (name: string, card?: CardSet): Promise<boolean> => {
    const trimmedName = name.trim();
    if (trimmedName === "") return Promise.resolve(false);
    return runMutationAsync(async (currentDeck) => {
      const createdDeck = await api.createDeckTag(currentDeck.id, trimmedName);
      setDeck(createdDeck);
      const previousTagIds = new Set(
        (currentDeck.tags ?? []).map((tag) => tag.id),
      );
      const createdTag = createdDeck.tags?.find(
        (tag) => !previousTagIds.has(tag.id),
      );
      if (card !== undefined && createdTag !== undefined) {
        setDeck(
          await api.addCardsetTag(createdDeck.id, card.id, createdTag.id),
        );
        setAnnouncement(
          `Created tag ${trimmedName} and added ${card.card_name}`,
        );
        return;
      }
      setAnnouncement(`Created tag ${trimmedName}`);
    });
  };

  const updateTag = useCallback(
    (tagId: string, name: string, target: number): Promise<boolean> => {
      const trimmedName = name.trim();
      if (trimmedName === "") return Promise.resolve(false);
      return runMutationAsync(async (currentDeck) => {
        setDeck(
          await api.updateDeckTag(currentDeck.id, tagId, {
            name: trimmedName,
            target,
          }),
        );
        setAnnouncement(`Updated ${trimmedName} tag`);
      });
    },
    [runMutationAsync, setAnnouncement, setDeck],
  );

  const setTagWeight = useCallback(
    (
      cardset: CardSet,
      tagId: string,
      tagName: string,
      weight: number,
    ): Promise<boolean> =>
      runMutationAsync(async (currentDeck) => {
        setDeck(
          await api.setCardsetTagWeight(
            currentDeck.id,
            cardset.id,
            tagId,
            weight,
          ),
        );
        setAnnouncement(
          `Set ${cardset.card_name} ${tagName} weight to ${String(weight)}`,
        );
      }),
    [runMutationAsync, setAnnouncement, setDeck],
  );

  const reorderTags = useCallback(
    (tagIds: readonly string[]): Promise<boolean> =>
      runMutationAsync(async (currentDeck) => {
        setDeck(await api.reorderDeckTags(currentDeck.id, tagIds));
        setAnnouncement("Reordered tag columns");
      }),
    [runMutationAsync, setAnnouncement, setDeck],
  );

  const deleteTag = useCallback(
    (tagId: string, name: string): Promise<boolean> =>
      runMutationAsync(async (currentDeck) => {
        setDeck(await api.deleteDeckTag(currentDeck.id, tagId));
        setAnnouncement(`Deleted tag ${name}`);
      }),
    [runMutationAsync, setAnnouncement, setDeck],
  );

  const addTagToCard = useCallback(
    (cardset: CardSet, tagId: string, tagName: string): void => {
      if (cardset.tag_ids?.includes(tagId) === true) return;
      runMutation(async (currentDeck) => {
        setDeck(await api.addCardsetTag(currentDeck.id, cardset.id, tagId));
        setAnnouncement(`Tagged ${cardset.card_name} with ${tagName}`);
      });
    },
    [runMutation, setAnnouncement, setDeck],
  );

  const removeTagFromCard = useCallback(
    (cardset: CardSet, tagId: string, tagName: string): void => {
      if (cardset.tag_ids !== undefined && !cardset.tag_ids.includes(tagId))
        return;
      runMutation(async (currentDeck) => {
        setDeck(await api.removeCardsetTag(currentDeck.id, cardset.id, tagId));
        setAnnouncement(`Removed ${tagName} from ${cardset.card_name}`);
      });
    },
    [runMutation, setAnnouncement, setDeck],
  );

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
        { allowAiFallback: false },
      );
      if (preview.errors.length > 0) {
        setBulkEditErrors(
          preview.errors.map((issue) =>
            issue.line_number > 0
              ? `Line ${String(issue.line_number)}: ${issue.message}`
              : issue.message,
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
    addTagToCard,
    addSearchResult,
    applyBulkEdit,
    changeQuantity,
    createTag,
    deleteTag,
    markAsCommander,
    moveAllToConsidering,
    moveCardToZone,
    openBulkEdit,
    removeTagFromCard,
    reorderTags,
    setTagWeight,
    updateTag,
    updateCardNote,
    ...metadataActions,
  };
}
