import { GripVertical } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import type { DeckTag } from "../../modules/decks/contracts";
import { IconButton } from "../../designsystem/primitives/button";
import { useDeckCardsContext } from "./deckEditorContext";

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
  const [active, setActive] = useState(false);
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
    setActive(false);
    return drag;
  };

  const cancelPointerDrag = (): void => {
    clearPointerDrag();
  };

  const movePointerDrag = (x: number, y: number): void => {
    const drag = pointerDrag.current;
    if (drag === null) return;
    if (!active && Math.abs(x - drag.originX) < 5) return;
    setActive(true);
    autoScroll(drag.scroll, x);
    const target = targetAtPoint(x, y);
    if (target !== null) Object.assign(drag, target);
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
      originX: event.clientX,
      scroll: event.currentTarget.closest<HTMLElement>(
        ".ds-cards-zone-row-scroll",
      ),
      side: "before",
      targetId: tag.id,
    };
    const handleMove = (pointerEvent: globalThis.PointerEvent): void => {
      if (pointerEvent.pointerId !== pointerId) return;
      pointerEvent.preventDefault();
      movePointerDrag(pointerEvent.clientX, pointerEvent.clientY);
    };
    const handleUp = (pointerEvent: globalThis.PointerEvent): void => {
      if (pointerEvent.pointerId === pointerId)
        finishPointerDrag(pointerEvent.clientX, pointerEvent.clientY);
    };
    const handleCancel = (pointerEvent: globalThis.PointerEvent): void => {
      if (pointerEvent.pointerId === pointerId) cancelPointerDrag();
    };
    window.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleCancel);
    removePointerListeners.current = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleCancel);
      removePointerListeners.current = null;
    };
  };

  useEffect(
    () => () => {
      removePointerListeners.current?.();
    },
    [],
  );

  return {
    active,
    dropProps: tag === null ? {} : { "data-reorder-tag-id": tag.id },
    handle:
      tag === null ? null : (
        <IconButton
          aria-disabled={busy}
          aria-pressed={active}
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
