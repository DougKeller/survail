import { request } from "../../../core/http/client";

import { printingPreferences } from "./preferences";

import type {
  CreateMoxfieldDeckInput,
  ImportPreferences,
  MoxfieldDeckImportResult,
  MoxfieldImportPreview,
} from "../contracts";

export function importMoxfield(
  decklist: string,
  preferences: ImportPreferences,
  preservePrintings = false,
): Promise<MoxfieldImportPreview> {
  return request<MoxfieldImportPreview>("/imports/moxfield", {
    method: "POST",
    body: JSON.stringify({
      decklist,
      preserve_tags: preferences.preserveTags,
      preserve_printings: preservePrintings,
      printing_preferences: printingPreferences(preferences),
    }),
  });
}

export function createMoxfieldDeck({
  title,
  format,
  decklist,
  preferences,
}: CreateMoxfieldDeckInput): Promise<MoxfieldDeckImportResult> {
  return request<MoxfieldDeckImportResult>("/imports/moxfield/decks", {
    method: "POST",
    body: JSON.stringify({
      title,
      format,
      description: "",
      decklist,
      preserve_tags: preferences.preserveTags,
      printing_preferences: printingPreferences(preferences),
    }),
  });
}
