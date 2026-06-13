import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import type { CardSet, ScryfallCard } from "./types";
import "./cardPresentation.css";

export type CardPresentationSource = CardSet | ScryfallCard;

interface CardPresentationContextValue {
  cardsByName: ReadonlyMap<string, CardPresentationSource>;
  openCard: (card: CardPresentationSource) => void;
}

interface CardDetails {
  card: ScryfallCard;
  finish: string | null;
}

const CardPresentationContext =
  createContext<CardPresentationContextValue | null>(null);

function isCardSet(source: CardPresentationSource): source is CardSet {
  return "scryfall" in source;
}

function cardDetails(source: CardPresentationSource): CardDetails {
  return isCardSet(source)
    ? { card: source.scryfall, finish: source.finish }
    : { card: source, finish: null };
}

function cardName(source: CardPresentationSource): string {
  return isCardSet(source) ? source.card_name : source.name;
}

function imageSource(card: ScryfallCard): string | null {
  return (
    card.image_uris?.normal ?? card.card_faces[0]?.image_uris?.normal ?? null
  );
}

function focusableElements(container: HTMLElement): HTMLElement[] {
  return [
    ...container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ];
}

function displayPrice(
  label: string,
  value: string | null | undefined,
): ReactNode {
  return value === null || value === undefined ? null : (
    <span>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </span>
  );
}

function CardDetailsModal({
  source,
  close,
}: {
  source: CardPresentationSource;
  close: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const details = cardDetails(source);
  const card = details.card;
  const image = imageSource(card);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialogRef.current?.focus();
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key !== "Tab" || dialogRef.current === null) return;
      const focusable = focusableElements(dialogRef.current);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (first === undefined || last === undefined) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [close]);

  return createPortal(
    <div className="card-presentation-backdrop" onMouseDown={close}>
      <section
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="card-details-modal"
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="card-details-header">
          <div>
            <h2 id={titleId}>{card.name}</h2>
            <p id={descriptionId}>{card.type_line}</p>
          </div>
          <button
            aria-label="Close card details"
            className="card-details-close"
            onClick={close}
            type="button"
          >
            <span aria-hidden="true" className="material-symbols-outlined">
              close
            </span>
          </button>
        </header>
        <div className="card-details-content">
          <div className="card-details-art">
            {image === null ? (
              <div
                aria-label={`${card.name}, image unavailable`}
                className="card-presentation-placeholder"
                role="img"
              >
                {card.name}
              </div>
            ) : (
              <img alt={card.name} src={image} />
            )}
          </div>
          <div className="card-details-copy">
            {card.mana_cost !== null && (
              <p className="card-details-mana">
                <strong>Mana cost</strong>
                <span>{card.mana_cost}</span>
              </p>
            )}
            <p className="card-details-oracle">
              {card.oracle_text ?? "Oracle text unavailable."}
            </p>
            <dl className="card-details-facts">
              <span>
                <dt>Set</dt>
                <dd>
                  {card.set_name} ({card.set.toUpperCase()})
                </dd>
              </span>
              <span>
                <dt>Rarity</dt>
                <dd>{card.rarity}</dd>
              </span>
              {details.finish !== null && (
                <span>
                  <dt>Finish</dt>
                  <dd>{details.finish}</dd>
                </span>
              )}
              {details.finish === null && card.finishes.length > 0 && (
                <span>
                  <dt>Finishes</dt>
                  <dd>{card.finishes.join(", ")}</dd>
                </span>
              )}
              {card.released_at !== undefined && card.released_at !== null && (
                <span>
                  <dt>Released</dt>
                  <dd>{card.released_at}</dd>
                </span>
              )}
            </dl>
            {card.prices !== undefined && (
              <section
                aria-labelledby={`${titleId}-prices`}
                className="card-details-prices"
              >
                <h3 id={`${titleId}-prices`}>Market prices</h3>
                <dl>
                  {displayPrice("TCGplayer", card.prices.usd)}
                  {displayPrice("TCGplayer foil", card.prices.usd_foil)}
                  {displayPrice("TCGplayer etched", card.prices.usd_etched)}
                  {displayPrice("Cardmarket", card.prices.eur)}
                  {displayPrice("Cardmarket foil", card.prices.eur_foil)}
                  {displayPrice("Cardhoarder", card.prices.tix)}
                </dl>
              </section>
            )}
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function CardPresentationProvider({
  cards,
  children,
}: {
  cards: readonly CardPresentationSource[];
  children: ReactNode;
}) {
  const [selectedCard, setSelectedCard] =
    useState<CardPresentationSource | null>(null);
  const cardsByName = useMemo(
    () =>
      new Map(
        cards.map(
          (card) => [cardName(card).toLocaleLowerCase(), card] as const,
        ),
      ),
    [cards],
  );
  const openCard = useCallback((card: CardPresentationSource): void => {
    setSelectedCard(card);
  }, []);
  const closeCard = useCallback((): void => {
    setSelectedCard(null);
  }, []);
  const value = useMemo(
    () => ({ cardsByName, openCard }),
    [cardsByName, openCard],
  );

  return (
    <CardPresentationContext.Provider value={value}>
      {children}
      {selectedCard !== null && (
        <CardDetailsModal close={closeCard} source={selectedCard} />
      )}
    </CardPresentationContext.Provider>
  );
}

function useCardPresentation(): CardPresentationContextValue {
  const context = useContext(CardPresentationContext);
  if (context === null) {
    throw new Error(
      "useCardPresentation must be used within CardPresentationProvider",
    );
  }
  return context;
}

export function ClickableCardImage({
  card,
  className = "",
  loading = "lazy",
}: {
  card: CardPresentationSource;
  className?: string;
  loading?: "eager" | "lazy";
}) {
  const { openCard } = useCardPresentation();
  const details = cardDetails(card);
  const name = cardName(card);
  const source = imageSource(details.card);

  return (
    <button
      aria-label={`View details for ${name}`}
      className={`clickable-card-image ${className}`.trim()}
      onClick={() => {
        openCard(card);
      }}
      type="button"
    >
      {source === null ? (
        <span className="card-presentation-placeholder">
          <span aria-hidden="true" className="material-symbols-outlined">
            image_not_supported
          </span>
          {name}
        </span>
      ) : (
        <img alt={name} loading={loading} src={source} />
      )}
    </button>
  );
}

function InlineCardReference({
  card,
  label,
}: {
  card: CardPresentationSource;
  label: string;
}) {
  const { openCard } = useCardPresentation();
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewStyle, setPreviewStyle] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const details = cardDetails(card);
  const source = imageSource(details.card);

  const updatePreviewPosition = useCallback((): void => {
    const trigger = triggerRef.current;
    if (trigger === null) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 12;
    const previewWidth = Math.min(240, window.innerWidth - 32);
    const preferredLeft = rect.right + gap;
    const left =
      preferredLeft + previewWidth <= window.innerWidth - 16
        ? preferredLeft
        : Math.max(16, rect.left - previewWidth - gap);
    const top = Math.max(16, Math.min(rect.top, window.innerHeight - 352));
    setPreviewStyle({ left, top });
  }, []);

  const showPreview = useCallback((): void => {
    updatePreviewPosition();
    setPreviewVisible(true);
  }, [updatePreviewPosition]);

  const hidePreview = useCallback((): void => {
    setPreviewVisible(false);
    setPreviewStyle(null);
  }, []);

  useEffect(() => {
    if (!previewVisible) return undefined;
    function handleViewportChange(): void {
      updatePreviewPosition();
    }
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);
    return () => {
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [previewVisible, updatePreviewPosition]);

  function onKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>): void {
    if (event.key === "Escape") hidePreview();
  }

  return (
    <span className="inline-card-reference">
      <button
        aria-haspopup="dialog"
        className="inline-card-reference-trigger"
        onBlur={hidePreview}
        onClick={() => {
          openCard(card);
        }}
        onFocus={showPreview}
        onKeyDown={onKeyDown}
        onMouseEnter={showPreview}
        onMouseLeave={hidePreview}
        ref={triggerRef}
        type="button"
      >
        {label}
      </button>
      {previewVisible &&
        source !== null &&
        previewStyle !== null &&
        createPortal(
          <span
            className="inline-card-preview"
            role="tooltip"
            style={{
              left: `${String(previewStyle.left)}px`,
              top: `${String(previewStyle.top)}px`,
            }}
          >
            <img alt="" src={source} />
          </span>,
          document.body,
        )}
    </span>
  );
}

export function InlineCardText({
  text,
  cards = [],
}: {
  text: string;
  cards?: readonly CardPresentationSource[];
}) {
  const context = useCardPresentation();
  const localCards = useMemo(
    () =>
      new Map(
        cards.map(
          (card) => [cardName(card).toLocaleLowerCase(), card] as const,
        ),
      ),
    [cards],
  );
  const pattern = /\[\[([^[\]]+)\]\]/g;
  const content: ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  for (const match of text.matchAll(pattern)) {
    const index = match.index;
    const fullMatch = match[0];
    const matchedName = match[1];
    if (matchedName === undefined) continue;
    if (index > cursor)
      content.push(
        <span key={String(key++)}>{text.slice(cursor, index)}</span>,
      );
    const card =
      localCards.get(matchedName.toLocaleLowerCase()) ??
      context.cardsByName.get(matchedName.toLocaleLowerCase());
    content.push(
      card === undefined ? (
        <span key={String(key++)}>{matchedName}</span>
      ) : (
        <InlineCardReference
          card={card}
          key={String(key++)}
          label={cardName(card)}
        />
      ),
    );
    cursor = index + fullMatch.length;
  }
  if (cursor < text.length)
    content.push(<span key={String(key)}>{text.slice(cursor)}</span>);

  return <span className="inline-card-text">{content}</span>;
}
