import { GripVertical } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type SetStateAction,
} from "react";

import type { DeckTag } from "../../modules/decks/contracts";
import { IconButton } from "../../designsystem/primitives/button";
import { listenForPointerDrag } from "../../core/continuousEventFrame";
import { useDeckCardsContext } from "./deckEditorContext";

export interface TagColumnReorderPreview {
  side: "after" | "before";
  sourceId: string;
  targetId: string;
}

export function nextTagColumnReorderPreview(
  current: TagColumnReorderPreview | null,
  next: TagColumnReorderPreview,
): TagColumnReorderPreview {
  return current !== null &&
    current.side === next.side &&
    current.sourceId === next.sourceId &&
    current.targetId === next.targetId
    ? current
    : next;
}

interface TagColumnOrderContextValue {
  preview: TagColumnReorderPreview | null;
  setPreview: Dispatch<SetStateAction<TagColumnReorderPreview | null>>;
}

const TagColumnOrderContext = createContext<TagColumnOrderContextValue | null>(
  null,
);

export function TagColumnOrderProvider({ children }: { children: ReactNode }) {
  const [preview, setPreview] = useState<TagColumnReorderPreview | null>(null);
  return (
    <TagColumnOrderContext.Provider value={{ preview, setPreview }}>
      {children}
    </TagColumnOrderContext.Provider>
  );
}

export function tagColumnReorderAppearance(
  preview: TagColumnReorderPreview | null,
  tagId: string,
): { dragging: boolean; ghostSide: "after" | "before" | null } {
  return {
    dragging: preview?.sourceId === tagId,
    ghostSide: preview?.targetId === tagId ? preview.side : null,
  };
}

function orderedTags(tags: readonly DeckTag[]): DeckTag[] {
  return [...tags].sort(
    (left, right) =>
      left.position - right.position || left.name.localeCompare(right.name),
  );
}

export function reorderedTagIds(
  tags: readonly DeckTag[],
  sourceId: string,
  targetId: string,
  side: "after" | "before",
): string[] {
  const ids = orderedTags(tags).map((tag) => tag.id);
  if (sourceId === targetId || !ids.includes(sourceId)) return ids;
  const withoutSource = ids.filter((id) => id !== sourceId);
  const targetIndex = withoutSource.indexOf(targetId);
  if (targetIndex < 0) return ids;
  withoutSource.splice(targetIndex + (side === "after" ? 1 : 0), 0, sourceId);
  return withoutSource;
}

interface PointerDrag {
  active: boolean;
  originX: number;
  scroll: HTMLElement | null;
  side: "after" | "before";
  targetId: string;
}

function targetAtPoint(x: number, y: number) {
  const target = document
    .elementFromPoint(x, y)
    ?.closest<HTMLElement>("[data-reorder-tag-id]");
  if (target === undefined || target === null) return null;
  const targetId = target.dataset["reorderTagId"];
  if (targetId === undefined) return null;
  const bounds = target.getBoundingClientRect();
  return {
    side:
      x > bounds.left + bounds.width / 2
        ? ("after" as const)
        : ("before" as const),
    targetId,
  };
}

function autoScroll(scroll: HTMLElement | null, x: number): void {
  if (scroll === null) return;
  const bounds = scroll.getBoundingClientRect();
  const edge = 56;
  if (x < bounds.left + edge) scroll.scrollLeft -= 24;
  else if (x > bounds.right - edge) scroll.scrollLeft += 24;
}

export function useTagColumnOrder(tag: DeckTag | null) {
  const {
    actions: { reorderTags },
    data: { busy },
    deck,
  } = useDeckCardsContext();
  const orderContext = useContext(TagColumnOrderContext);
  if (orderContext === null)
    throw new Error("useTagColumnOrder requires TagColumnOrderProvider");
  const { preview, setPreview } = orderContext;
  const pointerDrag = useRef<PointerDrag | null>(null);
  const removePointerListeners = useRef<(() => void) | null>(null);
  const tags = deck.tags ?? [];

  const commit = (
    sourceId: string,
    targetId: string,
    side: "after" | "before",
  ): void => {
    const current = orderedTags(tags).map((item) => item.id);
    const next = reorderedTagIds(tags, sourceId, targetId, side);
    if (next.some((id, index) => id !== current[index])) void reorderTags(next);
  };

  const moveWithKeyboard = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (busy || tag === null) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const current = orderedTags(tags);
    const index = current.findIndex((item) => item.id === tag.id);
    const direction = event.key === "ArrowLeft" ? -1 : 1;
    const target = current[index + direction];
    if (target === undefined) return;
    commit(tag.id, target.id, direction < 0 ? "before" : "after");
  };

  const clearPointerDrag = (): PointerDrag | null => {
    const drag = pointerDrag.current;
    pointerDrag.current = null;
    removePointerListeners.current?.();
    setPreview(null);
    return drag;
  };

  const cancelPointerDrag = (): void => {
    clearPointerDrag();
  };

  const movePointerDrag = (x: number, y: number): void => {
    const drag = pointerDrag.current;
    if (drag === null) return;
    if (!drag.active && Math.abs(x - drag.originX) < 5) return;
    drag.active = true;
    autoScroll(drag.scroll, x);
    const target = targetAtPoint(x, y);
    if (target !== null) Object.assign(drag, target);
    if (tag !== null) {
      const next = {
        side: drag.side,
        sourceId: tag.id,
        targetId: drag.targetId,
      };
      setPreview((current) => nextTagColumnReorderPreview(current, next));
    }
  };

  const finishPointerDrag = (x: number, y: number): void => {
    const drag = clearPointerDrag();
    if (drag === null || tag === null) return;
    const target = targetAtPoint(x, y) ?? drag;
    commit(tag.id, target.targetId, target.side);
  };

  const startPointerDrag = (event: PointerEvent<HTMLButtonElement>): void => {
    if (
      busy ||
      tag === null ||
      (event.pointerType === "mouse" && event.button !== 0)
    )
      return;
    const pointerId = event.pointerId;
    pointerDrag.current = {
      active: false,
      originX: event.clientX,
      scroll: event.currentTarget.closest<HTMLElement>(
        ".ds-cards-zone-row-scroll",
      ),
      side: "before",
      targetId: tag.id,
    };
    const remove = listenForPointerDrag(pointerId, {
      cancel: cancelPointerDrag,
      move: ({ x, y }) => {
        movePointerDrag(x, y);
      },
      up: ({ x, y }) => {
        finishPointerDrag(x, y);
      },
    });
    removePointerListeners.current = () => {
      remove();
      removePointerListeners.current = null;
    };
  };

  useEffect(
    () => () => {
      removePointerListeners.current?.();
    },
    [],
  );

  const appearance = tagColumnReorderAppearance(preview, tag?.id ?? "");
  return {
    ...appearance,
    dropProps: tag === null ? {} : { "data-reorder-tag-id": tag.id },
    handle:
      tag === null ? null : (
        <IconButton
          aria-disabled={busy}
          aria-pressed={appearance.dragging}
          dragHandle
          label={`Move ${tag.name} tag column`}
          onKeyDown={moveWithKeyboard}
          onPointerDown={startPointerDrag}
          size="sm"
          title="Drag to reorder; use Left and Right arrow keys"
          variant="ghost"
        >
          <GripVertical size={14} strokeWidth={2.75} />
        </IconButton>
      ),
  };
}
