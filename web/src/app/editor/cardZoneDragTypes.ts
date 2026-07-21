import type { DragEvent, KeyboardEvent, PointerEvent, ReactNode } from "react";

import type { CardSet } from "../../modules/decks/contracts";
import type { CardZoneMatrixRowZone } from "../deck/cardZoneMatrix";

export const CARD_ZONE_DROP_TAG_SELECTOR = "[data-drop-tag-id]";
export const CREATE_TAG_DROP_ID = "__create_tag__";

export interface DraggedCard {
  card: CardSet;
  visualId: string;
}

export interface CardZoneDragProviderProps {
  busy: boolean;
  children?: ReactNode;
  createTagForCard?: (card: CardSet) => void;
  moveCard: (card: CardSet, zone: CardZoneMatrixRowZone) => void;
  tagCard?: (card: CardSet, tagId: string) => void;
  zones: readonly CardZoneMatrixRowZone[];
}

export interface CardZoneDragValue {
  activeTagTarget: string | null;
  activeTagZone: CardZoneMatrixRowZone | null;
  activeTarget: CardZoneMatrixRowZone | null;
  cancel: () => void;
  dragged: DraggedCard | null;
  draggableProps: (
    card: CardSet,
    visualId: string,
  ) => {
    draggable: boolean;
    onDrag: (event: DragEvent<HTMLElement>) => void;
    onDragEnd: () => void;
    onDragStart: (event: DragEvent<HTMLElement>) => void;
  };
  handleProps: (
    card: CardSet,
    visualId: string,
  ) => {
    "aria-label": string;
    "aria-pressed": boolean;
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
    onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => void;
    onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
  };
  instruction: string;
  tagColumnProps: (
    tagId: string,
    zone: CardZoneMatrixRowZone,
  ) => {
    "data-drop-tag-id": string;
    onDragEnter: (event: DragEvent<HTMLElement>) => void;
    onDragOver: (event: DragEvent<HTMLElement>) => void;
    onDrop: (event: DragEvent<HTMLElement>) => void;
  };
  rowProps: (zone: CardZoneMatrixRowZone) => {
    "data-drop-zone": CardZoneMatrixRowZone;
    onDragEnter: () => void;
    onDragOver: (event: DragEvent<HTMLElement>) => void;
    onDrop: (event: DragEvent<HTMLElement>) => void;
  };
}

export type CardZoneDragStaticValue = Pick<CardZoneDragValue, "draggableProps">;
