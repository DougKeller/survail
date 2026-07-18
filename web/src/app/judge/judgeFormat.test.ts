import { describe, expect, it } from "vitest";

import {
  boundsText,
  failureText,
  percentText,
  rangeBounds,
  sortFailuresFirst,
  withinBounds,
} from "./judgeFormat";

import type { JudgeReferenceCard } from "../../modules/decks/evaluations/contracts";

function goldenCard(name: string, passed: boolean): JudgeReferenceCard {
  return {
    name,
    image_uri: null,
    mana_cost: null,
    type_line: null,
    expectation: {
      must_roles: [],
      forbid_roles: [],
      role_score_ranges: {},
      overall_range: [0, 100],
    },
    result: null,
    passed,
    failures: [],
  };
}

describe("rangeBounds", () => {
  it("reads [low, high] pairs", () => {
    expect(rangeBounds([68, 92])).toEqual({ high: 92, low: 68 });
  });

  it("rejects malformed ranges", () => {
    expect(rangeBounds([68])).toBeNull();
    expect(rangeBounds([])).toBeNull();
  });
});

describe("withinBounds and boundsText", () => {
  it("checks and formats bounds", () => {
    expect(boundsText({ high: 92, low: 68 })).toBe("68–92");
    expect(withinBounds(68, { high: 92, low: 68 })).toBe(true);
    expect(withinBounds(92, { high: 92, low: 68 })).toBe(true);
    expect(withinBounds(95, { high: 92, low: 68 })).toBe(false);
  });
});

describe("percentText", () => {
  it("rounds fractions to whole percentages", () => {
    expect(percentText(0.9375)).toBe("94%");
    expect(percentText(0.9)).toBe("90%");
  });
});

describe("failureText", () => {
  it("humanizes snake_case tokens and capitalizes the sentence", () => {
    expect(failureText("expected role 'mana_ramp' missing")).toBe(
      "Expected role 'Mana Ramp' missing",
    );
    expect(failureText("overall 91 outside [70, 94]")).toBe(
      "Overall 91 outside [70, 94]",
    );
  });
});

describe("sortFailuresFirst", () => {
  it("orders failing cards ahead of passing ones without mutating input", () => {
    const cards = [
      goldenCard("A", true),
      goldenCard("B", false),
      goldenCard("C", true),
    ];
    const sorted = sortFailuresFirst(cards);
    expect(sorted.map((card) => card.name)).toEqual(["B", "A", "C"]);
    expect(cards[0]?.name).toBe("A");
  });
});
