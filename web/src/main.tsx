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
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import { API, ApiError, api } from "./api";
import {
  CardPresentationProvider,
  ClickableCardImage,
  InlineCardText,
} from "./CardPresentation";

import type {
  AgentUiEvent,
  CardRoleEvaluation,
  CardRole,
  CardEvaluationProgress,
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
type EditorView = "cards" | "scores" | "info";
type GroupBy = "type" | "color" | "mana-value";
type SortBy = "alphabetical" | "mana-value" | "price" | "score";
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
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => {
      const surface = surfaceRef.current;
      const initialFocus =
        surface?.querySelector<HTMLElement>("[autofocus]") ??
        surface?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
        surface;
      initialFocus?.focus();
    });

    function handleKeyDown(event: globalThis.KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || surfaceRef.current === null) return;
      const focusable = [
        ...surfaceRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ];
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
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const frame = requestAnimationFrame(() => {
      surfaceRef.current?.focus();
    });
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

function decklistText(deck: Deck): string {
  const zoneOrder: readonly CardZone[] = [
    "commander",
    "mainboard",
    "sideboard",
    "companion",
    "considering",
  ];
  return zoneOrder
    .map((zone) => {
      const cards = deck.cardsets
        .filter((card) => card.zone === zone)
        .sort((left, right) => left.card_name.localeCompare(right.card_name));
      if (cards.length === 0) return "";
      const lines = cards.map((card) => {
        const foil = card.finish === "foil" ? " *F*" : "";
        return `${String(card.quantity)} ${card.card_name} (${card.set_code.toUpperCase()}) ${card.collector_number}${foil}`;
      });
      return `${zoneLabel(zone)}\n${lines.join("\n")}`;
    })
    .filter((section) => section !== "")
    .join("\n\n");
}

function bulkEditChanges(
  deck: Deck,
  preview: MoxfieldImportPreview,
): DeckOperationChangeInput[] {
  const identity = (
    printingId: string,
    finish: CardFinish,
    zone: CardZone,
  ): string => `${printingId}:${finish}:${zone}`;
  const existing = new Map(
    deck.cardsets.map((card) => [
      identity(card.printing_id, card.finish, card.zone),
      card,
    ]),
  );
  const desired = new Map(
    preview.cardsets.map((card) => [
      identity(card.printing_id, card.finish, card.zone),
      card,
    ]),
  );
  const changes: DeckOperationChangeInput[] = [];
  for (const [key, card] of existing) {
    const quantity = desired.get(key)?.quantity ?? 0;
    if (quantity !== card.quantity) {
      changes.push({
        printing_id: card.printing_id,
        quantity_delta: quantity - card.quantity,
        zone: card.zone,
        finish: card.finish,
      });
    }
  }
  for (const [key, card] of desired) {
    if (existing.has(key)) continue;
    changes.push({
      printing_id: card.printing_id,
      quantity_delta: card.quantity,
      zone: card.zone,
      finish: card.finish,
    });
  }
  return changes;
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

function groupedValidationErrors(
  validation: Validation | null,
): ValidationErrorGroup[] {
  const groups = new Map<string, Validation["errors"]>();
  for (const error of validation?.errors ?? []) {
    groups.set(error.error_id, [...(groups.get(error.error_id) ?? []), error]);
  }
  return [...groups.entries()].map(([errorId, errors]) => ({
    errorId,
    errors,
  }));
}

function visibleStreamingText(text: string): string {
  const open = text.lastIndexOf("[[");
  const close = text.lastIndexOf("]]");
  return open > close ? text.slice(0, open) : text;
}

function streamedAgentText(events: AgentUiEvent[], runId: string): string {
  let text = "";
  for (const event of events) {
    if (event.run_id === runId && event.type === "assistant_text_delta") {
      text += event.payload.delta;
    }
  }
  return text;
}

function isAgentActivityEvent(event: AgentUiEvent): event is Extract<
  AgentUiEvent,
  {
    type:
      | "run_started"
      | "status"
      | "model_started"
      | "heartbeat"
      | "tool_started"
      | "tool_completed";
  }
> {
  return (
    event.type === "run_started" ||
    event.type === "status" ||
    event.type === "model_started" ||
    event.type === "heartbeat" ||
    event.type === "tool_started" ||
    event.type === "tool_completed"
  );
}

function GeneratedDescription({
  description,
  cards,
}: {
  description: string;
  cards: CardSet[];
}) {
  const lines = description.split("\n");
  return (
    <div className="generated-description" aria-live="polite">
      {lines.map((line, index) => {
        if (line.startsWith("# ")) {
          return (
            <h3 key={String(index)}>
              <InlineCardText cards={cards} text={line.slice(2)} />
            </h3>
          );
        }
        if (line.startsWith("- ")) {
          return (
            <div className="gameplan-item" key={String(index)}>
              <MaterialIcon name="arrow_right" />
              <p>
                <InlineCardText cards={cards} text={line.slice(2)} />
              </p>
            </div>
          );
        }
        if (line.trim() === "") return null;
        return (
          <p key={String(index)}>
            <InlineCardText cards={cards} text={line} />
          </p>
        );
      })}
    </div>
  );
}

function messageFor(error: Error): string {
  if (error instanceof ApiError && error.status === 409) {
    return "This deck changed in another session. The latest version was loaded; retry your change.";
  }
  return error.message;
}

function isPriceProvider(value: string): value is PriceProvider {
  return (
    value === "tcgplayer" || value === "cardmarket" || value === "cardhoarder"
  );
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
    return (
      "frame" in value &&
      ["1993", "1997", "2003", "2015", "future"].includes(String(value.frame))
    );
  }
  return [
    "original_printing",
    "non_universes_beyond",
    "foil",
    "nonfoil",
  ].includes(value.kind);
}

function storedImportPreferences(): ImportPreferences {
  const stored = localStorage.getItem("survail.import-preferences");
  if (stored === null) return DEFAULT_IMPORT_PREFERENCES;
  try {
    const parsed = JSON.parse(stored) as {
      preserveTags?: boolean;
      rules?: object[];
    };
    if (
      typeof parsed.preserveTags !== "boolean" ||
      !Array.isArray(parsed.rules) ||
      parsed.rules.length !== 6 ||
      !parsed.rules.every(isImportPreferenceRule) ||
      new Set(parsed.rules.map((rule) => rule.kind)).size !== 6
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
  if (stored === null)
    return { view: "stacks", groupBy: "type", sortBy: "alphabetical" };
  try {
    const parsed = JSON.parse(stored) as {
      view?: string;
      groupBy?: string;
      sortBy?: string;
    };
    const view = parsed.view;
    const groupBy = parsed.groupBy;
    const sortBy = parsed.sortBy;
    if (
      (view !== "stacks" && view !== "grid" && view !== "text") ||
      (groupBy !== "type" && groupBy !== "color" && groupBy !== "mana-value") ||
      (sortBy !== "alphabetical" &&
        sortBy !== "mana-value" &&
        sortBy !== "price" &&
        sortBy !== "score")
    ) {
      return { view: "stacks", groupBy: "type", sortBy: "alphabetical" };
    }
    return { view, groupBy, sortBy };
  } catch {
    return { view: "stacks", groupBy: "type", sortBy: "alphabetical" };
  }
}

function displayPrice(
  card: ScryfallCard,
  finish: CardFinish,
  provider: PriceProvider,
): string | null {
  const prices = card.prices;
  if (prices === undefined) return null;
  if (provider === "cardmarket") {
    const value = finish === "foil" ? prices.eur_foil : prices.eur;
    return value === null ? null : `€${value}`;
  }
  if (provider === "cardhoarder")
    return prices.tix === null ? null : `${prices.tix} TIX`;
  const value =
    finish === "foil"
      ? prices.usd_foil
      : finish === "etched"
        ? prices.usd_etched
        : prices.usd;
  return value === null ? null : `$${value}`;
}

function numericPrice(
  card: ScryfallCard,
  finish: CardFinish,
  provider: PriceProvider,
): number {
  const displayed = displayPrice(card, finish, provider);
  if (displayed === null) return Number.POSITIVE_INFINITY;
  const parsed = Number.parseFloat(displayed.replaceAll(/[^0-9.]/g, ""));
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function primaryType(card: ScryfallCard): string {
  const types = [
    "Creature",
    "Land",
    "Instant",
    "Sorcery",
    "Artifact",
    "Enchantment",
    "Planeswalker",
    "Battle",
  ];
  return types.find((type) => card.type_line.includes(type)) ?? "Other";
}

function colorLabel(card: ScryfallCard): string {
  const colors = card.colors ?? card.color_identity ?? [];
  if (colors.length === 0) return "Colorless";
  const names: Record<string, string> = {
    W: "White",
    U: "Blue",
    B: "Black",
    R: "Red",
    G: "Green",
  };
  return colors.map((color) => names[color] ?? color).join(" / ");
}

function groupLabel(card: CardSet, groupBy: GroupBy): string {
  if (groupBy === "color") return colorLabel(card.scryfall);
  if (groupBy === "mana-value")
    return `Mana Value ${String(card.scryfall.cmc ?? 0)}`;
  return primaryType(card.scryfall);
}

function groupedCards(
  cards: CardSet[],
  groupBy: GroupBy,
  sortBy: SortBy,
  provider: PriceProvider,
  scores: ReadonlyMap<string, CardRoleEvaluation>,
): CardGroup[] {
  const groups = new Map<string, CardSet[]>();
  cards.forEach((card) => {
    const label = groupLabel(card, groupBy);
    groups.set(label, [...(groups.get(label) ?? []), card]);
  });
  return [...groups.entries()]
    .map(([label, groupCards]) => ({
      label,
      cards: [...groupCards].sort((left, right) => {
        if (sortBy === "mana-value") {
          return (
            (left.scryfall.cmc ?? 0) - (right.scryfall.cmc ?? 0) ||
            left.card_name.localeCompare(right.card_name)
          );
        }
        if (sortBy === "price") {
          return (
            numericPrice(left.scryfall, left.finish, provider) -
              numericPrice(right.scryfall, right.finish, provider) ||
            left.card_name.localeCompare(right.card_name)
          );
        }
        if (sortBy === "score") {
          return (
            (scores.get(right.oracle_id)?.overall_score ?? -1) -
              (scores.get(left.oracle_id)?.overall_score ?? -1) ||
            left.card_name.localeCompare(right.card_name)
          );
        }
        return left.card_name.localeCompare(right.card_name);
      }),
      quantity: groupCards.reduce((total, card) => total + card.quantity, 0),
    }))
    .sort((left, right) => {
      if (groupBy === "mana-value") {
        return (
          Number.parseFloat(left.label.replace("Mana Value ", "")) -
          Number.parseFloat(right.label.replace("Mana Value ", ""))
        );
      }
      return left.label.localeCompare(right.label);
    });
}

function preferredFinish(card: ScryfallCard, current: CardFinish): CardFinish {
  if (card.finishes.some((finish) => finish === current)) return current;
  const available = card.finishes.find(isCardFinish);
  return available ?? "nonfoil";
}

function ScrollToTop() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.pathname]);
  return null;
}

function Price({ card, finish }: { card: ScryfallCard; finish: CardFinish }) {
  const provider = useContext(PriceProviderContext);
  const price = displayPrice(card, finish, provider);
  return price === null ? null : <small className="price">{price}</small>;
}

function MaterialIcon({ name }: { name: string }) {
  return (
    <span className="material-symbols-outlined" aria-hidden="true">
      {name}
    </span>
  );
}

function commanderEligible(card: ScryfallCard, format: DeckFormat): boolean {
  if (format !== "commander" && format !== "brawl") return false;
  const explicitlyEligible =
    card.oracle_text?.toLowerCase().includes("can be your commander") === true;
  const legendary = card.type_line.includes("Legendary");
  const creature = card.type_line.includes("Creature");
  const planeswalker = card.type_line.includes("Planeswalker");
  const background = card.type_line.includes("Background");
  return (
    explicitlyEligible ||
    background ||
    (legendary && (creature || (format === "brawl" && planeswalker)))
  );
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
        setError(
          reason instanceof Error
            ? messageFor(reason)
            : "Could not load printings",
        );
      }
    }
    void loadPrintings();
  }, [cardset.oracle_id]);

  return (
    <div className="modal-backdrop" onClick={close}>
      <section
        className="printing-picker"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="printing-picker-title"
        aria-describedby="printing-picker-description"
        aria-busy={printings.length === 0 && error === null}
        tabIndex={-1}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="page-heading">
          <div>
            <h2 id="printing-picker-title">{cardset.card_name} printings</h2>
            <p className="muted" id="printing-picker-description">
              Choose the edition and finish used in this deck.
            </p>
          </div>
          <button
            className="icon-action"
            aria-label="Close printing picker"
            onClick={close}
          >
            <MaterialIcon name="close" />
          </button>
        </div>
        {error !== null && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {printings.length === 0 && error === null && (
          <p role="status">Loading printings…</p>
        )}
        <div className="printing-grid">
          {printings.map((printing) => {
            const finish = preferredFinish(printing, cardset.finish);
            const price = displayPrice(printing, finish, provider);
            const selected =
              printing.id === cardset.printing_id && finish === cardset.finish;
            return (
              <article
                className={`printing-option${selected ? " selected" : ""}`}
                key={printing.id}
              >
                <ClickableCardImage
                  card={printing}
                  className="printing-image"
                />
                <strong>{printing.set_name}</strong>
                <small>
                  {printing.set.toUpperCase()} · {finish}
                </small>
                <small>
                  {printing.rarity} ·{" "}
                  {printing.released_at ?? "Release date unavailable"}
                </small>
                <small>
                  {printing.frame === null || printing.frame === undefined
                    ? "Frame unavailable"
                    : `${printing.frame} frame`}
                  {printing.universes_beyond === true
                    ? " · Universes Beyond"
                    : ""}
                </small>
                <small>{price ?? "Price unavailable"}</small>
                <button
                  disabled={selected}
                  onClick={() => {
                    select(printing, finish);
                  }}
                >
                  {selected ? "Current printing" : "Use this printing"}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
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
  return (
    <div className="card-art">
      <ClickableCardImage card={cardset} className="card-image" />
      <button
        className="art-button"
        disabled={disabled}
        aria-label={`Choose printing for ${cardset.card_name}`}
        title="Choose printing"
        onClick={open}
      >
        <MaterialIcon name="imagesmode" />
      </button>
    </div>
  );
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
  score,
}: {
  card: CardSet;
  open: () => void;
  add: () => void;
  remove: () => void;
  markCommander: (() => void) | null;
  disabled: boolean;
  stacked: boolean;
  index: number;
  score: CardRoleEvaluation | null;
}) {
  return (
    <div
      className={stacked ? "stacked-card" : "grid-card"}
      style={
        stacked
          ? ({ "--stack-index": index } as React.CSSProperties)
          : undefined
      }
    >
      <DeckCardImage cardset={card} open={open} disabled={disabled} />
      {!stacked && card.quantity > 1 && (
        <span
          className="card-quantity"
          aria-label={`${String(card.quantity)} copies`}
        >
          ×{card.quantity}
        </span>
      )}
      {score !== null && (
        <span
          className="card-score"
          aria-label={`${String(score.overall_score)} role score`}
          title={score.roles
            .map((role) => `${titleize(role.role)} ${String(role.score)}`)
            .join(", ")}
        >
          {score.overall_score}
        </span>
      )}
      <div className="card-quick-actions">
        <button
          disabled={disabled}
          aria-label={`Remove one ${card.card_name}`}
          onClick={remove}
        >
          <MaterialIcon name="remove" />
        </button>
        <button
          disabled={disabled}
          aria-label={`Add one ${card.card_name}`}
          onClick={add}
        >
          <MaterialIcon name="add" />
        </button>
        {markCommander !== null && (
          <button
            disabled={disabled}
            aria-label={`Mark ${card.card_name} as commander`}
            onClick={markCommander}
          >
            <MaterialIcon name="shield_person" />
          </button>
        )}
      </div>
    </div>
  );
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
  scores,
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
  scores: ReadonlyMap<string, CardRoleEvaluation>;
}) {
  const provider = useContext(PriceProviderContext);
  return (
    <div className={`visual-groups ${view}`}>
      {groupedCards(cards, groupBy, sortBy, provider, scores).map((group) => (
        <section className="visual-group" key={group.label}>
          <h3>
            {group.label} <small>{group.quantity}</small>
          </h3>
          <div
            className={view === "stacks" ? "card-stacks" : "visual-card-grid"}
          >
            {group.cards.flatMap((card) =>
              Array.from(
                { length: view === "stacks" ? card.quantity : 1 },
                (_, index) => (
                  <ImageCard
                    card={card}
                    add={() => {
                      addCard(card);
                    }}
                    disabled={busy}
                    index={index}
                    key={`${card.id}-${String(index)}`}
                    markCommander={
                      card.zone !== "commander" &&
                      commanderEligible(card.scryfall, format)
                        ? () => {
                            markCommander(card);
                          }
                        : null
                    }
                    open={() => {
                      openPrinting(card);
                    }}
                    remove={() => {
                      removeCard(card);
                    }}
                    score={null}
                    stacked={view === "stacks"}
                  />
                ),
              ),
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function DeckInfoView({
  deck,
  edit,
  refreshOverview,
  busy,
  validation,
}: {
  deck: Deck;
  edit: () => void;
  refreshOverview: () => void;
  busy: boolean;
  validation: Validation | null;
}) {
  return (
    <section className="info-view" aria-labelledby="deck-info-title">
      <div className="view-heading">
        <div>
          <span className="eyebrow">Deck information</span>
          <h2 id="deck-info-title">Purpose and overview</h2>
        </div>
        <button className="secondary-button" onClick={edit}>
          <MaterialIcon name="edit" /> Edit deck info
        </button>
      </div>
      <div className="info-grid">
        <article className="info-card prominent">
          <span className="eyebrow">Goal / North Star</span>
          {deck.goal === "" ? (
            <p className="muted">
              Define what this deck should consistently accomplish.
            </p>
          ) : (
            <GeneratedDescription
              description={deck.goal}
              cards={deck.cardsets}
            />
          )}
        </article>
        <article className="info-card">
          <span className="eyebrow">About this deck</span>
          {deck.description === "" ? (
            <p className="muted">No user description yet.</p>
          ) : (
            <GeneratedDescription
              description={deck.description}
              cards={deck.cardsets}
            />
          )}
        </article>
        <article className="info-card ai-overview">
          <div className="info-card-heading">
            <span className="eyebrow">AI-generated overview</span>
            <button
              className="text-button"
              disabled={busy}
              onClick={refreshOverview}
            >
              <MaterialIcon name="refresh" /> Refresh overview
            </button>
          </div>
          {deck.generated_description === "" ? (
            <p className="muted" role="status">
              {busy
                ? "Generating an overview…"
                : "An overview will be generated when this view opens."}
            </p>
          ) : (
            <GeneratedDescription
              description={deck.generated_description}
              cards={deck.cardsets}
            />
          )}
        </article>
        <article className="info-card details-card">
          <span className="eyebrow">Deck details</span>
          <dl>
            <div>
              <dt>Format</dt>
              <dd>{titleize(deck.format)}</dd>
            </div>
            <div>
              <dt>Cards</dt>
              <dd>
                {validation?.card_count ??
                  deck.cardsets.reduce(
                    (total, card) => total + card.quantity,
                    0,
                  )}
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                {validation?.valid === true ? "Valid" : "Needs attention"}
              </dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{deck.revision}</dd>
            </div>
          </dl>
        </article>
      </div>
    </section>
  );
}

function DeckScoresView({
  deck,
  scores,
  scoring,
  scoreCards,
  progress,
  editGoal,
}: {
  deck: Deck;
  scores: ReadonlyMap<string, CardRoleEvaluation>;
  scoring: boolean;
  scoreCards: () => void;
  progress: CardEvaluationProgress | null;
  editGoal: () => void;
}) {
  const [evaluationSort, setEvaluationSort] = useState<"overall" | CardRole>(
    "overall",
  );
  const uniqueCards = new Set(deck.cardsets.map((card) => card.oracle_id)).size;
  const cardNames = new Map(
    deck.cardsets.map((card) => [card.oracle_id, card.card_name]),
  );
  const cardsByOracleId = new Map(
    deck.cardsets.map((card) => [card.oracle_id, card]),
  );
  const roleScore = (evaluation: CardRoleEvaluation, role: CardRole): number =>
    evaluation.roles.find((item) => item.role === role)?.score ?? -1;
  const rankedScores = [...scores.values()].sort(
    (left, right) =>
      (evaluationSort === "overall"
        ? right.overall_score - left.overall_score
        : roleScore(right, evaluationSort) - roleScore(left, evaluationSort)) ||
      (cardNames.get(left.oracle_id) ?? left.oracle_id).localeCompare(
        cardNames.get(right.oracle_id) ?? right.oracle_id,
      ),
  );
  return (
    <section className="scores-view" aria-labelledby="scores-title">
      <div className="view-heading">
        <div>
          <span className="eyebrow">Card evaluations</span>
          <h2 id="scores-title">Scores and role fit</h2>
        </div>
        <button
          disabled={scoring || uniqueCards === 0 || deck.goal.trim() === ""}
          onClick={scoreCards}
        >
          <MaterialIcon name="fact_check" />{" "}
          {scoring ? "Evaluating cards…" : "Evaluate cards"}
        </button>
      </div>
      {deck.goal.trim() === "" && (
        <section className="evaluation-goal-required" role="status">
          <div>
            <MaterialIcon name="flag" />
            <span>
              <strong>Add a Goal / North Star before evaluating cards</strong>
              <small>
                Scores judge how well each card supports the deck's intended
                game plan.
              </small>
            </span>
          </div>
          <button className="secondary-button" onClick={editGoal}>
            <MaterialIcon name="edit" /> Add goal
          </button>
        </section>
      )}
      <div className="evaluation-summary">
        <div className="evaluation-count">
          <strong>
            {progress === null ? scores.size : progress.completed}/{uniqueCards}
          </strong>
          <span>cards evaluated</span>
        </div>
        {progress === null ? (
          <p className="muted">
            Cards are tagged by role, judged against role-specific qualitative
            rubrics, and scored deterministically from those answers.
          </p>
        ) : (
          <p className="muted" role="status">
            Evaluating cards at{" "}
            {progress.average_seconds_per_card === null
              ? "an estimated rate"
              : `${progress.average_seconds_per_card.toFixed(1)} seconds per card`}
            .{" "}
            {progress.eta_seconds === null
              ? "Estimating time remaining…"
              : `About ${formatDuration(progress.eta_seconds)} remaining.`}
          </p>
        )}
      </div>
      {rankedScores.length > 0 && (
        <div className="score-breakdown">
          <label className="compact-control evaluation-sort">
            Sort evaluations
            <select
              aria-label="Evaluation sort"
              value={evaluationSort}
              onChange={(event) => {
                setEvaluationSort(event.target.value as "overall" | CardRole);
              }}
            >
              <option value="overall">Overall score</option>
              {(
                [
                  "land",
                  "mana_ramp",
                  "card_advantage",
                  "removal",
                  "board_wipe",
                  "enabler",
                  "enhancer",
                  "payoff",
                ] as const
              ).map((role) => (
                <option key={role} value={role}>
                  {titleize(role)}
                </option>
              ))}
            </select>
          </label>
          <div className="score-breakdown-list">
            {rankedScores.map((score) => {
              const card = cardsByOracleId.get(score.oracle_id);
              return (
                <article className="score-card-row" key={score.oracle_id}>
                  {card !== undefined && (
                    <ClickableCardImage
                      card={card}
                      className="score-card-image"
                    />
                  )}
                  <details className="score-card">
                    <summary>
                      <span>
                        <strong>
                          {cardNames.get(score.oracle_id) ?? score.oracle_id}
                        </strong>
                        <small>
                          {score.roles
                            .map((role) => titleize(role.role))
                            .join(" · ")}
                        </small>
                      </span>
                      <b>{score.overall_score}</b>
                    </summary>
                    <p>
                      <InlineCardText text={score.overall_comment} />
                    </p>
                    <div className="role-score-list">
                      {score.roles.map((role) => (
                        <section className="role-score" key={role.role}>
                          <header>
                            <b className={`role-tag ${role.role}`}>
                              {titleize(role.role)}
                            </b>
                            <strong>{role.score}</strong>
                          </header>
                          <p>
                            <InlineCardText text={role.description} />
                          </p>
                          <ul>
                            {role.answers.map((answer) => (
                              <li key={answer.criterion_id}>
                                <strong>{titleize(answer.criterion_id)}</strong>
                                <b>
                                  {titleize(answer.rating)} · {answer.score}
                                </b>
                              </li>
                            ))}
                          </ul>
                        </section>
                      ))}
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function App() {
  const [user, setUser] = useState<string | null>(null);
  const [priceProvider, setPriceProvider] =
    useState<PriceProvider>(storedPriceProvider);

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
    <CardPresentationProvider cards={[]}>
      <PriceProviderContext.Provider value={priceProvider}>
        <BrowserRouter>
          <ScrollToTop />
          <header>
            <Link to="/decks">
              <strong>Survail</strong>
            </Link>
            <nav aria-label="Primary navigation">
              <Link to="/decks">Decks</Link>
              <Link to="/import">Import</Link>
            </nav>
            <label className="price-setting">
              Prices
              <select
                aria-label="Price marketplace"
                value={priceProvider}
                onChange={handlePriceProvider}
              >
                <option value="tcgplayer">TCGPlayer · USD</option>
                <option value="cardmarket">Cardmarket · EUR</option>
                <option value="cardhoarder">Cardhoarder · TIX</option>
              </select>
            </label>
            <span>{user}</span>
            <button onClick={handleLogout}>Log out</button>
          </header>
          <Routes>
            <Route path="*" element={<Library mode="decks" />} />
            <Route path="/decks" element={<Library mode="decks" />} />
            <Route path="/import" element={<Library mode="import" />} />
            <Route path="/decks/:id" element={<Editor />} />
          </Routes>
        </BrowserRouter>
      </PriceProviderContext.Provider>
    </CardPresentationProvider>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${String(Math.max(1, Math.ceil(seconds)))} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return `${String(minutes)} ${minutes === 1 ? "minute" : "minutes"}`;
}

function Library({ mode }: { mode: "decks" | "import" }) {
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
        <section className="import-panel">
          <div className="import-settings">
            <h2>Import Moxfield decklist</h2>
            <p className="muted">
              Paste an exported list. Imported cards begin in the Mainboard;
              move commanders and sideboard cards after creation.
            </p>
            <form
              className="import-form"
              onSubmit={(event) => void handlePreview(event)}
            >
              <div className="import-settings-scroll stack">
                <label>
                  Deck title
                  <input
                    maxLength={120}
                    required
                    value={title}
                    onChange={(event) => {
                      setTitle(event.target.value);
                    }}
                  />
                </label>
                <label>
                  Format
                  <select required value={format} onChange={handleFormatChange}>
                    {DECK_FORMATS.map((deckFormat) => (
                      <option key={deckFormat}>{deckFormat}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Decklist
                  <textarea
                    value={decklist}
                    onChange={(event) => {
                      setDecklist(event.target.value);
                    }}
                    placeholder={
                      "1 Arcane Signet (CMM) 379\n1 Sol Ring (CMM) 396"
                    }
                    required
                  />
                </label>
                <fieldset className="import-options">
                  <legend>Printing priority</legend>
                  <p className="muted">
                    Drag rules into priority order. Each rule falls through when
                    it cannot choose between available printings.
                  </p>
                  <div
                    className="preference-list"
                    role="list"
                    aria-label="Printing preference priority"
                  >
                    {importPreferences.rules.map((rule, index) => (
                      <div
                        className="preference-rule"
                        draggable
                        key={rule.kind}
                        role="listitem"
                        aria-label={`${String(index + 1)}. ${PREFERENCE_LABELS[rule.kind]}`}
                        onDragStart={() => {
                          setDraggedPreference(rule.kind);
                        }}
                        onDragEnd={() => {
                          setDraggedPreference(null);
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                        }}
                        onDrop={() => {
                          if (draggedPreference !== null)
                            movePreference(draggedPreference, rule.kind);
                        }}
                      >
                        <span className="drag-handle" aria-hidden="true">
                          ⋮⋮
                        </span>
                        <strong>
                          {String(index + 1)}. {PREFERENCE_LABELS[rule.kind]}
                        </strong>
                        {rule.kind === "cheapest" && (
                          <label>
                            Price buffer
                            <span>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={rule.bufferPercent}
                                onChange={(event) => {
                                  updateCheapestBuffer(
                                    Number(event.target.value),
                                  );
                                }}
                              />
                              %
                            </span>
                          </label>
                        )}
                        {rule.kind === "frame" && (
                          <label>
                            Style
                            <select
                              value={rule.frame}
                              onChange={(event) => {
                                updateFrame(
                                  event.target.value as Extract<
                                    ImportPreferenceRule,
                                    { kind: "frame" }
                                  >["frame"],
                                );
                              }}
                            >
                              <option value="1993">Original (1993)</option>
                              <option value="1997">Classic (1997)</option>
                              <option value="2003">Modern (2003)</option>
                              <option value="2015">M15/current (2015)</option>
                              <option value="future">Future</option>
                            </select>
                          </label>
                        )}
                        <div className="priority-buttons">
                          <button
                            type="button"
                            disabled={index === 0}
                            aria-label={`Move ${PREFERENCE_LABELS[rule.kind]} up`}
                            onClick={() => {
                              const previous =
                                importPreferences.rules[index - 1];
                              if (previous !== undefined)
                                movePreference(rule.kind, previous.kind);
                            }}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={
                              index === importPreferences.rules.length - 1
                            }
                            aria-label={`Move ${PREFERENCE_LABELS[rule.kind]} down`}
                            onClick={() => {
                              const next = importPreferences.rules[index + 1];
                              if (next !== undefined)
                                movePreference(rule.kind, next.kind);
                            }}
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <label>
                    <input
                      type="checkbox"
                      checked={importPreferences.preserveTags}
                      onChange={(event) => {
                        setImportPreferences((current) => ({
                          ...current,
                          preserveTags: event.target.checked,
                        }));
                      }}
                    />{" "}
                    Preserve tags
                  </label>
                </fieldset>
              </div>
              <footer className="import-actions">
                <button disabled={busy}>
                  {busy ? "Resolving…" : "Preview import"}
                </button>
              </footer>
            </form>
          </div>
          <div className="import-preview">
            <header className="import-preview-header">
              <h2>Resolved preview</h2>
              {preview !== null && (
                <p>
                  {preview.cardsets.reduce(
                    (total, card) => total + card.quantity,
                    0,
                  )}{" "}
                  cards · {preview.cardsets.length} unique cards
                </p>
              )}
            </header>
            <div className="import-preview-scroll">
              {preview === null && (
                <p className="muted">
                  Preview the import to review selected printings.
                </p>
              )}
              {preview !== null && preview.errors.length > 0 && (
                <div className="notice error" role="alert">
                  <strong>{preview.errors.length} lines need attention</strong>
                  {preview.errors.map((issue) => (
                    <p key={`${String(issue.line_number)}-${issue.code}`}>
                      <strong>
                        Line {issue.line_number}: {titleize(issue.code)}
                      </strong>
                      <br />
                      {issue.message}
                      <br />
                      <small>{issue.raw_line}</small>
                    </p>
                  ))}
                </div>
              )}
              {preview?.used_ai_fallback === true && (
                <p className="notice" role="status">
                  AI-assisted import extracted cards from the supplied text.
                  Review the resolved cards before creating the deck.
                </p>
              )}
              {preview !== null && (
                <div className="preview-grid">
                  {preview.cardsets.map((card) => (
                    <article
                      className="preview-card"
                      key={`${card.printing_id}-${card.finish}-${card.zone}`}
                    >
                      <ClickableCardImage
                        card={card.scryfall}
                        className="preview-image"
                      />
                      <strong>
                        {card.quantity}× {card.card_name}
                      </strong>
                      <small>
                        {zoneLabel(card.zone)} · {card.set_code.toUpperCase()}
                      </small>
                      <Price card={card.scryfall} finish={card.finish} />
                      {card.tags.length > 0 && (
                        <small>{card.tags.join(" · ")}</small>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
            <footer className="import-actions">
              {preview === null ? (
                <p className="muted">
                  Preview the decklist before creating the deck.
                </p>
              ) : (
                <button
                  disabled={
                    busy || preview.errors.length > 0 || title.trim() === ""
                  }
                  onClick={() => void createImportedDeck()}
                >
                  Create imported deck
                </button>
              )}
            </footer>
          </div>
        </section>
      )}
      {mode === "decks" && (
        <section className="deck-grid">
          {decks.map((deck) => (
            <article className="deck-card" key={deck.id}>
              <button
                className="kebab-button"
                aria-label={`Actions for ${deck.title}`}
                aria-expanded={openDeckMenu === deck.id}
                aria-controls={`deck-menu-${deck.id}`}
                aria-haspopup="menu"
                onClick={() => {
                  setOpenDeckMenu((current) =>
                    current === deck.id ? null : deck.id,
                  );
                }}
              >
                •••
              </button>
              {openDeckMenu === deck.id && (
                <div
                  className="deck-menu"
                  id={`deck-menu-${deck.id}`}
                  role="menu"
                >
                  <button
                    autoFocus
                    className="danger"
                    role="menuitem"
                    onClick={() => void deleteDeck(deck)}
                  >
                    Delete deck
                  </button>
                </div>
              )}
              <div className="deck-cover">
                {deck.cardsets.slice(0, 3).map((card) => (
                  <ClickableCardImage
                    key={card.id}
                    card={card}
                    className="cover-image"
                  />
                ))}
              </div>
              <Link className="deck-card-link" to={`/decks/${deck.id}`}>
                <h2>{deck.title}</h2>
                <p>
                  {deck.format} ·{" "}
                  {deck.cardsets.reduce(
                    (total, card) => total + card.quantity,
                    0,
                  )}{" "}
                  cards
                </p>
                <small>
                  Updated {new Date(deck.updated_at).toLocaleString()}
                </small>
              </Link>
            </article>
          ))}
        </section>
      )}
      {showAddDeck && (
        <div className="modal-backdrop" onClick={closeAddDeck}>
          <form
            className="add-deck-modal stack"
            ref={addDeckDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-deck-title"
            aria-describedby="add-deck-description"
            tabIndex={-1}
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreateDeck();
            }}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="page-heading">
              <h2 id="add-deck-title">Add Deck</h2>
              <button
                className="icon-action"
                type="button"
                aria-label="Close add deck dialog"
                onClick={closeAddDeck}
              >
                <MaterialIcon name="close" />
              </button>
            </div>
            <p className="muted" id="add-deck-description">
              Choose a title and format to create an empty deck.
            </p>
            <label>
              Title
              <input
                autoFocus
                maxLength={120}
                required
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                }}
              />
            </label>
            <label>
              Format
              <select required value={format} onChange={handleFormatChange}>
                {DECK_FORMATS.map((deckFormat) => (
                  <option key={deckFormat}>{deckFormat}</option>
                ))}
              </select>
            </label>
            <button disabled={busy || title.trim() === ""}>Create deck</button>
          </form>
        </div>
      )}
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
  const [goal, setGoal] = useState("");
  const [scores, setScores] = useState<Map<string, CardRoleEvaluation>>(
    new Map(),
  );
  const [scoring, setScoring] = useState(false);
  const [evaluationProgress, setEvaluationProgress] =
    useState<CardEvaluationProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [printingCardset, setPrintingCardset] = useState<CardSet | null>(null);
  const [displayPreferences, setDisplayPreferences] =
    useState<DeckDisplayPreferences>(storedDeckDisplayPreferences);
  const { view: deckView, groupBy, sortBy } = displayPreferences;
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
  const [showAgent, setShowAgent] = useState(true);
  const [advisorWidth, setAdvisorWidth] = useState(() => {
    const stored = Number.parseInt(
      localStorage.getItem("survail.advisor-width") ?? "",
      10,
    );
    return Number.isFinite(stored) ? Math.max(320, stored) : 400;
  });
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [agentMessage, setAgentMessage] = useState("");
  const [agentEvents, setAgentEvents] = useState<AgentUiEvent[]>([]);
  const [agentBusy, setAgentBusy] = useState(false);
  const [guidanceDecisions, setGuidanceDecisions] = useState<
    Record<string, "approved" | "rejected">
  >({});
  const [latestUserMessageId, setLatestUserMessageId] = useState<string | null>(
    null,
  );
  const agentEventsRef = useRef<HTMLDivElement>(null);
  const latestUserMessageRef = useRef<HTMLElement>(null);
  const scoreRequestedRevision = useRef<number | null>(null);
  const editDeckDialogRef = useModalBehavior<HTMLFormElement>(
    showEditDeck,
    () => {
      setShowEditDeck(false);
    },
  );
  const historyDialogRef = useModalBehavior<HTMLElement>(showHistory, () => {
    setShowHistory(false);
  });
  const bulkEditDialogRef = useModalBehavior<HTMLElement>(showBulkEdit, () => {
    setShowBulkEdit(false);
  });
  const searchDrawerRef = useDismissibleSurface<HTMLElement>(
    showSearchResults,
    () => {
      setShowSearchResults(false);
    },
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
  }, [id]);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        await loadDeck();
      } catch (reason) {
        setError(
          reason instanceof Error ? messageFor(reason) : "Request failed",
        );
      }
    }
    void load();
  }, [loadDeck]);

  const evaluateCurrentDeck = useCallback(async (): Promise<void> => {
    if (deck === null || scoring) return;
    if (deck.goal.trim() === "") {
      setAnnouncement("Add a Goal / North Star before evaluating cards");
      return;
    }
    setScoring(true);
    try {
      setEvaluationProgress({
        completed: 0,
        total: new Set(deck.cardsets.map((card) => card.oracle_id)).size,
        average_seconds_per_card: null,
        eta_seconds: null,
      });
      const loadedScores = await api.streamCurrentDeckEvaluation(
        deck.id,
        setEvaluationProgress,
        (result) => {
          setScores((current) =>
            new Map(current).set(result.oracle_id, result),
          );
        },
      );
      setScores(new Map(loadedScores.map((score) => [score.oracle_id, score])));
      setAnnouncement(`${String(loadedScores.length)} cards scored`);
    } catch (reason) {
      setError(
        reason instanceof Error ? messageFor(reason) : "Could not score cards",
      );
    } finally {
      setScoring(false);
      setEvaluationProgress(null);
    }
  }, [deck, scoring]);

  useEffect(() => {
    if (deck === null) return;
    setScores(new Map());
    if (deck.goal.trim() === "") return;
    if (scoreRequestedRevision.current === deck.revision) return;
    scoreRequestedRevision.current = deck.revision;
    void evaluateCurrentDeck();
  }, [deck?.id, deck?.revision]);

  useEffect(() => {
    localStorage.setItem(
      "survail.deck-display-preferences",
      JSON.stringify(displayPreferences),
    );
  }, [displayPreferences]);

  useEffect(() => {
    localStorage.setItem("survail.advisor-width", String(advisorWidth));
  }, [advisorWidth]);

  useEffect(() => {
    if (editorView === "info" && deck?.generated_description === "")
      void handleGenerateDescription();
  }, [editorView, deck?.id, deck?.revision]);

  useEffect(() => {
    if (latestUserMessageId === null) return;
    const frame = requestAnimationFrame(() => {
      const viewport = agentEventsRef.current;
      const message = latestUserMessageRef.current;
      if (viewport !== null && message !== null) {
        viewport.scrollTo({
          top: message.offsetTop - viewport.offsetTop,
          behavior: "smooth",
        });
      }
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [latestUserMessageId]);

  function applyChanges(
    changes: DeckOperationChangeInput[],
    reason: string,
  ): void {
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
        setError(
          caught instanceof Error ? messageFor(caught) : "Request failed",
        );
        if (caught instanceof ApiError && caught.status === 409)
          await loadDeck();
      } finally {
        setBusy(false);
      }
    }
    void apply();
  }

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
          : {
              ...current,
              generated_description: generated.description,
            },
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

  function beginAdvisorResize(event: React.PointerEvent<HTMLDivElement>): void {
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function resizeAdvisor(event: React.PointerEvent<HTMLDivElement>): void {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    setAdvisorWidth(Math.max(320, window.innerWidth - event.clientX - 16));
  }

  function resizeAdvisorWithKeyboard(
    event: React.KeyboardEvent<HTMLDivElement>,
  ): void {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "Home"
    )
      return;
    event.preventDefault();
    if (event.key === "Home") setAdvisorWidth(400);
    else
      setAdvisorWidth((current) =>
        Math.max(320, current + (event.key === "ArrowLeft" ? 24 : -24)),
      );
  }

  function openBulkEdit(): void {
    if (deck === null) return;
    setBulkDecklist(decklistText(deck));
    setBulkEditErrors([]);
    setShowBulkEdit(true);
  }

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

  function changePrinting(
    cardset: CardSet,
    printing: ScryfallCard,
    finish: CardFinish,
  ): void {
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
  }

  function changeQuantity(cardset: CardSet, quantityDelta: number): void {
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
  }

  function markAsCommander(cardset: CardSet): void {
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
  }

  function receiveAgentEvent(event: AgentUiEvent): void {
    console.warn("deck-agent event received", {
      deckId: id,
      runId: event.run_id,
      eventType: event.type,
    });
    setAgentEvents((current) => [...current, event]);
    if (event.type === "operation_applied")
      void refreshDeckAfterAgentOperation();
  }

  async function decideGuidanceProposal(
    proposalId: string,
    expectedRevision: number,
    decision: "approve" | "reject",
  ): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.decideGuidanceProposal(
        id,
        proposalId,
        expectedRevision,
        decision,
      );
      setGuidanceDecisions((current) => ({
        ...current,
        [proposalId]: decision === "approve" ? "approved" : "rejected",
      }));
      if (decision === "approve") {
        scoreRequestedRevision.current = null;
        await loadDeck();
        setAnnouncement("Deck goal updated");
      } else {
        setAnnouncement("Guidance proposal rejected");
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? messageFor(reason)
          : "Could not decide guidance proposal",
      );
      if (reason instanceof ApiError && reason.status === 409) await loadDeck();
    } finally {
      setBusy(false);
    }
  }

  async function refreshDeckAfterAgentOperation(): Promise<void> {
    try {
      await loadDeck();
      setAnnouncement("Deck updated by the deck advisor");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? messageFor(reason)
          : "Could not refresh the updated deck",
      );
    }
  }

  async function ensureConversation(): Promise<string> {
    if (conversationId !== null) return conversationId;
    const conversation = await api.createConversation(id);
    setConversationId(conversation.id);
    return conversation.id;
  }

  async function submitAgentMessage(message: string): Promise<void> {
    if (message.trim() === "" || agentBusy) return;
    const cleanedMessage = message.trim();
    const userMessageId = crypto.randomUUID();
    setAgentMessage("");
    setAgentEvents((current) => [
      ...current,
      {
        type: "user_message",
        run_id: userMessageId,
        payload: { message: cleanedMessage },
      },
    ]);
    setLatestUserMessageId(userMessageId);
    setAgentBusy(true);
    console.warn("deck-agent message started", {
      deckId: id,
      localMessageId: userMessageId,
    });
    try {
      const outcome = await api.sendAgentMessage(
        id,
        await ensureConversation(),
        cleanedMessage,
        receiveAgentEvent,
      );
      console.warn("deck-agent message stream closed", {
        deckId: id,
        localMessageId: userMessageId,
        outcome,
      });
    } catch (reason) {
      console.error("deck-agent message failed", {
        deckId: id,
        localMessageId: userMessageId,
        reason,
      });
      setAgentEvents((current) => [
        ...current,
        {
          type: "stream_closed",
          run_id: userMessageId,
          payload: {
            expected: false,
            message: "The deck advisor could not be reached. Please try again.",
          },
        },
      ]);
      setError(
        reason instanceof Error
          ? messageFor(reason)
          : "Could not contact deck advisor",
      );
    } finally {
      setAgentBusy(false);
    }
  }

  function sendAgentMessage(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submitAgentMessage(agentMessage);
  }

  function handleAgentComposerKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ): void {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    )
      return;
    event.preventDefault();
    void submitAgentMessage(agentMessage);
  }

  if (deck === null) return <main>{error ?? "Loading…"}</main>;

  return (
    <CardPresentationProvider cards={deck.cardsets}>
      <main
        className={`editor ${showAgent ? "advisor-open" : ""}`}
        style={
          {
            "--advisor-width": `${String(advisorWidth)}px`,
          } as React.CSSProperties
        }
        aria-busy={busy}
      >
        <h1 className="sr-only">{deck.title}</h1>
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </div>
        <section className="deck-editor">
          {error !== null && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <div className="deck-app-bar" aria-label="Deck controls">
            <div className="deck-readonly-details">
              <strong>{deck.title}</strong>
              <span className="pill">{titleize(deck.format)}</span>
            </div>
            <details className="validation-menu">
              <summary
                className={
                  validation?.valid === true
                    ? "validation-summary valid"
                    : "validation-summary invalid"
                }
                aria-label={`${validation?.valid === true ? "Valid deck" : "Deck needs attention"}, ${String(validation?.card_count ?? 0)} cards`}
              >
                {validation?.valid === true ? (
                  <MaterialIcon name="check" />
                ) : (
                  <MaterialIcon name="error" />
                )}
              </summary>
              <div className="subheader-menu">
                {validation?.errors.length === 0 && (
                  <p>No validation errors.</p>
                )}
                {groupedValidationErrors(validation).map((group) => (
                  <details
                    className="validation-error-group"
                    key={group.errorId}
                  >
                    <summary>
                      <strong>{titleize(group.errorId)}</strong>
                      <span>{group.errors.length}</span>
                    </summary>
                    <div>
                      {group.errors.map((validationError, index) => (
                        <p key={`${validationError.error_id}-${String(index)}`}>
                          <InlineCardText text={validationError.message} />
                        </p>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </details>
            <button
              className="secondary-button labeled-action"
              onClick={() => {
                setShowEditDeck(true);
              }}
            >
              <MaterialIcon name="edit" /> Edit
            </button>
            <button
              className={`secondary-button labeled-action ${showAgent ? "selected" : ""}`}
              aria-pressed={showAgent}
              onClick={() => {
                setShowAgent((current) => !current);
              }}
            >
              <MaterialIcon name="forum" /> Advisor
            </button>
            <details className="overflow-menu">
              <summary className="icon-action" aria-label="More deck actions">
                <MaterialIcon name="more_vert" />
              </summary>
              <div className="subheader-menu action-menu">
                <button onClick={openBulkEdit}>
                  <MaterialIcon name="edit_note" /> Bulk edit decklist
                </button>
                <button
                  onClick={() => {
                    setShowHistory(true);
                  }}
                >
                  <MaterialIcon name="history" /> History
                </button>
                <button className="danger" onClick={() => void handleDelete()}>
                  <MaterialIcon name="delete" /> Delete deck
                </button>
              </div>
            </details>
          </div>
          <nav className="editor-tabs" aria-label="Deck views">
            {(["cards", "scores", "info"] as const).map((view) => (
              <button
                className={editorView === view ? "active" : ""}
                aria-current={editorView === view ? "page" : undefined}
                key={view}
                onClick={() => {
                  setEditorView(view);
                }}
              >
                {titleize(view)}
              </button>
            ))}
          </nav>
          {editorView === "cards" && (
            <div className="deck-toolbar" aria-label="Card display controls">
              <form
                className="card-search"
                onSubmit={(event) => void handleSearch(event)}
              >
                <input
                  aria-label="Card search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                  }}
                  placeholder="Search cards"
                />
                <button
                  className="icon-action"
                  aria-label="Search"
                  title="Search"
                >
                  <MaterialIcon name="search" />
                </button>
              </form>
              <div className="view-selector" aria-label="Card view">
                {(["stacks", "grid", "text"] as const).map((view) => (
                  <button
                    className={deckView === view ? "active" : ""}
                    aria-pressed={deckView === view}
                    key={view}
                    onClick={() => {
                      setDisplayPreferences((current) => ({
                        ...current,
                        view,
                      }));
                    }}
                  >
                    {titleize(view)}
                  </button>
                ))}
              </div>
              <details className="organize-menu">
                <summary className="secondary-button">
                  <MaterialIcon name="tune" /> Organize
                </summary>
                <div className="subheader-menu">
                  <label>
                    Group by
                    <select
                      value={groupBy}
                      onChange={(event) => {
                        setDisplayPreferences((current) => ({
                          ...current,
                          groupBy: event.target.value as GroupBy,
                        }));
                      }}
                    >
                      <option value="type">Type</option>
                      <option value="color">Color</option>
                      <option value="mana-value">Mana Value</option>
                    </select>
                  </label>
                  <label>
                    Sort by
                    <select
                      aria-label="Card sort"
                      value={sortBy}
                      onChange={(event) => {
                        setDisplayPreferences((current) => ({
                          ...current,
                          sortBy: event.target.value as SortBy,
                        }));
                      }}
                    >
                      <option value="alphabetical">Alphabetical</option>
                      <option value="mana-value">Mana Value</option>
                      <option value="price">Price</option>
                      <option value="score">Role Score</option>
                    </select>
                  </label>
                </div>
              </details>
            </div>
          )}
          {editorView === "info" && (
            <DeckInfoView
              deck={deck}
              edit={() => {
                setShowEditDeck(true);
              }}
              refreshOverview={() => void handleGenerateDescription(true)}
              busy={busy}
              validation={validation}
            />
          )}
          {editorView === "scores" && (
            <DeckScoresView
              deck={deck}
              scores={scores}
              scoring={scoring}
              scoreCards={() => void evaluateCurrentDeck()}
              progress={evaluationProgress}
              editGoal={() => {
                setShowEditDeck(true);
              }}
            />
          )}
          {editorView === "cards" &&
            zonesFor(deck.format).map((zone) => {
              const cards = deck.cardsets.filter((card) => card.zone === zone);
              const groups = groupedCards(
                cards,
                groupBy,
                sortBy,
                priceProvider,
                scores,
              );
              if (cards.length === 0 && zone !== "mainboard") return null;
              return (
                <section className="zone" key={zone}>
                  <h2>
                    {zoneLabel(zone)}{" "}
                    <small>
                      {cards.reduce((total, card) => total + card.quantity, 0)}
                    </small>
                  </h2>
                  {deckView === "text" ? (
                    <div className="text-groups">
                      {groups.map((group) => (
                        <section key={group.label}>
                          <h3>
                            {group.label} <small>{group.quantity}</small>
                          </h3>
                          <div className="card-grid">
                            {group.cards.map((card) => (
                              <article className="card-row" key={card.id}>
                                <strong>{card.card_name}</strong>
                                <div className="inline-quantity">
                                  <button
                                    disabled={busy}
                                    aria-label={`Remove one ${card.card_name}`}
                                    title="Remove one"
                                    onClick={() => {
                                      changeQuantity(card, -1);
                                    }}
                                  >
                                    <MaterialIcon name="remove" />
                                  </button>
                                  <span>{card.quantity}</span>
                                  <button
                                    disabled={busy}
                                    aria-label={`Add one ${card.card_name}`}
                                    title="Add one"
                                    onClick={() => {
                                      changeQuantity(card, 1);
                                    }}
                                  >
                                    <MaterialIcon name="add" />
                                  </button>
                                </div>
                              </article>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  ) : (
                    <VisualCardGroups
                      cards={cards}
                      view={deckView}
                      groupBy={groupBy}
                      sortBy={sortBy}
                      format={deck.format}
                      openPrinting={(card) => {
                        setPrintingCardset(card);
                      }}
                      addCard={(card) => {
                        changeQuantity(card, 1);
                      }}
                      removeCard={(card) => {
                        changeQuantity(card, -1);
                      }}
                      markCommander={markAsCommander}
                      busy={busy}
                      scores={scores}
                    />
                  )}
                </section>
              );
            })}
        </section>
        {showSearchResults && (
          <aside
            className="search-drawer"
            ref={searchDrawerRef}
            role="dialog"
            aria-modal="false"
            aria-labelledby="search-results-title"
            tabIndex={-1}
          >
            <div className="page-heading">
              <div>
                <h2 id="search-results-title">Search results</h2>
                <p>{results.length} cards found</p>
              </div>
              <button
                className="icon-action"
                aria-label="Close search results"
                onClick={() => {
                  setShowSearchResults(false);
                }}
              >
                <MaterialIcon name="close" />
              </button>
            </div>
            {results.length === 0 && (
              <p className="muted" role="status">
                No cards matched this search.
              </p>
            )}
            <div className="search-drawer-grid">
              {results.slice(0, 60).map((card) => (
                <article className="search-result" key={card.id}>
                  <ClickableCardImage card={card} className="search-image" />
                  <div>
                    <strong>{card.name}</strong>
                    <small>{card.set.toUpperCase()}</small>
                    <Price
                      card={card}
                      finish={preferredFinish(card, "nonfoil")}
                    />
                    <div className="button-row">
                      {card.finishes.filter(isCardFinish).map((finish) => (
                        <button
                          disabled={busy}
                          key={finish}
                          onClick={() => {
                            applyChanges(
                              [
                                {
                                  printing_id: card.id,
                                  quantity_delta: 1,
                                  zone: "mainboard",
                                  finish,
                                },
                              ],
                              `Add ${card.name}`,
                            );
                          }}
                        >
                          <MaterialIcon name="add" /> {finish}
                        </button>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </aside>
        )}
        {showAgent && (
          <div
            className="advisor-resizer"
            role="separator"
            aria-label="Resize deck advisor"
            aria-orientation="vertical"
            aria-valuemin={320}
            aria-valuenow={advisorWidth}
            tabIndex={0}
            onDoubleClick={() => {
              setAdvisorWidth(400);
            }}
            onKeyDown={resizeAdvisorWithKeyboard}
            onPointerDown={beginAdvisorResize}
            onPointerMove={resizeAdvisor}
          />
        )}
        {showAgent && (
          <aside className="agent-drawer" aria-labelledby="agent-title">
            <div className="page-heading">
              <div>
                <h2 id="agent-title">Deck advisor</h2>
                <p>Ask questions or review proposed changes.</p>
              </div>
              <button
                className="icon-action"
                aria-label="Close deck advisor"
                onClick={() => {
                  setShowAgent(false);
                }}
              >
                <MaterialIcon name="close" />
              </button>
            </div>
            <div
              className="agent-events"
              ref={agentEventsRef}
              aria-live="polite"
            >
              {agentEvents.length === 0 && (
                <div className="agent-starters">
                  <p className="muted">
                    Ask about strategy, weaknesses, card choices, or possible
                    changes.
                  </p>
                  <div
                    className="agent-starter-chips"
                    aria-label="Suggested questions"
                  >
                    {[
                      "What does this deck do?",
                      "What is this deck missing?",
                      "Which cards should I add or remove?",
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        disabled={agentBusy}
                        onClick={() => void submitAgentMessage(prompt)}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {agentEvents.map((event, index) => {
                const key = `${event.run_id}-${String(index)}`;
                if (event.type === "user_message")
                  return (
                    <article
                      className="agent-user-message"
                      ref={
                        event.run_id === latestUserMessageId
                          ? latestUserMessageRef
                          : undefined
                      }
                      key={key}
                    >
                      <small>You</small>
                      <InlineCardText text={event.payload.message} />
                    </article>
                  );
                if (isAgentActivityEvent(event)) {
                  const superseded = agentEvents
                    .slice(index + 1)
                    .some(
                      (later) =>
                        later.run_id === event.run_id &&
                        (isAgentActivityEvent(later) ||
                          later.type === "run_completed" ||
                          later.type === "run_failed" ||
                          later.type === "stream_closed"),
                    );
                  return superseded || !agentBusy ? null : (
                    <p className="agent-status active" role="status" key={key}>
                      <span aria-hidden="true" />
                      {event.payload.message}
                    </p>
                  );
                }
                if (event.type === "assistant_text_delta") {
                  if (
                    agentEvents
                      .slice(0, index)
                      .some(
                        (prior) =>
                          prior.run_id === event.run_id &&
                          prior.type === "assistant_text_delta",
                      )
                  )
                    return null;
                  if (
                    agentEvents
                      .slice(index + 1)
                      .some(
                        (later) =>
                          later.run_id === event.run_id &&
                          later.type === "assistant_completed",
                      )
                  )
                    return null;
                  const streamedText = streamedAgentText(
                    agentEvents,
                    event.run_id,
                  );
                  return (
                    <article className="agent-message streaming" key={key}>
                      <GeneratedDescription
                        description={visibleStreamingText(streamedText)}
                        cards={deck.cardsets}
                      />
                    </article>
                  );
                }
                if (event.type === "assistant_completed")
                  return (
                    <article className="agent-message" key={key}>
                      <GeneratedDescription
                        description={event.payload.message}
                        cards={deck.cardsets}
                      />
                    </article>
                  );
                if (event.type === "run_failed")
                  return (
                    <p className="notice error" role="alert" key={key}>
                      {event.payload.message}
                    </p>
                  );
                if (event.type === "card_results")
                  return (
                    <p className="agent-status" key={key}>
                      {event.payload.cards.length} matching cards found.
                    </p>
                  );
                if (event.type === "guidance_proposal") {
                  const decision = guidanceDecisions[event.payload.proposal_id];
                  return (
                    <article className="agent-guidance-proposal" key={key}>
                      <span className="eyebrow">Your approval is required</span>
                      <strong>Update deck guidance?</strong>
                      <p>
                        <InlineCardText text={event.payload.reason} />
                      </p>
                      {event.payload.proposed_goal !== null && (
                        <blockquote>
                          <InlineCardText text={event.payload.proposed_goal} />
                        </blockquote>
                      )}
                      {decision === undefined ? (
                        <div className="button-row">
                          <button
                            disabled={busy}
                            onClick={() =>
                              void decideGuidanceProposal(
                                event.payload.proposal_id,
                                event.payload.expected_revision,
                                "approve",
                              )
                            }
                          >
                            Approve
                          </button>
                          <button
                            className="secondary-button"
                            disabled={busy}
                            onClick={() =>
                              void decideGuidanceProposal(
                                event.payload.proposal_id,
                                event.payload.expected_revision,
                                "reject",
                              )
                            }
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <p className="agent-stream-state complete">
                          <MaterialIcon
                            name={decision === "approved" ? "check" : "close"}
                          />
                          Proposal {decision}
                        </p>
                      )}
                    </article>
                  );
                }
                if (event.type === "operation_applied")
                  return (
                    <p
                      className={`notice ${event.payload.validation.valid ? "success" : "error"}`}
                      key={key}
                    >
                      Deck change applied
                      {event.payload.validation.errors.length > 0
                        ? ` with ${String(event.payload.validation.errors.length)} validation issues`
                        : ""}
                      .
                    </p>
                  );
                if (event.type === "stream_closed") {
                  const superseded = agentEvents
                    .slice(index + 1)
                    .some((candidate) => candidate.run_id === event.run_id);
                  if (event.payload.expected && superseded) return null;
                  return event.payload.expected ? (
                    <p className="agent-stream-state complete" key={key}>
                      <MaterialIcon name="check" />
                      {event.payload.message}
                    </p>
                  ) : (
                    <p
                      className="agent-stream-state interrupted"
                      role="status"
                      key={key}
                    >
                      <MaterialIcon name="wifi_off" />
                      {event.payload.message}
                    </p>
                  );
                }
                return null;
              })}
            </div>
            <form className="agent-composer" onSubmit={sendAgentMessage}>
              <label className="sr-only" htmlFor="agent-message">
                Message deck advisor
              </label>
              <textarea
                id="agent-message"
                rows={2}
                value={agentMessage}
                onChange={(event) => {
                  setAgentMessage(event.target.value);
                }}
                onKeyDown={handleAgentComposerKeyDown}
                placeholder="Ask about this deck…"
              />
              <button
                className="icon-action"
                disabled={agentBusy || agentMessage.trim() === ""}
                aria-label="Send message"
              >
                <MaterialIcon name="send" />
              </button>
            </form>
          </aside>
        )}
        {showBulkEdit && (
          <div
            className="modal-backdrop"
            onClick={() => {
              setShowBulkEdit(false);
            }}
          >
            <section
              className="bulk-edit-modal"
              ref={bulkEditDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="bulk-edit-title"
              aria-describedby="bulk-edit-description"
              tabIndex={-1}
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              <div className="page-heading">
                <div>
                  <h2 id="bulk-edit-title">Bulk edit decklist</h2>
                  <p className="muted" id="bulk-edit-description">
                    Edit quantities, cards, or sections as free text. Changes
                    are applied together.
                  </p>
                </div>
                <button
                  className="icon-action"
                  aria-label="Close bulk decklist editor"
                  onClick={() => {
                    setShowBulkEdit(false);
                  }}
                >
                  <MaterialIcon name="close" />
                </button>
              </div>
              {bulkEditErrors.length > 0 && (
                <div className="notice error" role="alert">
                  {bulkEditErrors.map((message) => (
                    <p key={message}>{message}</p>
                  ))}
                </div>
              )}
              <label className="bulk-edit-field">
                Decklist
                <textarea
                  aria-label="Decklist"
                  value={bulkDecklist}
                  onChange={(event) => {
                    setBulkDecklist(event.target.value);
                  }}
                  spellCheck={false}
                />
              </label>
              <div className="button-row bulk-edit-actions">
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => {
                    setShowBulkEdit(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  disabled={busy || bulkDecklist.trim() === ""}
                  onClick={() => void applyBulkEdit()}
                >
                  {busy ? "Applying changes…" : "Apply changes"}
                </button>
              </div>
            </section>
          </div>
        )}
        {showEditDeck && (
          <div
            className="modal-backdrop"
            onClick={() => {
              setShowEditDeck(false);
            }}
          >
            <form
              className="add-deck-modal guidance-edit-modal stack"
              ref={editDeckDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-deck-title"
              aria-describedby="edit-deck-description"
              tabIndex={-1}
              onSubmit={(event) => {
                event.preventDefault();
                void handleSaveDetails(event).then((saved) => {
                  if (saved) setShowEditDeck(false);
                });
              }}
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              <div className="page-heading">
                <h2 id="edit-deck-title">Edit deck</h2>
                <button
                  className="icon-action"
                  type="button"
                  aria-label="Close"
                  onClick={() => {
                    setShowEditDeck(false);
                  }}
                >
                  <MaterialIcon name="close" />
                </button>
              </div>
              <p className="muted" id="edit-deck-description">
                Define the deck's North Star. Card roles and scores are
                evaluated automatically.
              </p>
              <label>
                Title
                <input
                  autoFocus
                  maxLength={120}
                  required
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                  }}
                />
              </label>
              <label>
                Description
                <textarea
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value);
                  }}
                />
              </label>
              <label>
                Goal / North Star
                <textarea
                  value={goal}
                  onChange={(event) => {
                    setGoal(event.target.value);
                  }}
                  placeholder="What should this deck consistently accomplish?"
                />
              </label>
              <label>
                Format
                <input readOnly value={deck.format} />
              </label>
              <button disabled={busy}>Save changes</button>
            </form>
          </div>
        )}
        {showHistory && (
          <div
            className="modal-backdrop"
            onClick={() => {
              setShowHistory(false);
            }}
          >
            <section
              className="history-modal"
              ref={historyDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="history-title"
              aria-describedby="history-description"
              tabIndex={-1}
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              <div className="page-heading">
                <div>
                  <h2 id="history-title">Deck history</h2>
                  <p id="history-description">
                    {operations.length} recorded{" "}
                    {operations.length === 1 ? "change" : "changes"}
                  </p>
                </div>
                <button
                  className="icon-action"
                  aria-label="Close deck history"
                  onClick={() => {
                    setShowHistory(false);
                  }}
                >
                  <MaterialIcon name="close" />
                </button>
              </div>
              <div className="history-list">
                {operations.length === 0 && (
                  <p className="muted">No changes have been recorded.</p>
                )}
                {operations.map((operation) => (
                  <details className="history-entry" key={operation.id}>
                    <summary>
                      <span>
                        <strong>
                          <InlineCardText
                            text={operation.reason ?? "Deck update"}
                          />
                        </strong>
                        <small>
                          Version {operation.revision_after} ·{" "}
                          {new Date(operation.created_at).toLocaleString()} ·{" "}
                          {operation.changes.length}{" "}
                          {operation.changes.length === 1
                            ? "change"
                            : "changes"}
                        </small>
                      </span>
                      <button
                        disabled={busy}
                        onClick={(event) => {
                          event.preventDefault();
                          void handleRevert(operation);
                        }}
                      >
                        Undo
                      </button>
                    </summary>
                    <div>
                      {operation.changes.map((change, index) => (
                        <small key={`${change.printing_id}-${String(index)}`}>
                          {change.quantity_delta > 0 ? "+" : ""}
                          {change.quantity_delta}{" "}
                          <InlineCardText text={`[[${change.card_name}]]`} /> ·{" "}
                          {zoneLabel(change.zone)}
                        </small>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          </div>
        )}
        {printingCardset !== null && (
          <PrintingPicker
            cardset={printingCardset}
            close={() => {
              setPrintingCardset(null);
            }}
            select={(printing, finish) => {
              changePrinting(printingCardset, printing, finish);
            }}
          />
        )}
      </main>
    </CardPresentationProvider>
  );
}

const rootElement = document.getElementById("root");
if (rootElement === null) throw new Error("Root element was not found");
createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
