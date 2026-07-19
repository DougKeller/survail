import { afterEach, describe, expect, it, vi } from "vitest";

import { clearDeckEvaluationCache } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("clearDeckEvaluationCache", () => {
  it("deletes the current deck score cache", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(clearDeckEvaluationCache("deck-1")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/decks/deck-1/card-evaluations/current/cached",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
