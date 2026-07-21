import { request } from "../../../core/http/client";

import type {
  CreateMoxfieldDeckInput,
  ImportPreferences,
  MoxfieldDeckImportResult,
  MoxfieldImportPreview,
} from "../contracts";

export function importMoxfield(
  decklist: string,
  preferences: ImportPreferences,
  options: { allowAiFallback?: boolean } = {},
): Promise<MoxfieldImportPreview> {
  return request<MoxfieldImportPreview>("/imports/moxfield", {
    method: "POST",
    body: JSON.stringify({
      decklist,
      allow_ai_fallback: options.allowAiFallback ?? true,
      preserve_tags: preferences.preserveTags,
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
    }),
  });
}
