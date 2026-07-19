import { describe, expect, it } from "vitest";

import {
  evaluationProvenanceLabel,
  promptVersionLabel,
} from "./evaluationProvenance";

describe("evaluation provenance", () => {
  it("shortens artifact hashes for display", () => {
    expect(promptVersionLabel("gepa-1234567890abcdef")).toBe("gepa-12345678");
    expect(promptVersionLabel("legacy")).toBe("legacy");
  });

  it("identifies both the scorer and exact prompt", () => {
    expect(
      evaluationProvenanceLabel({
        evaluator_version: "roles-v19",
        prompt_version: "gepa-1234567890abcdef",
      }),
    ).toBe("Judge roles-v19 · Prompt gepa-12345678");
  });
});
