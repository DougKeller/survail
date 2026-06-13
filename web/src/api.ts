import type {
  AgentUiEvent,
  CardEvaluationProgress,
  CardRoleEvaluation,
  Deck,
  DeckConversation,
  DeckFormat,
  DeckGuidanceProposal,
  DeckOperation,
  DeckOperationChangeInput,
  DeckOperationResult,
  DeckUpdate,
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

async function streamEvents(
  path: string,
  body: object,
  onEvent: (event: AgentUiEvent) => void,
): Promise<"completed" | "interrupted"> {
  const startedAt = performance.now();
  console.info("deck-agent stream request", { path });
  const response = await fetch(`${API}${path}`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!response.ok || response.body === null) {
    const responseText = await response.text();
    console.error("deck-agent stream rejected", { path, status: response.status, responseText });
    throw new ApiError(responseText, response.status);
  }
  console.info("deck-agent stream opened", { path, status: response.status });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let reading = true;
  let runId = "unknown";
  let terminalType: "run_completed" | "run_failed" | null = null;
  try {
    while (reading) {
      const chunk = await reader.read();
      if (chunk.done) {
        reading = false;
        continue;
      }
      buffer += decoder.decode(chunk.value, { stream: true });
      const records = buffer.split("\n\n");
      buffer = records.pop() ?? "";
      for (const record of records) {
        const data = record.split("\n").find((line) => line.startsWith("data: "));
        if (data !== undefined) {
          const event = JSON.parse(data.slice(6)) as AgentUiEvent;
          runId = event.run_id;
          if (event.type === "run_completed" || event.type === "run_failed") {
            terminalType = event.type;
          }
          console.info("deck-agent stream event", { path, runId: event.run_id, eventType: event.type });
          onEvent(event);
        }
      }
    }
  } catch (reason) {
    console.error("deck-agent stream interrupted", { path, runId, reason });
    onEvent({ type: "stream_closed", run_id: runId, payload: { expected: false, message: "The connection was interrupted. Your partial response is still available." } });
    return "interrupted";
  }
  console.info("deck-agent stream closed", { path, runId, terminalType, durationMs: Math.round(performance.now() - startedAt) });
  onEvent({
    type: "stream_closed",
    run_id: runId,
    payload: {
      expected: terminalType !== null,
      message: terminalType === "run_completed"
        ? "Response complete"
        : terminalType === "run_failed"
            ? "Response ended with an error"
        : "The connection closed before the response finished. You can send another message to continue.",
    },
  });
  return terminalType === null ? "interrupted" : "completed";
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
  updateDeck: (id: string, update: DeckUpdate) =>
    request<Deck>(`/decks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(update),
    }),
  deleteDeck: (id: string) =>
    request<undefined>(`/decks/${id}`, { method: "DELETE" }),
  importMoxfield: (
    decklist: string,
    preferences: ImportPreferences,
    preservePrintings = false,
  ) =>
    request<MoxfieldImportPreview>("/imports/moxfield", {
      method: "POST",
      body: JSON.stringify({
        decklist,
        preserve_tags: preferences.preserveTags,
        preserve_printings: preservePrintings,
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
  evaluateCurrentDeck: (deckId: string) =>
    request<CardRoleEvaluation[]>(`/decks/${deckId}/card-evaluations/current`, {
      method: "POST",
      body: "{}",
    }),
  streamCurrentDeckEvaluation: async (
    deckId: string,
    onProgress: (progress: CardEvaluationProgress) => void,
    onResult: (result: CardRoleEvaluation) => void,
  ): Promise<CardRoleEvaluation[]> => {
    const response = await fetch(`${API}/decks/${deckId}/card-evaluations/current/stream`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!response.ok || response.body === null) throw new ApiError("Could not evaluate cards", response.status);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let reading = true;
    while (reading) {
      const chunk = await reader.read();
      if (chunk.done) {
        reading = false;
        continue;
      }
      buffer += decoder.decode(chunk.value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const data = frame.split("\n").find((line) => line.startsWith("data: "));
        if (data === undefined) continue;
        const event = JSON.parse(data.slice(6)) as
          | { type: "progress"; payload: CardEvaluationProgress }
          | { type: "result"; payload: CardRoleEvaluation }
          | { type: "completed"; payload: { results: CardRoleEvaluation[] } }
          | { type: "failed"; payload: { message: string } };
        if (event.type === "progress") onProgress(event.payload);
        if (event.type === "result") onResult(event.payload);
        if (event.type === "completed") return event.payload.results;
        if (event.type === "failed") throw new ApiError(event.payload.message, 502);
      }
    }
    throw new ApiError("Card evaluation stream closed before completion", 502);
  },
  evaluateCards: (deckId: string, oracleIds: string[]) =>
    request<CardRoleEvaluation[]>(`/decks/${deckId}/card-evaluations/evaluate`, {
      method: "POST",
      body: JSON.stringify({ oracle_ids: oracleIds }),
    }),
  decideGuidanceProposal: (
    deckId: string,
    proposalId: string,
    revision: number,
    decision: "approve" | "reject",
  ) =>
    request<DeckGuidanceProposal>(`/decks/${deckId}/guidance-proposals/${proposalId}/${decision}`, {
      method: "POST",
      body: JSON.stringify({ expected_revision: revision }),
    }),
  generateDescription: (deckId: string, refresh = false) =>
    request<GeneratedDeckDescription>(`/decks/${deckId}/generate-description?refresh=${String(refresh)}`, {
      method: "POST",
    }),
  createConversation: (deckId: string) =>
    request<DeckConversation>(`/decks/${deckId}/conversations`, { method: "POST", body: "{}" }),
  sendAgentMessage: (deckId: string, conversationId: string, message: string, onEvent: (event: AgentUiEvent) => void) =>
    streamEvents(`/decks/${deckId}/conversations/${conversationId}/messages`, { message }, onEvent),
};
