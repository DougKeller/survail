import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type SyntheticEvent,
} from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import { API, ApiError, api } from "./api";
import type {
  CardFinish,
  CardSet,
  CardZone,
  Deck,
  DeckFormat,
  DeckOperation,
  DeckOperationChangeInput,
  ImportPreferenceKind,
  ImportPreferenceRule,
  ImportPreferences,
  MoxfieldImportPreview,
  PriceProvider,
  ScryfallCard,
  Validation,
} from "./types";
import "./styles.css";
import "./preferences.css";

const DECK_FORMATS: readonly DeckFormat[] = [
  "commander",
  "brawl",
  "standard",
  "modern",
  "pioneer",
  "legacy",
  "vintage",
  "pauper",
];
const CONSTRUCTED_ZONES: readonly CardZone[] = [
  "mainboard",
  "sideboard",
  "companion",
  "considering",
];
const COMMANDER_ZONES: readonly CardZone[] = [
  "commander",
  "mainboard",
  "considering",
];
const DEFAULT_IMPORT_PREFERENCES: ImportPreferences = {
  preserveTags: false,
  rules: [
    { kind: "non_universes_beyond" },
    { kind: "cheapest", bufferPercent: 15 },
    { kind: "original_printing" },
    { kind: "frame", frame: "2015" },
    { kind: "nonfoil" },
    { kind: "foil" },
  ],
};
const PREFERENCE_LABELS: Record<ImportPreferenceKind, string> = {
  cheapest: "Cheapest",
  original_printing: "Original printing",
  non_universes_beyond: "Non-Universes Beyond",
  frame: "Frame style",
  foil: "Foil",
  nonfoil: "Non-foil",
};
const PriceProviderContext = createContext<PriceProvider>("tcgplayer");
type DeckView = "stacks" | "grid" | "text";
type GroupBy = "type" | "color" | "mana-value";
type SortBy = "alphabetical" | "mana-value" | "price";
interface DeckDisplayPreferences {
  view: DeckView;
  groupBy: GroupBy;
  sortBy: SortBy;
}

interface CardGroup {
  label: string;
  cards: CardSet[];
  quantity: number;
}

interface ValidationErrorGroup {
  errorId: string;
  errors: Validation["errors"];
}

interface DescriptionPart {
  text: string;
  card: CardSet | null;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function useModalBehavior<T extends HTMLElement>(
  open: boolean,
  close: () => void,
): React.RefObject<T | null> {
  const surfaceRef = useRef<T>(null);
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => {
      const surface = surfaceRef.current;
      const initialFocus = surface?.querySelector<HTMLElement>("[autofocus]")
        ?? surface?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
        ?? surface;
      initialFocus?.focus();
    });

    function handleKeyDown(event: globalThis.KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || surfaceRef.current === null) return;
      const focusable = [...surfaceRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
      if (focusable.length === 0) {
        event.preventDefault();
        surfaceRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1);
      if (first === undefined || last === undefined) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);

  return surfaceRef;
}

function useDismissibleSurface<T extends HTMLElement>(
  open: boolean,
  close: () => void,
): React.RefObject<T | null> {
  const surfaceRef = useRef<T>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const frame = requestAnimationFrame(() => { surfaceRef.current?.focus(); });
    function handleKeyDown(event: globalThis.KeyboardEvent): void {
      if (event.key === "Escape") closeRef.current();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [open]);
  return surfaceRef;
}

function isDeckFormat(value: string): value is DeckFormat {
  return DECK_FORMATS.some((format) => format === value);
}

function isCardFinish(value: string): value is CardFinish {
  return value === "nonfoil" || value === "foil" || value === "etched";
}

function zonesFor(format: DeckFormat): readonly CardZone[] {
  return format === "commander" || format === "brawl"
    ? COMMANDER_ZONES
    : CONSTRUCTED_ZONES;
}

function zoneLabel(zone: CardZone): string {
  if (zone === "commander") return "Command zone";
  return zone.charAt(0).toUpperCase() + zone.slice(1);
}

function titleize(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function queryForDeckFormat(query: string, format: DeckFormat): string {
  const hasLegalityFilter = /(?:^|\s)-?(?:legal|format|f):/i.test(query);
  return hasLegalityFilter ? query : `${query.trim()} legal:${format}`;
}

function groupedValidationErrors(validation: Validation | null): ValidationErrorGroup[] {
  const groups = new Map<string, Validation["errors"]>();
  for (const error of validation?.errors ?? []) {
    groups.set(error.error_id, [...(groups.get(error.error_id) ?? []), error]);
  }
  return [...groups.entries()].map(([errorId, errors]) => ({ errorId, errors }));
}

function descriptionParts(description: string, cards: CardSet[]): DescriptionPart[] {
  const cardsByName = new Map(cards.map((card) => [card.card_name.toLocaleLowerCase(), card]));
  const parts: DescriptionPart[] = [];
  const pattern = /\[\[([^[\]]+)\]\]/g;
  let cursor = 0;
  for (const match of description.matchAll(pattern)) {
    const index = match.index;
    const fullMatch = match[0];
    const name = match[1];
    if (name === undefined) continue;
    if (index > cursor) parts.push({ text: description.slice(cursor, index), card: null });
    const card = cardsByName.get(name.toLocaleLowerCase()) ?? null;
    parts.push({ text: card?.card_name ?? name, card });
    cursor = index + fullMatch.length;
  }
  if (cursor < description.length) parts.push({ text: description.slice(cursor), card: null });
  return parts;
}

function GeneratedDescription({ description, cards }: { description: string; cards: CardSet[] }) {
  return <div className="generated-description" aria-live="polite">
    {description.split("\n").map((paragraph, paragraphIndex) => <p key={String(paragraphIndex)}>
      {descriptionParts(paragraph, cards).map((part, partIndex) => part.card === null
        ? <React.Fragment key={String(partIndex)}>{part.text}</React.Fragment>
        : <span className="card-citation" key={String(partIndex)} tabIndex={0}>
            {part.text}
            <span className="card-citation-preview" role="tooltip">
              <CardImage card={part.card.scryfall} alt={part.card.card_name} className="citation-image" />
            </span>
          </span>)}
    </p>)}
  </div>;
}

function messageFor(error: Error): string {
  if (error instanceof ApiError && error.status === 409) {
    return "This deck changed in another session. The latest version was loaded; retry your change.";
  }
  return error.message;
}

function isPriceProvider(value: string): value is PriceProvider {
  return value === "tcgplayer" || value === "cardmarket" || value === "cardhoarder";
}

function storedPriceProvider(): PriceProvider {
  const stored = localStorage.getItem("survail.price-provider");
  return stored !== null && isPriceProvider(stored) ? stored : "tcgplayer";
}

function isImportPreferenceRule(value: object): value is ImportPreferenceRule {
  if (!("kind" in value) || typeof value.kind !== "string") return false;
  if (value.kind === "cheapest") {
    return "bufferPercent" in value && typeof value.bufferPercent === "number";
  }
  if (value.kind === "frame") {
    return "frame" in value && ["1993", "1997", "2003", "2015", "future"].includes(String(value.frame));
  }
  return ["original_printing", "non_universes_beyond", "foil", "nonfoil"].includes(value.kind);
}

function storedImportPreferences(): ImportPreferences {
  const stored = localStorage.getItem("survail.import-preferences");
  if (stored === null) return DEFAULT_IMPORT_PREFERENCES;
  try {
    const parsed = JSON.parse(stored) as { preserveTags?: boolean; rules?: object[] };
    if (
      typeof parsed.preserveTags !== "boolean"
      || !Array.isArray(parsed.rules)
      || parsed.rules.length !== 6
      || !parsed.rules.every(isImportPreferenceRule)
      || new Set(parsed.rules.map((rule) => rule.kind)).size !== 6
    ) {
      return DEFAULT_IMPORT_PREFERENCES;
    }
    return { preserveTags: parsed.preserveTags, rules: parsed.rules };
  } catch {
    return DEFAULT_IMPORT_PREFERENCES;
  }
}

function storedDeckDisplayPreferences(): DeckDisplayPreferences {
  const stored = localStorage.getItem("survail.deck-display-preferences");
  if (stored === null) return { view: "stacks", groupBy: "type", sortBy: "alphabetical" };
  try {
    const parsed = JSON.parse(stored) as { view?: string; groupBy?: string; sortBy?: string };
    const view = parsed.view;
    const groupBy = parsed.groupBy;
    const sortBy = parsed.sortBy;
    if (
      (view !== "stacks" && view !== "grid" && view !== "text")
      || (groupBy !== "type" && groupBy !== "color" && groupBy !== "mana-value")
      || (sortBy !== "alphabetical" && sortBy !== "mana-value" && sortBy !== "price")
    ) {
      return { view: "stacks", groupBy: "type", sortBy: "alphabetical" };
    }
    return { view, groupBy, sortBy };
  } catch {
    return { view: "stacks", groupBy: "type", sortBy: "alphabetical" };
  }
}

function displayPrice(card: ScryfallCard, finish: CardFinish, provider: PriceProvider): string | null {
  const prices = card.prices;
  if (prices === undefined) return null;
  if (provider === "cardmarket") {
    const value = finish === "foil" ? prices.eur_foil : prices.eur;
    return value === null ? null : `€${value}`;
  }
  if (provider === "cardhoarder") return prices.tix === null ? null : `${prices.tix} TIX`;
  const value = finish === "foil" ? prices.usd_foil : finish === "etched" ? prices.usd_etched : prices.usd;
  return value === null ? null : `$${value}`;
}

function numericPrice(card: ScryfallCard, finish: CardFinish, provider: PriceProvider): number {
  const displayed = displayPrice(card, finish, provider);
  if (displayed === null) return Number.POSITIVE_INFINITY;
  const parsed = Number.parseFloat(displayed.replaceAll(/[^0-9.]/g, ""));
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function primaryType(card: ScryfallCard): string {
  const types = ["Creature", "Land", "Instant", "Sorcery", "Artifact", "Enchantment", "Planeswalker", "Battle"];
  return types.find((type) => card.type_line.includes(type)) ?? "Other";
}

function colorLabel(card: ScryfallCard): string {
  const colors = card.colors ?? card.color_identity ?? [];
  if (colors.length === 0) return "Colorless";
  const names: Record<string, string> = {
    W: "White", U: "Blue", B: "Black", R: "Red", G: "Green",
  };
  return colors.map((color) => names[color] ?? color).join(" / ");
}

function groupLabel(card: CardSet, groupBy: GroupBy): string {
  if (groupBy === "color") return colorLabel(card.scryfall);
  if (groupBy === "mana-value") return `Mana Value ${String(card.scryfall.cmc ?? 0)}`;
  return primaryType(card.scryfall);
}

function groupedCards(cards: CardSet[], groupBy: GroupBy, sortBy: SortBy, provider: PriceProvider): CardGroup[] {
  const groups = new Map<string, CardSet[]>();
  cards.forEach((card) => {
    const label = groupLabel(card, groupBy);
    groups.set(label, [...(groups.get(label) ?? []), card]);
  });
  return [...groups.entries()].map(([label, groupCards]) => ({
    label,
    cards: [...groupCards].sort((left, right) => {
      if (sortBy === "mana-value") {
        return (left.scryfall.cmc ?? 0) - (right.scryfall.cmc ?? 0)
          || left.card_name.localeCompare(right.card_name);
      }
      if (sortBy === "price") {
        return numericPrice(left.scryfall, left.finish, provider)
          - numericPrice(right.scryfall, right.finish, provider)
          || left.card_name.localeCompare(right.card_name);
      }
      return left.card_name.localeCompare(right.card_name);
    }),
    quantity: groupCards.reduce((total, card) => total + card.quantity, 0),
  })).sort((left, right) => {
    if (groupBy === "mana-value") {
      return Number.parseFloat(left.label.replace("Mana Value ", ""))
        - Number.parseFloat(right.label.replace("Mana Value ", ""));
    }
    return left.label.localeCompare(right.label);
  });
}

function preferredFinish(card: ScryfallCard, current: CardFinish): CardFinish {
  if (card.finishes.some((finish) => finish === current)) return current;
  const available = card.finishes.find(isCardFinish);
  return available ?? "nonfoil";
}

function CardImage({
  card,
  alt,
  className,
}: {
  card: ScryfallCard;
  alt: string;
  className: string;
}) {
  const source = card.image_uris?.normal ?? card.card_faces[0]?.image_uris?.normal;
  return source === null || source === undefined ? (
    <div className={`${className} image-placeholder`}>No image</div>
  ) : (
    <img className={className} src={source} alt={alt} loading="lazy" />
  );
}

function Price({ card, finish }: { card: ScryfallCard; finish: CardFinish }) {
  const provider = useContext(PriceProviderContext);
  const price = displayPrice(card, finish, provider);
  return price === null ? null : <small className="price">{price}</small>;
}

function MaterialIcon({ name }: { name: string }) {
  return <span className="material-symbols-outlined" aria-hidden="true">{name}</span>;
}

function commanderEligible(card: ScryfallCard, format: DeckFormat): boolean {
  if (format !== "commander" && format !== "brawl") return false;
  const explicitlyEligible = card.oracle_text?.toLowerCase().includes("can be your commander") === true;
  const legendary = card.type_line.includes("Legendary");
  const creature = card.type_line.includes("Creature");
  const planeswalker = card.type_line.includes("Planeswalker");
  const background = card.type_line.includes("Background");
  return explicitlyEligible || background || (legendary && (creature || (format === "brawl" && planeswalker)));
}

function PrintingPicker({
  cardset,
  close,
  select,
}: {
  cardset: CardSet;
  close: () => void;
  select: (printing: ScryfallCard, finish: CardFinish) => void;
}) {
  const [printings, setPrintings] = useState<ScryfallCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const provider = useContext(PriceProviderContext);
  const dialogRef = useModalBehavior<HTMLElement>(true, close);

  useEffect(() => {
    async function loadPrintings(): Promise<void> {
      try {
        setPrintings(await api.printings(cardset.oracle_id));
      } catch (reason) {
        setError(reason instanceof Error ? messageFor(reason) : "Could not load printings");
      }
    }
    void loadPrintings();
  }, [cardset.oracle_id]);

  return <div className="modal-backdrop" onClick={close}>
    <section className="printing-picker" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="printing-picker-title" aria-describedby="printing-picker-description" aria-busy={printings.length === 0 && error === null} tabIndex={-1} onClick={(event) => { event.stopPropagation(); }}>
      <div className="page-heading">
        <div><h2 id="printing-picker-title">{cardset.card_name} printings</h2><p className="muted" id="printing-picker-description">Choose the edition and finish used in this deck.</p></div>
        <button className="icon-action" aria-label="Close printing picker" onClick={close}><MaterialIcon name="close" /></button>
      </div>
      {error !== null && <p className="notice error" role="alert">{error}</p>}
      {printings.length === 0 && error === null && <p role="status">Loading printings…</p>}
      <div className="printing-grid">
        {printings.map((printing) => {
          const finish = preferredFinish(printing, cardset.finish);
          const price = displayPrice(printing, finish, provider);
          const selected = printing.id === cardset.printing_id && finish === cardset.finish;
          return <button className={`printing-option${selected ? " selected" : ""}`} disabled={selected} key={printing.id} onClick={() => { select(printing, finish); }}>
            <CardImage card={printing} alt={printing.name} className="printing-image" />
            <strong>{printing.set_name}</strong>
            <small>{printing.set.toUpperCase()} · {finish}</small>
            <small>{printing.rarity} · {printing.released_at ?? "Release date unavailable"}</small>
            <small>{printing.frame === null || printing.frame === undefined ? "Frame unavailable" : `${printing.frame} frame`}{printing.universes_beyond === true ? " · Universes Beyond" : ""}</small>
            <small>{price ?? "Price unavailable"}</small>
          </button>;
        })}
      </div>
    </section>
  </div>;
}

function DeckCardImage({
  cardset,
  open,
  disabled,
}: {
  cardset: CardSet;
  open: () => void;
  disabled: boolean;
}) {
  return <div className="card-art">
    <CardImage card={cardset.scryfall} alt={cardset.card_name} className="card-image" />
    <button className="art-button" disabled={disabled} aria-label={`Choose printing for ${cardset.card_name}`} title="Choose printing" onClick={open}><MaterialIcon name="imagesmode" /></button>
  </div>;
}

function ImageCard({
  card,
  open,
  add,
  remove,
  markCommander,
  disabled,
  stacked,
  index,
}: {
  card: CardSet;
  open: () => void;
  add: () => void;
  remove: () => void;
  markCommander: (() => void) | null;
  disabled: boolean;
  stacked: boolean;
  index: number;
}) {
  return <div
    className={stacked ? "stacked-card" : "grid-card"}
    style={stacked ? { "--stack-index": index } as React.CSSProperties : undefined}
  >
    <DeckCardImage cardset={card} open={open} disabled={disabled} />
    <div className="card-quick-actions">
      <button disabled={disabled} aria-label={`Remove one ${card.card_name}`} onClick={remove}><MaterialIcon name="remove" /></button>
      <button disabled={disabled} aria-label={`Add one ${card.card_name}`} onClick={add}><MaterialIcon name="add" /></button>
      {markCommander !== null && <button disabled={disabled} aria-label={`Mark ${card.card_name} as commander`} onClick={markCommander}><MaterialIcon name="shield_person" /></button>}
    </div>
  </div>;
}

function VisualCardGroups({
  cards,
  view,
  groupBy,
  sortBy,
  format,
  openPrinting,
  addCard,
  removeCard,
  markCommander,
  busy,
}: {
  cards: CardSet[];
  view: Exclude<DeckView, "text">;
  groupBy: GroupBy;
  sortBy: SortBy;
  format: DeckFormat;
  openPrinting: (card: CardSet) => void;
  addCard: (card: CardSet) => void;
  removeCard: (card: CardSet) => void;
  markCommander: (card: CardSet) => void;
  busy: boolean;
}) {
  const provider = useContext(PriceProviderContext);
  return <div className={`visual-groups ${view}`}>
    {groupedCards(cards, groupBy, sortBy, provider).map((group) => <section className="visual-group" key={group.label}>
      <h3>{group.label} <small>{group.quantity}</small></h3>
      <div className={view === "stacks" ? "card-stacks" : "visual-card-grid"}>
        {group.cards.map((card) => Array.from({ length: card.quantity }, (_, index) => (
          <ImageCard
            card={card}
            add={() => { addCard(card); }}
            disabled={busy}
            index={index}
            key={`${card.id}-${String(index)}`}
            markCommander={card.zone !== "commander" && commanderEligible(card.scryfall, format) ? () => { markCommander(card); } : null}
            open={() => { openPrinting(card); }}
            remove={() => { removeCard(card); }}
            stacked={view === "stacks"}
          />
        )))}
      </div>
    </section>)}
  </div>;
}

function App() {
  const [user, setUser] = useState<string | null>(null);
  const [priceProvider, setPriceProvider] = useState<PriceProvider>(storedPriceProvider);

  useEffect(() => {
    void api.me().then(
      (authenticatedUser) => {
        setUser(authenticatedUser.display_name ?? authenticatedUser.username);
      },
      () => {
        setUser(null);
      },
    );
  }, []);

  function handleLogout(): void {
    void api.logout().then(() => {
      location.reload();
    });
  }

  function handlePriceProvider(event: ChangeEvent<HTMLSelectElement>): void {
    if (!isPriceProvider(event.target.value)) return;
    localStorage.setItem("survail.price-provider", event.target.value);
    setPriceProvider(event.target.value);
  }

  if (user === null) {
    return (
      <main className="login">
        <h1>Survail</h1>
        <p>Build and validate exact-printing MTG decks.</p>
        <a className="button" href={`${API}/auth/discord/login`}>
          Sign in with Discord
        </a>
      </main>
    );
  }

  return (
    <PriceProviderContext.Provider value={priceProvider}>
    <BrowserRouter>
      <header>
        <Link to="/decks"><strong>Survail</strong></Link>
        <label className="price-setting">Prices
          <select aria-label="Price marketplace" value={priceProvider} onChange={handlePriceProvider}>
            <option value="tcgplayer">TCGPlayer · USD</option>
            <option value="cardmarket">Cardmarket · EUR</option>
            <option value="cardhoarder">Cardhoarder · TIX</option>
          </select>
        </label>
        <span>{user}</span>
        <button onClick={handleLogout}>Log out</button>
      </header>
      <Routes>
        <Route path="*" element={<Library />} />
        <Route path="/decks/:id" element={<Editor />} />
      </Routes>
    </BrowserRouter>
    </PriceProviderContext.Provider>
  );
}

function Library() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<DeckFormat>("commander");
  const [decklist, setDecklist] = useState("");
  const [importPreferences, setImportPreferences] = useState<ImportPreferences>(storedImportPreferences);
  const [preview, setPreview] = useState<MoxfieldImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddDeck, setShowAddDeck] = useState(false);
  const [openDeckMenu, setOpenDeckMenu] = useState<string | null>(null);
  const [draggedPreference, setDraggedPreference] = useState<ImportPreferenceKind | null>(null);
  const [preferenceAnnouncement, setPreferenceAnnouncement] = useState("");
  const navigate = useNavigate();
  const addDeckButtonRef = useRef<HTMLButtonElement>(null);
  const closeAddDeck = useCallback(() => {
    setShowAddDeck(false);
    requestAnimationFrame(() => { addDeckButtonRef.current?.focus(); });
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
    localStorage.setItem("survail.import-preferences", JSON.stringify(importPreferences));
  }, [importPreferences]);

  useEffect(() => {
    if (openDeckMenu === null) return;
    function closeMenu(event: globalThis.KeyboardEvent): void {
      if (event.key === "Escape") setOpenDeckMenu(null);
    }
    document.addEventListener("keydown", closeMenu);
    return () => { document.removeEventListener("keydown", closeMenu); };
  }, [openDeckMenu]);

  function handleFormatChange(event: ChangeEvent<HTMLSelectElement>): void {
    if (isDeckFormat(event.target.value)) setFormat(event.target.value);
  }

  function movePreference(source: ImportPreferenceKind, target: ImportPreferenceKind): void {
    setImportPreferences((current) => {
      const rules = [...current.rules];
      const sourceIndex = rules.findIndex((rule) => rule.kind === source);
      const targetIndex = rules.findIndex((rule) => rule.kind === target);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return current;
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
        rule.kind === "cheapest" ? { ...rule, bufferPercent } : rule
      ),
    }));
  }

  function updateFrame(frame: Extract<ImportPreferenceRule, { kind: "frame" }>["frame"]): void {
    setImportPreferences((current) => ({
      ...current,
      rules: current.rules.map((rule) => rule.kind === "frame" ? { ...rule, frame } : rule),
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

  async function handlePreview(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
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
      const result = await api.createMoxfieldDeck(
        title.trim(),
        format,
        decklist,
        importPreferences,
      );
      void navigate(`/decks/${result.deck_id}`);
    } catch (reason) {
      setError(reason instanceof Error ? messageFor(reason) : "Request failed");
      setBusy(false);
    }
  }

  return (
    <main aria-busy={busy}>
      <div className="sr-only" aria-live="polite" aria-atomic="true">{busy ? "Working" : ""}</div>
      <div className="sr-only" aria-live="polite" aria-atomic="true">{preferenceAnnouncement}</div>
      <section className="page-heading">
        <div><h1>Your decks</h1><p>Build a new deck or import from Moxfield.</p></div>
        <button ref={addDeckButtonRef} onClick={() => { setShowAddDeck(true); }}>Add Deck</button>
      </section>
      {error !== null && <p className="notice error" role="alert">{error}</p>}
      <section className="import-panel">
        <div className="import-settings">
          <h2>Import Moxfield decklist</h2>
          <p className="muted">Paste an exported list. Imported cards begin in the Mainboard; move commanders and sideboard cards after creation.</p>
          <form className="import-form" onSubmit={(event) => void handlePreview(event)}>
            <div className="import-settings-scroll stack">
              <label>Deck title<input maxLength={120} required value={title} onChange={(event) => { setTitle(event.target.value); }} /></label>
              <label>Format<select required value={format} onChange={handleFormatChange}>{DECK_FORMATS.map((deckFormat) => <option key={deckFormat}>{deckFormat}</option>)}</select></label>
              <label>Decklist<textarea value={decklist} onChange={(event) => { setDecklist(event.target.value); }} placeholder={"1 Arcane Signet (CMM) 379\n1 Sol Ring (CMM) 396"} required /></label>
              <fieldset className="import-options">
                <legend>Printing priority</legend>
                <p className="muted">Drag rules into priority order. Each rule falls through when it cannot choose between available printings.</p>
                <div className="preference-list" role="list" aria-label="Printing preference priority">
                  {importPreferences.rules.map((rule, index) => <div
                    className="preference-rule"
                    draggable
                    key={rule.kind}
                    role="listitem"
                    aria-label={`${String(index + 1)}. ${PREFERENCE_LABELS[rule.kind]}`}
                    onDragStart={() => { setDraggedPreference(rule.kind); }}
                    onDragEnd={() => { setDraggedPreference(null); }}
                    onDragOver={(event) => { event.preventDefault(); }}
                    onDrop={() => { if (draggedPreference !== null) movePreference(draggedPreference, rule.kind); }}
                  >
                    <span className="drag-handle" aria-hidden="true">⋮⋮</span>
                    <strong>{String(index + 1)}. {PREFERENCE_LABELS[rule.kind]}</strong>
                    {rule.kind === "cheapest" && <label>Price buffer
                      <span><input type="number" min="0" max="100" value={rule.bufferPercent} onChange={(event) => { updateCheapestBuffer(Number(event.target.value)); }} />%</span>
                    </label>}
                    {rule.kind === "frame" && <label>Style
                      <select value={rule.frame} onChange={(event) => { updateFrame(event.target.value as Extract<ImportPreferenceRule, { kind: "frame" }>["frame"]); }}>
                        <option value="1993">Original (1993)</option><option value="1997">Classic (1997)</option><option value="2003">Modern (2003)</option><option value="2015">M15/current (2015)</option><option value="future">Future</option>
                      </select>
                    </label>}
                    <div className="priority-buttons">
                      <button type="button" disabled={index === 0} aria-label={`Move ${PREFERENCE_LABELS[rule.kind]} up`} onClick={() => { const previous = importPreferences.rules[index - 1]; if (previous !== undefined) movePreference(rule.kind, previous.kind); }}>↑</button>
                      <button type="button" disabled={index === importPreferences.rules.length - 1} aria-label={`Move ${PREFERENCE_LABELS[rule.kind]} down`} onClick={() => { const next = importPreferences.rules[index + 1]; if (next !== undefined) movePreference(rule.kind, next.kind); }}>↓</button>
                    </div>
                  </div>)}
                </div>
                <label><input type="checkbox" checked={importPreferences.preserveTags} onChange={(event) => { setImportPreferences((current) => ({ ...current, preserveTags: event.target.checked })); }} /> Preserve tags</label>
              </fieldset>
            </div>
            <footer className="import-actions"><button disabled={busy}>{busy ? "Resolving…" : "Preview import"}</button></footer>
          </form>
        </div>
        <div className="import-preview">
          <header className="import-preview-header"><h2>Resolved preview</h2>{preview !== null && <p>{preview.cardsets.reduce((total, card) => total + card.quantity, 0)} cards · {preview.cardsets.length} unique cards</p>}</header>
          <div className="import-preview-scroll">
            {preview === null && <p className="muted">Preview the import to review selected printings.</p>}
            {preview !== null && preview.errors.length > 0 && <div className="notice error" role="alert"><strong>{preview.errors.length} lines need attention</strong>{preview.errors.map((issue) => <p key={`${String(issue.line_number)}-${issue.code}`}><strong>Line {issue.line_number}: {titleize(issue.code)}</strong><br />{issue.message}<br /><small>{issue.raw_line}</small></p>)}</div>}
            {preview !== null && <div className="preview-grid">
              {preview.cardsets.map((card) => (
                <article className="preview-card" key={`${card.printing_id}-${card.finish}-${card.zone}`}>
                  <CardImage card={card.scryfall} alt={card.card_name} className="preview-image" />
                  <strong>{card.quantity}× {card.card_name}</strong>
                  <small>{zoneLabel(card.zone)} · {card.set_code.toUpperCase()}</small>
                  <Price card={card.scryfall} finish={card.finish} />
                  {card.tags.length > 0 && <small>{card.tags.join(" · ")}</small>}
                </article>
              ))}
            </div>}
          </div>
          <footer className="import-actions"><button disabled={busy || preview === null || preview.errors.length > 0 || title.trim() === ""} onClick={() => void createImportedDeck()}>Create imported deck</button></footer>
        </div>
      </section>
      <section className="deck-grid">
        {decks.map((deck) => (
          <article className="deck-card" key={deck.id}>
            <button className="kebab-button" aria-label={`Actions for ${deck.title}`} aria-expanded={openDeckMenu === deck.id} aria-controls={`deck-menu-${deck.id}`} aria-haspopup="menu" onClick={() => { setOpenDeckMenu((current) => current === deck.id ? null : deck.id); }}>•••</button>
            {openDeckMenu === deck.id && <div className="deck-menu" id={`deck-menu-${deck.id}`} role="menu"><button autoFocus className="danger" role="menuitem" onClick={() => void deleteDeck(deck)}>Delete deck</button></div>}
            <Link className="deck-card-link" to={`/decks/${deck.id}`}>
              <div className="deck-cover">
                {deck.cardsets.slice(0, 3).map((card) => (
                  <CardImage key={card.id} card={card.scryfall} alt={card.card_name} className="cover-image" />
                ))}
              </div>
              <h2>{deck.title}</h2>
              <p>{deck.format} · {deck.cardsets.reduce((total, card) => total + card.quantity, 0)} cards</p>
              <small>Updated {new Date(deck.updated_at).toLocaleString()}</small>
            </Link>
          </article>
        ))}
      </section>
      {showAddDeck && <div className="modal-backdrop" onClick={closeAddDeck}>
        <form className="add-deck-modal stack" ref={addDeckDialogRef} role="dialog" aria-modal="true" aria-labelledby="add-deck-title" aria-describedby="add-deck-description" tabIndex={-1} onSubmit={(event) => { event.preventDefault(); void handleCreateDeck(); }} onClick={(event) => { event.stopPropagation(); }}>
          <div className="page-heading"><h2 id="add-deck-title">Add Deck</h2><button className="icon-action" type="button" aria-label="Close add deck dialog" onClick={closeAddDeck}><MaterialIcon name="close" /></button></div>
          <p className="muted" id="add-deck-description">Choose a title and format to create an empty deck.</p>
          <label>Title<input autoFocus maxLength={120} required value={title} onChange={(event) => { setTitle(event.target.value); }} /></label>
          <label>Format<select required value={format} onChange={handleFormatChange}>{DECK_FORMATS.map((deckFormat) => <option key={deckFormat}>{deckFormat}</option>)}</select></label>
          <button disabled={busy || title.trim() === ""}>Create deck</button>
        </form>
      </div>}
    </main>
  );
}

function Editor() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const priceProvider = useContext(PriceProviderContext);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [operations, setOperations] = useState<DeckOperation[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ScryfallCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [printingCardset, setPrintingCardset] = useState<CardSet | null>(null);
  const [displayPreferences, setDisplayPreferences] = useState<DeckDisplayPreferences>(storedDeckDisplayPreferences);
  const { view: deckView, groupBy, sortBy } = displayPreferences;
  const [printingPreferences] = useState<ImportPreferences>(storedImportPreferences);
  const [showHistory, setShowHistory] = useState(false);
  const [showEditDeck, setShowEditDeck] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const editDeckDialogRef = useModalBehavior<HTMLFormElement>(
    showEditDeck,
    () => { setShowEditDeck(false); },
  );
  const historyDialogRef = useModalBehavior<HTMLElement>(
    showHistory,
    () => { setShowHistory(false); },
  );
  const overviewDialogRef = useModalBehavior<HTMLElement>(
    showOverview,
    () => { setShowOverview(false); },
  );
  const searchDrawerRef = useDismissibleSurface<HTMLElement>(
    showSearchResults,
    () => { setShowSearchResults(false); },
  );

  const loadDeck = useCallback(async (): Promise<void> => {
    const [loadedDeck, loadedValidation, loadedOperations] = await Promise.all([
      api.deck(id), api.validation(id), api.operations(id),
    ]);
    setDeck(loadedDeck);
    setTitle(loadedDeck.title);
    setDescription(loadedDeck.description);
    setValidation(loadedValidation);
    setOperations(loadedOperations);
  }, [id]);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        await loadDeck();
      } catch (reason) {
        setError(reason instanceof Error ? messageFor(reason) : "Request failed");
      }
    }
    void load();
  }, [loadDeck]);

  useEffect(() => {
    localStorage.setItem("survail.deck-display-preferences", JSON.stringify(displayPreferences));
  }, [displayPreferences]);

  function applyChanges(changes: DeckOperationChangeInput[], reason: string): void {
    if (deck === null || busy) return;
    const revision = deck.revision;
    setBusy(true);
    setError(null);
    async function apply(): Promise<void> {
      try {
        const result = await api.applyOperation(id, revision, changes, reason);
        setDeck(result.deck);
        setValidation(result.validation);
        setOperations(await api.operations(id));
        setAnnouncement(reason);
      } catch (caught) {
        setError(caught instanceof Error ? messageFor(caught) : "Request failed");
        if (caught instanceof ApiError && caught.status === 409) await loadDeck();
      } finally {
        setBusy(false);
      }
    }
    void apply();
  }

  async function handleSearch(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (deck === null) return;
    setError(null);
    try {
      const response = await api.search(queryForDeckFormat(query, deck.format), printingPreferences);
      setResults(response.cards);
      setShowSearchResults(true);
      setAnnouncement(`${String(response.cards.length)} cards found`);
    } catch (reason) {
      setError(reason instanceof Error ? messageFor(reason) : "Request failed");
    }
  }

  async function handleSaveDetails(event: SyntheticEvent<HTMLFormElement>): Promise<boolean> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setDeck(await api.updateDeck(id, title, description));
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

  async function handleGenerateDescription(): Promise<void> {
    if (deck === null || busy) return;
    setBusy(true);
    setError(null);
    try {
      const generated = await api.generateDescription(deck.id, deck.description !== "");
      const updatedDeck = await api.updateDeck(deck.id, deck.title, generated.description);
      setDeck(updatedDeck);
      setDescription(generated.description);
      setAnnouncement(generated.cached ? "Cached deck overview loaded" : "Deck overview generated");
    } catch (reason) {
      setError(reason instanceof Error ? messageFor(reason) : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevert(operation: DeckOperation): Promise<void> {
    if (deck === null || busy || !confirm(`Undo change ${String(operation.revision_after)}?`)) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.revertOperation(deck.id, operation.id, deck.revision);
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

  function changePrinting(cardset: CardSet, printing: ScryfallCard, finish: CardFinish): void {
    applyChanges([
      { printing_id: cardset.printing_id, quantity_delta: -cardset.quantity, zone: cardset.zone, finish: cardset.finish },
      { printing_id: printing.id, quantity_delta: cardset.quantity, zone: cardset.zone, finish, tags: cardset.tags },
    ], `Change ${cardset.card_name} printing`);
    setPrintingCardset(null);
  }

  function changeQuantity(cardset: CardSet, quantityDelta: number): void {
    applyChanges(
      [{ printing_id: cardset.printing_id, quantity_delta: quantityDelta, zone: cardset.zone, finish: cardset.finish, tags: cardset.tags }],
      `${quantityDelta > 0 ? "Add" : "Remove"} ${cardset.card_name}`,
    );
  }

  function markAsCommander(cardset: CardSet): void {
    applyChanges([
      { printing_id: cardset.printing_id, quantity_delta: -1, zone: cardset.zone, finish: cardset.finish },
      { printing_id: cardset.printing_id, quantity_delta: 1, zone: "commander", finish: cardset.finish, tags: cardset.tags },
    ], `Set ${cardset.card_name} as commander`);
  }

  if (deck === null) return <main>{error ?? "Loading…"}</main>;

  return (
    <main className="editor" aria-busy={busy}>
      <h1 className="sr-only">{deck.title}</h1>
      <div className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</div>
      <section className="deck-editor">
        {error !== null && <p className="notice error" role="alert">{error}</p>}
        <div className="view-toolbar" aria-label="Deck display options">
          <label>View<select value={deckView} onChange={(event) => { setDisplayPreferences((current) => ({ ...current, view: event.target.value as DeckView })); }}>
            <option value="stacks">Card Stacks</option><option value="grid">Card Grid</option><option value="text">Text</option>
          </select></label>
          <label>Group by<select value={groupBy} onChange={(event) => { setDisplayPreferences((current) => ({ ...current, groupBy: event.target.value as GroupBy })); }}>
            <option value="type">Type</option><option value="color">Color</option><option value="mana-value">Mana Value</option>
          </select></label>
          <label>Sort by<select value={sortBy} onChange={(event) => { setDisplayPreferences((current) => ({ ...current, sortBy: event.target.value as SortBy })); }}>
            <option value="alphabetical">Alphabetical</option><option value="mana-value">Mana Value</option><option value="price">Price</option>
          </select></label>
        </div>
        {zonesFor(deck.format).map((zone) => {
          const cards = deck.cardsets.filter((card) => card.zone === zone);
          const groups = groupedCards(cards, groupBy, sortBy, priceProvider);
          if (cards.length === 0 && zone !== "mainboard") return null;
          return <section className="zone" key={zone}><h2>{zoneLabel(zone)} <small>{cards.reduce((total, card) => total + card.quantity, 0)}</small></h2>
            {deckView === "text"
              ? <div className="text-groups">{groups.map((group) => <section key={group.label}><h3>{group.label} <small>{group.quantity}</small></h3><div className="card-grid">{group.cards.map((card) => (
                <article className="card-row" key={card.id}>
                  <strong>{card.card_name}</strong>
                  <div className="inline-quantity">
                    <button disabled={busy} aria-label={`Remove one ${card.card_name}`} title="Remove one" onClick={() => { changeQuantity(card, -1); }}><MaterialIcon name="remove" /></button>
                    <span>{card.quantity}</span>
                    <button disabled={busy} aria-label={`Add one ${card.card_name}`} title="Add one" onClick={() => { changeQuantity(card, 1); }}><MaterialIcon name="add" /></button>
                  </div>
                </article>
                ))}</div></section>)}</div>
              : <VisualCardGroups cards={cards} view={deckView} groupBy={groupBy} sortBy={sortBy} format={deck.format} openPrinting={(card) => { setPrintingCardset(card); }} addCard={(card) => { changeQuantity(card, 1); }} removeCard={(card) => { changeQuantity(card, -1); }} markCommander={markAsCommander} busy={busy} />}
          </section>;
        })}
      </section>
      <footer className="deck-footer">
        <div className="deck-readonly-details">
          <strong>{deck.title}</strong>
          <span>{deck.description || "No description"}</span>
          <span className="pill">{deck.format}</span>
        </div>
        <button className="icon-action" aria-label="Edit deck details" title="Edit deck details" onClick={() => { setShowEditDeck(true); }}><MaterialIcon name="edit" /></button>
        <form className="card-search" onSubmit={(event) => void handleSearch(event)}>
          <input aria-label="Card search" value={query} onChange={(event) => { setQuery(event.target.value); }} placeholder="Search cards" />
          <button className="icon-action" aria-label="Search" title="Search"><MaterialIcon name="search" /></button>
        </form>
        <details className="validation-menu">
          <summary className={validation?.valid === true ? "validation-summary valid" : "validation-summary invalid"} aria-label={`${validation?.valid === true ? "Valid deck" : "Deck needs attention"}, ${String(validation?.card_count ?? 0)} cards`}>
            {validation?.valid === true
              ? <MaterialIcon name="check" />
              : <>Needs attention · {validation?.card_count ?? 0}</>}
          </summary>
          <div className="subheader-menu">
            {validation?.errors.length === 0 && <p>No validation errors.</p>}
            {groupedValidationErrors(validation).map((group) => <details className="validation-error-group" key={group.errorId}>
              <summary><strong>{titleize(group.errorId)}</strong><span>{group.errors.length}</span></summary>
              <div>
                {group.errors.map((validationError, index) => <p key={`${validationError.error_id}-${String(index)}`}>{validationError.message}</p>)}
              </div>
            </details>)}
          </div>
        </details>
        <button className="icon-action" aria-label="Deck overview" title="Deck overview" onClick={() => { setShowOverview(true); }}><MaterialIcon name="auto_awesome" /></button>
        <button className="icon-action" aria-label="History" title="History" onClick={() => { setShowHistory(true); }}><MaterialIcon name="history" /></button>
        <button className="icon-action danger" aria-label="Delete deck" title="Delete deck" onClick={() => void handleDelete()}><MaterialIcon name="delete" /></button>
      </footer>
      {showSearchResults && <aside className="search-drawer" ref={searchDrawerRef} role="dialog" aria-modal="false" aria-labelledby="search-results-title" tabIndex={-1}>
        <div className="page-heading"><div><h2 id="search-results-title">Search results</h2><p>{results.length} cards found</p></div><button className="icon-action" aria-label="Close search results" onClick={() => { setShowSearchResults(false); }}><MaterialIcon name="close" /></button></div>
        {results.length === 0 && <p className="muted" role="status">No cards matched this search.</p>}
        <div className="search-drawer-grid">
          {results.slice(0, 60).map((card) => (
            <article className="search-result" key={card.id}>
              <CardImage card={card} alt={card.name} className="search-image" />
              <div><strong>{card.name}</strong><small>{card.set.toUpperCase()}</small>
                <Price card={card} finish={preferredFinish(card, "nonfoil")} />
                <div className="button-row">
                  {card.finishes.filter(isCardFinish).map((finish) => (
                    <button disabled={busy} key={finish} onClick={() => { applyChanges([{ printing_id: card.id, quantity_delta: 1, zone: "mainboard", finish }], `Add ${card.name}`); }}><MaterialIcon name="add" /> {finish}</button>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </aside>}
      {showEditDeck && <div className="modal-backdrop" onClick={() => { setShowEditDeck(false); }}>
        <form className="add-deck-modal stack" ref={editDeckDialogRef} role="dialog" aria-modal="true" aria-labelledby="edit-deck-title" aria-describedby="edit-deck-description" tabIndex={-1} onSubmit={(event) => { event.preventDefault(); void handleSaveDetails(event).then((saved) => { if (saved) setShowEditDeck(false); }); }} onClick={(event) => { event.stopPropagation(); }}>
          <div className="page-heading"><h2 id="edit-deck-title">Edit deck</h2><button className="icon-action" type="button" aria-label="Close" onClick={() => { setShowEditDeck(false); }}><MaterialIcon name="close" /></button></div>
          <p className="muted" id="edit-deck-description">Update the deck title or description.</p>
          <label>Title<input autoFocus maxLength={120} required value={title} onChange={(event) => { setTitle(event.target.value); }} /></label>
          <label>Description<textarea value={description} onChange={(event) => { setDescription(event.target.value); }} /></label>
          <label>Format<input readOnly value={deck.format} /></label>
          <button disabled={busy}>Save changes</button>
        </form>
      </div>}
      {showOverview && <div className="modal-backdrop" onClick={() => { setShowOverview(false); }}>
        <section className="overview-modal" ref={overviewDialogRef} role="dialog" aria-modal="true" aria-labelledby="overview-title" aria-describedby="overview-description" tabIndex={-1} onClick={(event) => { event.stopPropagation(); }}>
          <div className="page-heading">
            <div><h2 id="overview-title">Deck overview</h2><p className="muted" id="overview-description">An AI-generated explanation based on this deck's cards and format.</p></div>
            <button className="icon-action" aria-label="Close deck overview" onClick={() => { setShowOverview(false); }}><MaterialIcon name="close" /></button>
          </div>
          {deck.description
            ? <GeneratedDescription description={deck.description} cards={deck.cardsets} />
            : <div className="generated-description" aria-live="polite"><p className="muted">Generate an overview to explain the deck's plan, synergies, interaction, and weaknesses.</p></div>}
          <button className="generate-description" disabled={busy} onClick={() => void handleGenerateDescription()}>
            <MaterialIcon name="auto_awesome" />
            {busy ? "Generating overview…" : deck.description ? "Refresh overview" : "Generate overview"}
          </button>
        </section>
      </div>}
      {showHistory && <div className="modal-backdrop" onClick={() => { setShowHistory(false); }}>
        <section className="history-modal" ref={historyDialogRef} role="dialog" aria-modal="true" aria-labelledby="history-title" aria-describedby="history-description" tabIndex={-1} onClick={(event) => { event.stopPropagation(); }}>
          <div className="page-heading"><div><h2 id="history-title">Deck history</h2><p id="history-description">{operations.length} recorded changes</p></div><button className="icon-action" aria-label="Close deck history" onClick={() => { setShowHistory(false); }}><MaterialIcon name="close" /></button></div>
          <div className="history-list">
            {operations.length === 0 && <p className="muted">No changes have been recorded.</p>}
            {operations.map((operation) => <article className="history-entry" key={operation.id}><strong>Change {operation.revision_after}</strong><small>{new Date(operation.created_at).toLocaleString()}</small><p>{operation.reason ?? "Deck update"}</p>{operation.changes.map((change, index) => <small key={`${change.printing_id}-${String(index)}`}>{change.quantity_delta > 0 ? "+" : ""}{change.quantity_delta} {change.card_name} ({zoneLabel(change.zone)})</small>)}<button disabled={busy} onClick={() => void handleRevert(operation)}>Undo</button></article>)}
          </div>
        </section>
      </div>}
      {printingCardset !== null && <PrintingPicker cardset={printingCardset} close={() => { setPrintingCardset(null); }} select={(printing, finish) => { changePrinting(printingCardset, printing, finish); }} />}
    </main>
  );
}

const rootElement = document.getElementById("root");
if (rootElement === null) throw new Error("Root element was not found");
createRoot(rootElement).render(<React.StrictMode><App /></React.StrictMode>);
