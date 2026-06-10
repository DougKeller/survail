import type {
  Deck,
  DeckFormat,
  DeckOperation,
  DeckOperationChangeInput,
  DeckOperationResult,
  GeneratedDeckDescription,
  ImportPreferences,
  MoxfieldDeckImportResult,
  MoxfieldImportPreview,
  ScryfallCard,
  Validation,
} from "./types";

interface ValidationIssue {
  loc: (string | number)[];
  msg: string;
}

interface ImportIssueDetail {
  errors: { line_number: number; message: string }[];
}

interface ErrorResponse {
  detail?: string | ValidationIssue[] | ImportIssueDetail;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export const API: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const responseBody = await response.text();
    const error =
      responseBody === "" ? {} : (JSON.parse(responseBody) as ErrorResponse);
    throw new ApiError(errorMessage(error.detail, response.statusText), response.status);
  }

  const responseBody = await response.text();
  return responseBody === "" ? (undefined as T) : (JSON.parse(responseBody) as T);
}

function errorMessage(detail: ErrorResponse["detail"], fallback: string): string {
  if (detail === undefined) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((issue) => `${issue.loc.slice(1).join(".") || "Request"}: ${issue.msg}`)
      .join("\n");
  }
  return detail.errors.map((issue) => `Line ${String(issue.line_number)}: ${issue.message}`).join("\n");
}

function metadataFor(format: DeckFormat): object {
  return format === "commander"
    ? { kind: "commander", commander_oracle_ids: [] }
    : format === "brawl"
      ? { kind: "brawl", commander_oracle_id: "" }
      : { kind: "generic" };
}

function printingPreferences(preferences: ImportPreferences): object[] {
  return preferences.rules.map((rule) => ({
    kind: rule.kind,
    ...(rule.kind === "cheapest" ? { buffer_percent: rule.bufferPercent } : {}),
    ...(rule.kind === "frame" ? { frame: rule.frame } : {}),
  }));
}

export const api = {
  me: () =>
    request<{ username: string; display_name: string | null }>("/auth/me"),
  logout: () => request<undefined>("/auth/logout", { method: "POST" }),
  decks: () => request<Deck[]>("/decks"),
  deck: (id: string) => request<Deck>(`/decks/${id}`),
  createDeck: (title: string, format: DeckFormat) =>
    request<Deck>("/decks", {
      method: "POST",
      body: JSON.stringify({
        title,
        format,
        description: "",
        metadata: metadataFor(format),
      }),
    }),
  updateDeck: (id: string, title: string, description: string) =>
    request<Deck>(`/decks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title, description }),
    }),
  deleteDeck: (id: string) =>
    request<undefined>(`/decks/${id}`, { method: "DELETE" }),
  importMoxfield: (
    decklist: string,
    preferences: ImportPreferences,
  ) =>
    request<MoxfieldImportPreview>("/imports/moxfield", {
      method: "POST",
      body: JSON.stringify({
        decklist,
        preserve_tags: preferences.preserveTags,
        printing_preferences: printingPreferences(preferences),
      }),
    }),
  createMoxfieldDeck: (
    title: string,
    format: DeckFormat,
    decklist: string,
    preferences: ImportPreferences,
  ) =>
    request<MoxfieldDeckImportResult>("/imports/moxfield/decks", {
      method: "POST",
      body: JSON.stringify({
        title,
        format,
        description: "",
        decklist,
        preserve_tags: preferences.preserveTags,
        printing_preferences: printingPreferences(preferences),
      }),
    }),
  sample: () =>
    request<Deck>("/decks/sample/commander", { method: "POST", body: "{}" }),
  search: (query: string, preferences: ImportPreferences) =>
    request<{ cards: ScryfallCard[] }>("/cards/search", {
      method: "POST",
      body: JSON.stringify({
        query,
        printing_preferences: printingPreferences(preferences),
      }),
    }),
  printings: (oracleId: string) =>
    request<ScryfallCard[]>(`/cards/oracle/${encodeURIComponent(oracleId)}/printings`),
  applyOperation: (
    deckId: string,
    revision: number,
    changes: DeckOperationChangeInput[],
    reason?: string,
  ) =>
    request<DeckOperationResult>(
      `/decks/${deckId}/operations`,
      {
        method: "POST",
        body: JSON.stringify({
          client_operation_id: crypto.randomUUID(),
          expected_revision: revision,
          reason,
          changes,
        }),
      },
    ),
  operations: (deckId: string, limit = 50, offset = 0) =>
    request<DeckOperation[]>(
      `/decks/${deckId}/operations?limit=${String(limit)}&offset=${String(offset)}`,
    ),
  revertOperation: (deckId: string, operationId: string, revision: number) =>
    request<DeckOperationResult>(
      `/decks/${deckId}/operations/${operationId}/revert`,
      {
        method: "POST",
        body: JSON.stringify({
          client_operation_id: crypto.randomUUID(),
          expected_revision: revision,
        }),
      },
    ),
  validation: (deckId: string) =>
    request<Validation>(`/decks/${deckId}/validation`),
  generateDescription: (deckId: string, refresh = false) =>
    request<GeneratedDeckDescription>(`/decks/${deckId}/generate-description?refresh=${String(refresh)}`, {
      method: "POST",
    }),
};
