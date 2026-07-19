import { beforeEach, describe, expect, it } from "vitest";

import type { CardSet } from "../../modules/decks/contracts";
import type { CardRoleEvaluation } from "../../modules/decks/evaluations/contracts";

import {
  DEFAULT_ROLE_TARGETS,
  ROLE_QUALITY_THRESHOLDS,
  calculateRoleTargetProgress,
  storedRoleTargets,
  storeRoleTargets,
  withRoleTargetSetting,
} from "./roleTargets";

function card(
  oracleId: string,
  quantity: number,
  zone: CardSet["zone"] = "mainboard",
): CardSet {
  return {
    id: `${oracleId}-${zone}`,
    oracle_id: oracleId,
    printing_id: `${oracleId}-printing`,
    card_name: oracleId,
    collector_number: "1",
    finish: "nonfoil",
    note: "",
    quantity,
    set_code: "TST",
    tags: [],
    zone,
    scryfall: {
      id: `${oracleId}-printing`,
      oracle_id: oracleId,
      name: oracleId,
      set: "tst",
      set_name: "Test",
      collector_number: "1",
      type_line: "Artifact",
      mana_cost: null,
      rarity: "common",
      finishes: ["nonfoil"],
      legalities: {},
      cmc: 2,
      colors: [],
      color_identity: [],
      oracle_text: "",
      image_uris: null,
      card_faces: [],
      prices: {
        usd: null,
        usd_foil: null,
        usd_etched: null,
        eur: null,
        eur_foil: null,
        tix: null,
      },
    },
  };
}

function evaluation(
  oracleId: string,
  roles: [role: string, score: number][],
): CardRoleEvaluation {
  return {
    oracle_id: oracleId,
    deck_revision: 1,
    evaluator_version: "test",
    prompt_version: "test",
    overall_score: 80,
    overall_comment: "",
    cached: true,
    roles: roles.map(([role, score]) => ({
      role,
      score,
      description: "",
      answers: {},
    })),
  };
}

describe("weighted role targets", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("uses the published Commander deckbuilding baselines and High quality", () => {
    expect(DEFAULT_ROLE_TARGETS.land).toEqual({ target: 38, quality: "high" });
    expect(DEFAULT_ROLE_TARGETS.mana_ramp).toEqual({
      target: 12,
      quality: "high",
    });
    expect(DEFAULT_ROLE_TARGETS.card_advantage.target).toBe(12);
    expect(DEFAULT_ROLE_TARGETS.targeted_disruption.target).toBe(12);
    expect(DEFAULT_ROLE_TARGETS.mass_disruption.target).toBe(6);
    expect(DEFAULT_ROLE_TARGETS.enabler.target).toBe(10);
    expect(DEFAULT_ROLE_TARGETS.payoff.target).toBe(10);
    expect(DEFAULT_ROLE_TARGETS.enhancer.target).toBe(10);
    expect(ROLE_QUALITY_THRESHOLDS).toEqual({
      very_high: 100,
      high: 75,
      neutral: 50,
      low: 25,
    });
  });

  it("weights each matching mainboard quantity and caps each copy at one", () => {
    const cards = [card("excellent", 1), card("medium", 1)];
    const scores = new Map([
      ["excellent", evaluation("excellent", [["mana_ramp", 80]])],
      ["medium", evaluation("medium", [["mana_ramp", 50]])],
    ]);

    const progress = calculateRoleTargetProgress({
      cards,
      evaluations: scores,
      targets: {
        ...DEFAULT_ROLE_TARGETS,
        mana_ramp: { target: 12, quality: "high" },
      },
    });

    expect(progress.mana_ramp.contribution).toBeCloseTo(1 + 2 / 3);
    expect(progress.mana_ramp.remaining).toBeCloseTo(12 - (1 + 2 / 3));
    expect(progress.mana_ramp.completion).toBeCloseTo((1 + 2 / 3) / 12);
  });

  it("counts all split-printing quantities for an oracle id", () => {
    const progress = calculateRoleTargetProgress({
      cards: [card("ramp", 2), card("ramp", 2)],
      evaluations: new Map([["ramp", evaluation("ramp", [["mana_ramp", 75]])]]),
      targets: DEFAULT_ROLE_TARGETS,
    });

    expect(progress.mana_ramp.contribution).toBe(4);
  });

  it("excludes commander, sideboard, companion, and considering quantities", () => {
    const cards = [
      card("included", 2),
      card("commander", 1, "commander"),
      card("sideboard", 4, "sideboard"),
      card("companion", 1, "companion"),
      card("considering", 3, "considering"),
    ];
    const scores = new Map(
      cards.map((item) => [
        item.oracle_id,
        evaluation(item.oracle_id, [["land", 100]]),
      ]),
    );

    const progress = calculateRoleTargetProgress({
      cards,
      evaluations: scores,
      targets: DEFAULT_ROLE_TARGETS,
    });

    expect(progress.land.contribution).toBe(2);
  });

  it("does not count unscored cards or roles absent from an evaluation", () => {
    const progress = calculateRoleTargetProgress({
      cards: [card("unscored", 4), card("other-role", 2)],
      evaluations: new Map([
        ["other-role", evaluation("other-role", [["payoff", 100]])],
      ]),
      targets: DEFAULT_ROLE_TARGETS,
    });

    expect(progress.mana_ramp.contribution).toBe(0);
    expect(progress.card_selection.completion).toBeNull();
  });

  it("updates one role without mutating the current settings", () => {
    const next = withRoleTargetSetting(DEFAULT_ROLE_TARGETS, "mana_ramp", {
      target: 14,
      quality: "neutral",
    });

    expect(next.mana_ramp).toEqual({ target: 14, quality: "neutral" });
    expect(DEFAULT_ROLE_TARGETS.mana_ramp).toEqual({
      target: 12,
      quality: "high",
    });
  });

  it("persists settings independently by deck id and merges new defaults", () => {
    const configured = {
      ...DEFAULT_ROLE_TARGETS,
      mana_ramp: { target: 14, quality: "very_high" as const },
    };
    storeRoleTargets("deck/one", configured);

    expect(storedRoleTargets("deck/one").mana_ramp).toEqual({
      target: 14,
      quality: "very_high",
    });
    expect(storedRoleTargets("deck/two")).toEqual(DEFAULT_ROLE_TARGETS);
  });

  it("falls back safely when persisted settings are invalid", () => {
    localStorage.setItem(
      "survail.role-targets:bad",
      JSON.stringify({
        version: 1,
        roles: {
          land: { target: -3, quality: "impossible" },
          mana_ramp: { target: 15, quality: "neutral" },
        },
      }),
    );

    const settings = storedRoleTargets("bad");

    expect(settings.land).toEqual(DEFAULT_ROLE_TARGETS.land);
    expect(settings.mana_ramp).toEqual({ target: 15, quality: "neutral" });
    expect(settings.mass_disruption).toEqual(
      DEFAULT_ROLE_TARGETS.mass_disruption,
    );
  });
});
