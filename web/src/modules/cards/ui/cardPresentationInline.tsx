import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import {
  cardDetails,
  cardName,
  imageSource,
  type CardPresentationSource,
  useOptionalCardPresentation,
  useCardPresentation,
} from "./cardPresentationShared";

export function ClickableCardImage({
  card,
  className = "",
  loading = "lazy",
}: {
  card: CardPresentationSource;
  className?: string;
  loading?: "eager" | "lazy";
}) {
  const presentation = useOptionalCardPresentation();
  const details = cardDetails(card);
  const name = cardName(card);
  const source = imageSource(details.card);

  if (presentation === null) {
    return (
      <div className={`clickable-card-image ${className}`.trim()}>
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
      </div>
    );
  }

  return (
    <button
      aria-label={`View details for ${name}`}
      className={`clickable-card-image ${className}`.trim()}
      onClick={() => {
        presentation.openCard(card);
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
