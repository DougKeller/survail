import { request } from "../../../core/http/client";
import { metadataFor } from "../../imports/api/preferences";

import type {
  Deck,
  DeckFormat,
  DeckUpdate,
  GeneratedDeckDescription,
  Validation,
} from "../contracts";

export function decks(): Promise<Deck[]> {
  return request<Deck[]>("/decks");
}

export function deck(id: string): Promise<Deck> {
  return request<Deck>(`/decks/${id}`);
}

export function createDeck(title: string, format: DeckFormat): Promise<Deck> {
  return request<Deck>("/decks", {
    method: "POST",
    body: JSON.stringify({
      title,
      format,
      description: "",
      metadata: metadataFor(format),
    }),
  });
}

export function updateDeck(id: string, update: DeckUpdate): Promise<Deck> {
  return request<Deck>(`/decks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(update),
  });
}

export function deleteDeck(id: string): Promise<undefined> {
  return request<undefined>(`/decks/${id}`, { method: "DELETE" });
}

export function sample(): Promise<Deck> {
  return request<Deck>("/decks/sample/commander", {
    method: "POST",
    body: "{}",
  });
}

export function validation(deckId: string): Promise<Validation> {
  return request<Validation>(`/decks/${deckId}/validation`);
}

export function generateDescription(
  deckId: string,
  refresh = false,
): Promise<GeneratedDeckDescription> {
  return request<GeneratedDeckDescription>(
    `/decks/${deckId}/generate-description?refresh=${String(refresh)}`,
    { method: "POST" },
  );
}
