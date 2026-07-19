import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import type { CardSet } from "../../modules/decks/contracts";
import type { CardZoneMatrixRowZone } from "../deck/cardZoneMatrix";
import type {
  CardZoneDragProviderProps,
  CardZoneDragValue,
  DraggedCard,
} from "./cardZoneDragTypes";
import { CardZoneDragContext } from "./cardZoneDragContext";
import { CardZoneDragPreview } from "./cardZoneDragPreview";
import { nextDropZone, tagAtPoint, zoneAtPoint } from "./cardZoneDropTargets";
import { autoScrollCardRow } from "./dragAutoScroll";
import { clampDragPreviewPoint } from "./dragPreviewPosition";

export {
  useCardZoneDrag,
  useOptionalCardZoneDrag,
} from "./cardZoneDragContext";

export function CardZoneDragProvider({
  busy,
  children,
  moveCard,
  tagCard,
  zones,
}: CardZoneDragProviderProps) {
  const [dragged, setDragged] = useState<DraggedCard | null>(null);
  const [activeTarget, setActiveTarget] =
    useState<CardZoneMatrixRowZone | null>(null);
  const [activeTagTarget, setActiveTagTarget] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [previewPoint, setPreviewPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const scrollFrame = useRef<number | null>(null);
  const scrollPoint = useRef<{ x: number; y: number } | null>(null);
  const movePreview = useCallback((x: number, y: number) => {
    setPreviewPoint(
      clampDragPreviewPoint(x, y, window.innerWidth, window.innerHeight),
    );
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = null;
    scrollPoint.current = null;
  }, []);

  const keepAutoScrolling = useCallback((x: number, y: number) => {
    scrollPoint.current = { x, y };
    if (scrollFrame.current !== null) return;
    const tick = () => {
      const point = scrollPoint.current;
      if (point === null) return;
      const moved = autoScrollCardRow(
        document.elementFromPoint(point.x, point.y),
        point.x,
        point.y,
      );
      scrollFrame.current = moved ? requestAnimationFrame(tick) : null;
      if (!moved) scrollPoint.current = null;
    };
    scrollFrame.current = requestAnimationFrame(tick);
  }, []);

  const cancel = useCallback(() => {
    stopAutoScroll();
    setDragged(null);
    setActiveTarget(null);
    setActiveTagTarget(null);
    setInstruction("");
    setPreviewPoint(null);
  }, [stopAutoScroll]);

  const start = useCallback((card: CardSet, visualId: string) => {
    setDragged({ card, visualId });
    setActiveTagTarget(null);
    setActiveTarget(card.zone as CardZoneMatrixRowZone);
    setInstruction(
      `Picked up one ${card.card_name}. Use arrow keys to choose a row, Enter to move, or Escape to cancel.`,
    );
  }, []);

  const commit = useCallback(
    (zone: CardZoneMatrixRowZone | null) => {
      if (dragged !== null && zone !== null && dragged.card.zone !== zone) {
        moveCard(dragged.card, zone);
      }
      cancel();
    },
    [cancel, dragged, moveCard],
  );

  const commitTag = useCallback(
    (tagId: string | null) => {
      if (dragged !== null && tagId !== null) tagCard?.(dragged.card, tagId);
      cancel();
    },
    [cancel, dragged, tagCard],
  );

  const draggableProps = useCallback(
    (card: CardSet, visualId: string) => ({
      draggable: !busy,
      onDrag: (event: DragEvent<HTMLElement>) => {
        if (event.clientX !== 0 || event.clientY !== 0) {
          movePreview(event.clientX, event.clientY);
        }
      },
      onDragEnd: cancel,
      onDragStart: (event: DragEvent<HTMLElement>) => {
        if (busy) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", card.id);
        const emptyDragImage = document.createElement("canvas");
        emptyDragImage.height = 1;
        emptyDragImage.width = 1;
        event.dataTransfer.setDragImage(emptyDragImage, 0, 0);
        movePreview(event.clientX, event.clientY);
        start(card, visualId);
      },
    }),
    [busy, cancel, movePreview, start],
  );

  const handleProps = useCallback(
    (card: CardSet, visualId: string) => ({
      "aria-label": `Move one ${card.card_name} from ${card.zone}`,
      "aria-pressed": dragged?.visualId === visualId,
      onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
        if (busy) return;
        if (event.key === "Escape" && dragged !== null) {
          event.preventDefault();
          cancel();
          return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowRight") {
          event.preventDefault();
          if (dragged === null) start(card, visualId);
          const target = nextDropZone(
            zones,
            dragged === null
              ? (card.zone as CardZoneMatrixRowZone)
              : activeTarget,
            1,
          );
          setActiveTarget(target);
          if (target !== null)
            setInstruction(`Move one ${card.card_name} to ${target}.`);
          return;
        }
        if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
          event.preventDefault();
          if (dragged === null) start(card, visualId);
          const target = nextDropZone(
            zones,
            dragged === null
              ? (card.zone as CardZoneMatrixRowZone)
              : activeTarget,
            -1,
          );
          setActiveTarget(target);
          if (target !== null)
            setInstruction(`Move one ${card.card_name} to ${target}.`);
          return;
        }
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          if (dragged === null) start(card, visualId);
          else commit(activeTarget);
        }
      },
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
        if (busy || event.pointerType === "mouse") return;
        event.currentTarget.setPointerCapture(event.pointerId);
        movePreview(event.clientX, event.clientY);
        start(card, visualId);
      },
      onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
        if (dragged === null || event.pointerType === "mouse") return;
        event.preventDefault();
        keepAutoScrolling(event.clientX, event.clientY);
        movePreview(event.clientX, event.clientY);
        const tagId = tagAtPoint(event.clientX, event.clientY);
        setActiveTagTarget(tagId);
        setActiveTarget(
          tagId === null ? zoneAtPoint(event.clientX, event.clientY) : null,
        );
      },
      onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
        if (dragged === null || event.pointerType === "mouse") return;
        const tagId = tagAtPoint(event.clientX, event.clientY);
        if (tagId === null) commit(zoneAtPoint(event.clientX, event.clientY));
        else commitTag(tagId);
      },
      onPointerCancel: cancel,
      onLostPointerCapture: cancel,
    }),
    [
      activeTarget,
      busy,
      cancel,
      commit,
      commitTag,
      dragged,
      keepAutoScrolling,
      movePreview,
      start,
      zones,
    ],
  );

  const tagColumnProps = useCallback(
    (tagId: string) => ({
      "data-drop-tag-id": tagId,
      onDragEnter: (event: DragEvent<HTMLElement>) => {
        if (dragged === null) return;
        event.stopPropagation();
        setActiveTagTarget(tagId);
        setActiveTarget(null);
      },
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (dragged === null) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "copy";
        setActiveTagTarget(tagId);
        setActiveTarget(null);
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();
        commitTag(tagId);
      },
    }),
    [commitTag, dragged],
  );

  const rowProps = useCallback(
    (zone: CardZoneMatrixRowZone) => ({
      "data-drop-zone": zone,
      onDragEnter: () => {
        if (dragged !== null) {
          setActiveTagTarget(null);
          setActiveTarget(zone);
        }
      },
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (dragged === null) return;
        event.preventDefault();
        keepAutoScrolling(event.clientX, event.clientY);
        event.dataTransfer.dropEffect = "move";
        setActiveTagTarget(null);
        setActiveTarget(zone);
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        commit(zone);
      },
    }),
    [commit, dragged, keepAutoScrolling],
  );

  const value = useMemo<CardZoneDragValue>(
    () => ({
      activeTagTarget,
      activeTarget,
      cancel,
      dragged,
      draggableProps,
      handleProps,
      instruction,
      rowProps,
      tagColumnProps,
    }),
    [
      activeTagTarget,
      activeTarget,
      cancel,
      dragged,
      draggableProps,
      handleProps,
      instruction,
      rowProps,
      tagColumnProps,
    ],
  );
  return (
    <CardZoneDragContext.Provider value={value}>
      {children}
      <CardZoneDragPreview dragged={dragged} point={previewPoint} />
    </CardZoneDragContext.Provider>
  );
}
