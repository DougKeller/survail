import { createContext, useContext } from "react";

import type {
  CardZoneDragStaticValue,
  CardZoneDragValue,
} from "./cardZoneDragTypes";

export const CardZoneDragContext = createContext<CardZoneDragValue | null>(
  null,
);
export const CardZoneDragStaticContext =
  createContext<CardZoneDragStaticValue | null>(null);

export function useCardZoneDrag(): CardZoneDragValue {
  const value = useContext(CardZoneDragContext);
  if (value === null)
    throw new Error("useCardZoneDrag requires CardZoneDragProvider");
  return value;
}

export function useOptionalCardZoneDrag(): CardZoneDragValue | null {
  return useContext(CardZoneDragContext);
}

export function useOptionalCardZoneDragStatic(): CardZoneDragStaticValue | null {
  return useContext(CardZoneDragStaticContext);
}
