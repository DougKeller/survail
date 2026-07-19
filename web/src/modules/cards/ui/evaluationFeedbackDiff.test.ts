import { describe, expect, it } from "vitest";

import type { CardRoleEvaluation } from "../../decks/evaluations/contracts";
import {
  buildFeedbackRequest,
  selectableRoles,
} from "./evaluationFeedbackDiff";

const evaluation: CardRoleEvaluation = {
  oracle_id: "oracle-2",
  deck_revision: 0,
  evaluator_version: "roles-v2",
  prompt_version: "gepa-1234567890abcdef",
  overall_score: 90,
  overall_comment: "Great acceleration.",
  roles: [
    {
      role: "mana_ramp",
      score: 90,
      description: "Fast mana.",
      answers: { speed: "very_high", permanence: "high" },
    },
    {
      role: "surveil_synergy",
      score: 40,
      description: "Off-list role.",
      answers: { depth: "low" },
    },
  ],
  cached: false,
};

describe("buildFeedbackRequest", () => {
  it("submits empty diffs for a thumbs-up, even with stale form state", () => {
    const request = buildFeedbackRequest(evaluation, {
      scope: "overall",
      verdict: "up",
      reason: "  Spot on.  ",
      selectedRoles: ["land"],
      criteria: { speed: "low" },
    });
    expect(request).toEqual({
      oracle_id: "oracle-2",
      evaluator_version: "roles-v2",
      prompt_version: "gepa-1234567890abcdef",
      scope: "overall",
      verdict: "up",
      reason: "Spot on.",
      expected_added_roles: [],
      expected_removed_roles: [],
      expected_criteria: {},
    });
  });

  it("diffs the overall role selection into additions and removals only", () => {
    const request = buildFeedbackRequest(evaluation, {
      scope: "overall",
      verdict: "down",
      reason: "Not ramp.",
      // mana_ramp toggled off, payoff toggled on, surveil_synergy untouched.
      selectedRoles: ["surveil_synergy", "payoff"],
      criteria: {},
    });
    expect(request.expected_added_roles).toEqual(["payoff"]);
    expect(request.expected_removed_roles).toEqual(["mana_ramp"]);
    expect(request.expected_criteria).toEqual({});
    expect(request.scope).toBe("overall");
    expect(request.verdict).toBe("down");
  });

  it("keeps unchanged roles out of the overall payload entirely", () => {
    const request = buildFeedbackRequest(evaluation, {
      scope: "overall",
      verdict: "down",
      reason: "",
      selectedRoles: ["mana_ramp", "surveil_synergy"],
      criteria: {},
    });
    expect(request.expected_added_roles).toEqual([]);
    expect(request.expected_removed_roles).toEqual([]);
  });

  it("includes only criteria whose expected rating differs from actual", () => {
    const request = buildFeedbackRequest(evaluation, {
      scope: "mana_ramp",
      verdict: "down",
      reason: "Slower than judged.",
      selectedRoles: [],
      criteria: { speed: "high", permanence: "high" },
    });
    expect(request.scope).toBe("mana_ramp");
    expect(request.expected_criteria).toEqual({ speed: "high" });
    expect(request.expected_added_roles).toEqual([]);
    expect(request.expected_removed_roles).toEqual([]);
  });

  it("submits an empty criteria diff when nothing was changed", () => {
    const request = buildFeedbackRequest(evaluation, {
      scope: "mana_ramp",
      verdict: "down",
      reason: "Score feels off overall.",
      selectedRoles: [],
      criteria: { speed: "very_high", permanence: "high" },
    });
    expect(request.expected_criteria).toEqual({});
  });
});

describe("selectableRoles", () => {
  it("appends judged roles missing from the preferred ordering", () => {
    expect(
      selectableRoles(["land", "mana_ramp", "payoff"], evaluation),
    ).toEqual(["land", "mana_ramp", "payoff", "surveil_synergy"]);
  });
});
