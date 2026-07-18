import { Plus } from "lucide-react";
import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";

import { Page, PageHeader } from "../../designsystem/layout/page";
import { Heading, Text } from "../../designsystem/layout/typography";
import { Button } from "../../designsystem/primitives/button";
import { Segmented } from "../../designsystem/primitives/choice";
import { LiveRegion } from "../../designsystem/primitives/liveRegion";
import { ValidationItem } from "../../designsystem/patterns/validationItem";
import { api } from "../api";
import { AddDeckModal } from "../library/addDeckModal";
import { DeckGrid } from "../library/deckGrid";
import { ImportPanel } from "../library/importPanel";
import {
  DECK_FORMATS,
  isDeckFormat,
  messageFor,
  storedImportPreferences,
  storeImportPreferences,
  titleize,
} from "../deckPrimitives";

import type { Deck, DeckFormat } from "../../modules/decks/contracts";
import type {
  ImportPreferences,
  MoxfieldImportPreview,
} from "../../modules/imports/contracts";

export function LibraryScreen({ mode }: { mode: "decks" | "import" }) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<DeckFormat>("commander");
  const [formatFilter, setFormatFilter] = useState("all");
  const [decklist, setDecklist] = useState("");
  const [importPreferences, setImportPreferences] = useState<ImportPreferences>(
    storedImportPreferences,
  );
  const [preview, setPreview] = useState<MoxfieldImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddDeck, setShowAddDeck] = useState(false);
  const [openDeckMenu, setOpenDeckMenu] = useState<string | null>(null);
  const navigate = useNavigate();
  const closeAddDeck = useCallback(() => {
    setShowAddDeck(false);
  }, []);

  const loadDecks = useCallback(async (): Promise<void> => {
    setDecks(await api.decks());
  }, []);

  useEffect(() => {
    void loadDecks();
  }, [loadDecks]);

  useEffect(() => {
    storeImportPreferences(importPreferences);
  }, [importPreferences]);

  useEffect(() => {
    if (openDeckMenu === null) return;
    function closeMenu(event: globalThis.KeyboardEvent): void {
      if (event.key === "Escape") setOpenDeckMenu(null);
    }
    document.addEventListener("keydown", closeMenu);
    return () => {
      document.removeEventListener("keydown", closeMenu);
    };
  }, [openDeckMenu]);

  function handleFormatChange(event: ChangeEvent<HTMLSelectElement>): void {
    if (isDeckFormat(event.target.value)) setFormat(event.target.value);
  }

  async function handleCreateDeck(): Promise<void> {
    if (title.trim() === "") {
      setError("Enter a deck title before creating the deck.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const deck = await api.createDeck(title.trim(), format);
      void navigate(`/decks/${deck.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? messageFor(reason) : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteDeck(deck: Deck): Promise<void> {
    setOpenDeckMenu(null);
    if (!confirm(`Delete "${deck.title}"?`)) return;
    setError(null);
    try {
      await api.deleteDeck(deck.id);
      await loadDecks();
    } catch (reason) {
      setError(reason instanceof Error ? messageFor(reason) : "Request failed");
    }
  }

  async function handlePreview(): Promise<void> {
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      setPreview(await api.importMoxfield(decklist, importPreferences));
    } catch (reason) {
      setError(reason instanceof Error ? messageFor(reason) : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function createImportedDeck(): Promise<void> {
    if (preview === null || preview.errors.length > 0) return;
    if (title.trim() === "") {
      setError("Enter a deck title before creating the deck.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.createMoxfieldDeck({
        title: title.trim(),
        format,
        decklist,
        preferences: importPreferences,
      });
      void navigate(`/decks/${result.deck_id}`);
    } catch (reason) {
      setError(reason instanceof Error ? messageFor(reason) : "Request failed");
      setBusy(false);
    }
  }

  const formatOptions = [
    { label: "All", value: "all" },
    ...DECK_FORMATS.filter((deckFormat) =>
      decks.some((deck) => deck.format === deckFormat),
    ).map((deckFormat) => ({ label: titleize(deckFormat), value: deckFormat })),
  ];
  const visibleDecks =
    formatFilter === "all"
      ? decks
      : decks.filter((deck) => deck.format === formatFilter);

  return (
    <Page busy={busy}>
      <LiveRegion>{busy ? "Working" : ""}</LiveRegion>
      <PageHeader
        actions={
          mode === "decks" ? (
            <>
              <Segmented
                name="format-filter"
                onChange={setFormatFilter}
                options={formatOptions}
                value={formatFilter}
              />
              <Button
                icon={<Plus size={16} strokeWidth={2.75} />}
                onClick={() => {
                  setShowAddDeck(true);
                }}
              >
                Add Deck
              </Button>
            </>
          ) : undefined
        }
      >
        <Heading level={1} size="3xl">
          {mode === "decks" ? "Your decks" : "Import a deck"}
        </Heading>
        <Text muted size="md">
          {mode === "decks"
            ? `${String(decks.length)} ${decks.length === 1 ? "deck" : "decks"}`
            : "Resolve a decklist and review the imported cards."}
        </Text>
      </PageHeader>
      {error !== null && (
        <ValidationItem label={error} role="alert" status="warn" />
      )}
      {mode === "import" && (
        <ImportPanel
          busy={busy}
          createDeck={handleCreateDeck}
          createImportedDeck={createImportedDeck}
          decklist={decklist}
          format={format}
          handleFormatChange={handleFormatChange}
          handlePreview={handlePreview}
          importPreferences={importPreferences}
          preview={preview}
          setDecklist={setDecklist}
          setImportPreferences={setImportPreferences}
          setTitle={setTitle}
          title={title}
        />
      )}
      {mode === "decks" && (
        <DeckGrid
          decks={visibleDecks}
          deleteDeck={deleteDeck}
          onAddDeck={() => {
            setShowAddDeck(true);
          }}
          openDeckMenu={openDeckMenu}
          setOpenDeckMenu={setOpenDeckMenu}
        />
      )}
      <AddDeckModal
        busy={busy}
        format={format}
        handleFormatChange={handleFormatChange}
        handleSubmit={handleCreateDeck}
        onClose={closeAddDeck}
        open={showAddDeck}
        setTitle={setTitle}
        title={title}
      />
    </Page>
  );
}
