import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  errorMessage,
  metadataFor,
  printingPreferences,
  request,
  streamEvents,
} from "./api";

import type { AgentUiEvent, ImportPreferences } from "./types";

function jsonResponse(
  body: boolean | null | number | object | string,
  init: ResponseInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function sseResponse(events: AgentUiEvent[]): Response {
  const body = events
    .map((event) => `data: ${JSON.stringify(event)}\n\n`)
    .join("");
  return new Response(body, {
    headers: { "Content-Type": "text/event-stream" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("errorMessage", () => {
  it("formats structured validation issues", () => {
    expect(
      errorMessage([{ loc: ["body", "title"], msg: "Required" }], "fallback"),
    ).toBe("title: Required");
  });

  it("formats import preview issues", () => {
    expect(
      errorMessage(
        { errors: [{ line_number: 12, message: "Unknown card" }] },
        "fallback",
      ),
    ).toBe("Line 12: Unknown card");
  });
});

describe("request", () => {
  it("parses successful JSON responses", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(request<{ ok: boolean }>("/health")).resolves.toEqual({
      ok: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/health",
      expect.objectContaining({
        credentials: "include",
      }),
    );
  });

  it("raises ApiError for structured failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(
            { detail: [{ loc: ["body", "format"], msg: "Unsupported" }] },
            { status: 422, statusText: "Unprocessable Entity" },
          ),
        ),
      ),
    );

    await expect(request("/decks")).rejects.toEqual(
      expect.objectContaining({
        message: "format: Unsupported",
        status: 422,
      }),
    );
  });
});

describe("api helpers", () => {
  it("builds format metadata and printing preferences", () => {
    const preferences: ImportPreferences = {
      preserveTags: false,
      rules: [
        { kind: "cheapest", bufferPercent: 10 },
        { kind: "frame", frame: "2015" },
        { kind: "foil" },
      ],
    };

    expect(metadataFor("commander")).toEqual({
      kind: "commander",
      commander_oracle_ids: [],
    });
    expect(metadataFor("brawl")).toEqual({
      kind: "brawl",
      commander_oracle_id: "",
    });
    expect(printingPreferences(preferences)).toEqual([
      { kind: "cheapest", buffer_percent: 10 },
      { kind: "frame", frame: "2015" },
      { kind: "foil" },
    ]);
  });
});

describe("streamEvents", () => {
  it("emits streamed events and completes successfully", async () => {
    const streamed: AgentUiEvent[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          sseResponse([
            {
              type: "run_started",
              run_id: "run-1",
              payload: { message: "Starting" },
            },
            {
              type: "assistant_completed",
              run_id: "run-1",
              payload: { message: "Done" },
            },
            { type: "run_completed", run_id: "run-1", payload: {} },
          ]),
        ),
      ),
    );

    await expect(
      streamEvents("/agent", { message: "hello" }, (event) => {
        streamed.push(event);
      }),
    ).resolves.toBe("completed");
    expect(streamed).toEqual([
      {
        type: "run_started",
        run_id: "run-1",
        payload: { message: "Starting" },
      },
      {
        type: "assistant_completed",
        run_id: "run-1",
        payload: { message: "Done" },
      },
      { type: "run_completed", run_id: "run-1", payload: {} },
      {
        type: "stream_closed",
        run_id: "run-1",
        payload: { expected: true, message: "Response complete" },
      },
    ]);
  });

  it("raises ApiError when the stream request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response("No stream", { status: 502, statusText: "Bad Gateway" }),
        ),
      ),
    );

    await expect(
      streamEvents("/agent", { message: "hello" }, () => undefined),
    ).rejects.toEqual(expect.any(ApiError));
  });
});
