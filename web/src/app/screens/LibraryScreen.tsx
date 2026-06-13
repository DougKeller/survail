import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type SyntheticEvent,
} from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../api";
import { AddDeckModal } from "../library/addDeckModal";
import { DeckGrid } from "../library/deckGrid";
import { ImportPanel } from "../library/importPanel";
import {
  isDeckFormat,
  messageFor,
  PREFERENCE_LABELS,
  storedImportPreferences,
  useModalBehavior,
} from "../deckPrimitives";

import type { Deck, DeckFormat } from "../../modules/decks/contracts";
import type {
  ImportPreferenceKind,
  ImportPreferenceRule,
  ImportPreferences,
  MoxfieldImportPreview,
} from "../../modules/imports/contracts";

export function LibraryScreen({ mode }: { mode: "decks" | "import" }) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<DeckFormat>("commander");
  const [decklist, setDecklist] = useState("");
  const [importPreferences, setImportPreferences] = useState<ImportPreferences>(
    storedImportPreferences,
  );
  const [preview, setPreview] = useState<MoxfieldImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddDeck, setShowAddDeck] = useState(false);
  const [openDeckMenu, setOpenDeckMenu] = useState<string | null>(null);
  const [draggedPreference, setDraggedPreference] =
    useState<ImportPreferenceKind | null>(null);
  const [preferenceAnnouncement, setPreferenceAnnouncement] = useState("");
  const navigate = useNavigate();
  const addDeckButtonRef = useRef<HTMLButtonElement>(null);
  const closeAddDeck = useCallback(() => {
    setShowAddDeck(false);
    requestAnimationFrame(() => {
      addDeckButtonRef.current?.focus();
    });
  }, []);
  const addDeckDialogRef = useModalBehavior<HTMLFormElement>(
    showAddDeck,
    closeAddDeck,
  );

  const loadDecks = useCallback(async (): Promise<void> => {
    setDecks(await api.decks());
  }, []);

  useEffect(() => {
    void loadDecks();
  }, [loadDecks]);

  useEffect(() => {
    localStorage.setItem(
      "survail.import-preferences",
      JSON.stringify(importPreferences),
    );
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

  function movePreference(
    source: ImportPreferenceKind,
    target: ImportPreferenceKind,
  ): void {
    setImportPreferences((current) => {
      const rules = [...current.rules];
      const sourceIndex = rules.findIndex((rule) => rule.kind === source);
      const targetIndex = rules.findIndex((rule) => rule.kind === target);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex)
        return current;
      const [moved] = rules.splice(sourceIndex, 1);
      if (moved === undefined) return current;
      rules.splice(targetIndex, 0, moved);
      setPreferenceAnnouncement(
        `${PREFERENCE_LABELS[source]} moved to priority ${String(targetIndex + 1)}`,
      );
      return { ...current, rules };
    });
  }

  function updateCheapestBuffer(bufferPercent: number): void {
    setImportPreferences((current) => ({
      ...current,
      rules: current.rules.map((rule) =>
        rule.kind === "cheapest" ? { ...rule, bufferPercent } : rule,
      ),
    }));
  }

  function updateFrame(
    frame: Extract<ImportPreferenceRule, { kind: "frame" }>["frame"],
  ): void {
    setImportPreferences((current) => ({
      ...current,
      rules: current.rules.map((rule) =>
        rule.kind === "frame" ? { ...rule, frame } : rule,
      ),
    }));
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

  async function handlePreview(
    event: SyntheticEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
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

  return (
    <main aria-busy={busy}>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {busy ? "Working" : ""}
      </div>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {preferenceAnnouncement}
      </div>
      <section className="page-heading">
        <div>
          <h1>{mode === "decks" ? "Your decks" : "Import a deck"}</h1>
          <p>
            {mode === "decks"
              ? "Build and manage your deck collection."
              : "Resolve a decklist and review every selected printing."}
          </p>
        </div>
        {mode === "decks" && (
          <button
            ref={addDeckButtonRef}
            onClick={() => {
              setShowAddDeck(true);
            }}
          >
            Add Deck
          </button>
        )}
      </section>
      {error !== null && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {mode === "import" && (
        <ImportPanel
          busy={busy}
          createImportedDeck={createImportedDeck}
          decklist={decklist}
          draggedPreference={draggedPreference}
          format={format}
          handleFormatChange={handleFormatChange}
          handlePreview={handlePreview}
          importPreferences={importPreferences}
          movePreference={movePreference}
          preview={preview}
          setDecklist={setDecklist}
          setDraggedPreference={setDraggedPreference}
          setImportPreferences={setImportPreferences}
          setTitle={setTitle}
          title={title}
          updateCheapestBuffer={updateCheapestBuffer}
          updateFrame={updateFrame}
        />
      )}
      {mode === "decks" && (
        <DeckGrid
          decks={decks}
          deleteDeck={deleteDeck}
          openDeckMenu={openDeckMenu}
          setOpenDeckMenu={setOpenDeckMenu}
        />
      )}
      {showAddDeck && (
        <AddDeckModal
          busy={busy}
          close={closeAddDeck}
          dialogRef={addDeckDialogRef}
          format={format}
          handleFormatChange={handleFormatChange}
          handleSubmit={handleCreateDeck}
          setTitle={setTitle}
          title={title}
        />
      )}
    </main>
  );
}
