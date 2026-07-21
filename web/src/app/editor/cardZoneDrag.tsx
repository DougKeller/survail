/* eslint-disable max-lines -- The provider keeps one drag session's input modes and feedback synchronized. */
import {
  useCallback,
  useEffect,
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
  CardZoneDragStaticValue,
  CardZoneDragValue,
  DraggedCard,
} from "./cardZoneDragTypes";
import { CREATE_TAG_DROP_ID } from "./cardZoneDragTypes";
import {
  CardZoneDragContext,
  CardZoneDragStaticContext,
} from "./cardZoneDragContext";
import { CardZoneDragPreview } from "./cardZoneDragPreview";
import { dropTargetAtPoint, nextDropZone } from "./cardZoneDropTargets";
import {
  createLatestFrame,
  type LatestFrame,
} from "../../core/continuousEventFrame";
import { autoScrollCardRow } from "./dragAutoScroll";
import { clampDragPreviewPoint } from "./dragPreviewPosition";

export {
  useCardZoneDrag,
  useOptionalCardZoneDrag,
  useOptionalCardZoneDragStatic,
} from "./cardZoneDragContext";

export function CardZoneDragProvider({
  busy,
  children,
  createTagForCard,
  moveCard,
  tagCard,
  zones,
}: CardZoneDragProviderProps) {
  const [dragged, setDragged] = useState<DraggedCard | null>(null);
  const draggedRef = useRef<DraggedCard | null>(null);
  const [activeTarget, setActiveTarget] =
    useState<CardZoneMatrixRowZone | null>(null);
  const [activeTagTarget, setActiveTagTarget] = useState<string | null>(null);
  const [activeTagZone, setActiveTagZone] =
    useState<CardZoneMatrixRowZone | null>(null);
  const [instruction, setInstruction] = useState("");
  const [previewPoint, setPreviewPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const scrollFrame = useRef<number | null>(null);
  const scrollPoint = useRef<{ x: number; y: number } | null>(null);
  const previewFrame = useRef<LatestFrame<{ x: number; y: number }> | null>(
    null,
  );
  const movePreview = useCallback((x: number, y: number) => {
    previewFrame.current ??= createLatestFrame((point) => {
      setPreviewPoint(
        clampDragPreviewPoint(
          point.x,
          point.y,
          window.innerWidth,
          window.innerHeight,
        ),
      );
    });
    previewFrame.current.push({ x, y });
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
    previewFrame.current?.cancel();
    draggedRef.current = null;
    setDragged(null);
    setActiveTarget(null);
    setActiveTagTarget(null);
    setActiveTagZone(null);
    setInstruction("");
    setPreviewPoint(null);
  }, [stopAutoScroll]);

  useEffect(
    () => () => {
      stopAutoScroll();
      previewFrame.current?.cancel();
    },
    [stopAutoScroll],
  );

  const start = useCallback((card: CardSet, visualId: string) => {
    const nextDragged = { card, visualId };
    draggedRef.current = nextDragged;
    setDragged(nextDragged);
    setActiveTagTarget(null);
    setActiveTagZone(null);
    setActiveTarget(null);
    setInstruction(
      `Picked up one ${card.card_name}. Use arrow keys to choose a row, Enter to move, or Escape to cancel.`,
    );
  }, []);

  const commit = useCallback(
    (zone: CardZoneMatrixRowZone | null) => {
      const currentDragged = draggedRef.current;
      if (
        currentDragged !== null &&
        zone !== null &&
        currentDragged.card.zone !== zone
      ) {
        moveCard(currentDragged.card, zone);
      }
      cancel();
    },
    [cancel, moveCard],
  );

  const commitTag = useCallback(
    (tagId: string | null) => {
      const currentDragged = draggedRef.current;
      if (currentDragged !== null && tagId !== null)
        tagCard?.(currentDragged.card, tagId);
      cancel();
    },
    [cancel, tagCard],
  );

  const targetColumn = useCallback(
    (tagId: string, zone: CardZoneMatrixRowZone) => {
      const currentDragged = draggedRef.current;
      if (currentDragged === null) return;
      if (currentDragged.card.zone !== zone) {
        setActiveTagTarget(null);
        setActiveTagZone(null);
        setActiveTarget(zone);
        setInstruction(`Move one ${currentDragged.card.card_name} to ${zone}.`);
        return;
      }
      setActiveTarget(null);
      setActiveTagTarget(tagId);
      setActiveTagZone(zone);
      setInstruction(
        tagId === CREATE_TAG_DROP_ID
          ? `Create a tag for ${currentDragged.card.card_name}.`
          : `Add ${currentDragged.card.card_name} to this tag.`,
      );
    },
    [],
  );

  const commitColumn = useCallback(
    (tagId: string, zone: CardZoneMatrixRowZone) => {
      const currentDragged = draggedRef.current;
      if (currentDragged === null) return;
      if (currentDragged.card.zone !== zone) {
        commit(zone);
        return;
      }
      if (tagId === CREATE_TAG_DROP_ID) {
        createTagForCard?.(currentDragged.card);
        cancel();
        return;
      }
      commitTag(tagId);
    },
    [cancel, commit, commitTag, createTagForCard],
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
        // Row drops move one card, while tag-column drops copy tag membership.
        // Browsers may reject a `copy` drop when the source only permits move.
        event.dataTransfer.effectAllowed = "copyMove";
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
        const { tagId, zone } = dropTargetAtPoint(event.clientX, event.clientY);
        if (tagId !== null && zone !== null) targetColumn(tagId, zone);
        else {
          setActiveTagTarget(null);
          setActiveTagZone(null);
          setActiveTarget(zone);
        }
      },
      onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
        if (dragged === null || event.pointerType === "mouse") return;
        const { tagId, zone } = dropTargetAtPoint(event.clientX, event.clientY);
        if (tagId !== null && zone !== null) commitColumn(tagId, zone);
        else commit(zone);
      },
      onPointerCancel: cancel,
      onLostPointerCapture: cancel,
    }),
    [
      activeTarget,
      busy,
      cancel,
      commit,
      commitColumn,
      dragged,
      keepAutoScrolling,
      movePreview,
      start,
      targetColumn,
      zones,
    ],
  );

  const tagColumnProps = useCallback(
    (tagId: string, zone: CardZoneMatrixRowZone) => ({
      "data-drop-tag-id": tagId,
      onDragEnter: (event: DragEvent<HTMLElement>) => {
        if (draggedRef.current === null) return;
        event.stopPropagation();
        targetColumn(tagId, zone);
      },
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (draggedRef.current === null) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect =
          draggedRef.current.card.zone === zone ? "copy" : "move";
        targetColumn(tagId, zone);
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();
        commitColumn(tagId, zone);
      },
    }),
    [commitColumn, targetColumn],
  );

  const rowProps = useCallback(
    (zone: CardZoneMatrixRowZone) => ({
      "data-drop-zone": zone,
      onDragEnter: () => {
        if (draggedRef.current !== null) {
          setActiveTagTarget(null);
          setActiveTagZone(null);
          setActiveTarget(zone);
        }
      },
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (draggedRef.current === null) return;
        event.preventDefault();
        keepAutoScrolling(event.clientX, event.clientY);
        event.dataTransfer.dropEffect = "move";
        setActiveTagTarget(null);
        setActiveTagZone(null);
        setActiveTarget(zone);
        const currentDragged = draggedRef.current;
        if (currentDragged.card.zone !== zone)
          setInstruction(
            `Move one ${currentDragged.card.card_name} to ${zone}.`,
          );
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        commit(zone);
      },
    }),
    [commit, keepAutoScrolling],
  );

  const value = useMemo<CardZoneDragValue>(
    () => ({
      activeTagTarget,
      activeTagZone,
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
      activeTagZone,
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
  const staticValue = useMemo<CardZoneDragStaticValue>(
    () => ({ draggableProps }),
    [draggableProps],
  );
  return (
    <CardZoneDragStaticContext.Provider value={staticValue}>
      <CardZoneDragContext.Provider value={value}>
        {children}
        <CardZoneDragPreview dragged={dragged} point={previewPoint} />
      </CardZoneDragContext.Provider>
    </CardZoneDragStaticContext.Provider>
  );
}
