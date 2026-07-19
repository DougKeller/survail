import { beforeEach, describe, expect, it } from "vitest";

import type { CardSet } from "../../modules/decks/contracts";
import type { CardRoleEvaluation } from "../../modules/decks/evaluations/contracts";

import {
  DEFAULT_ROLE_TARGETS,
  ROLE_QUALITY_THRESHOLDS,
  calculateRoleTargetProgress,
  storedRoleTargets,
  storeRoleTargets,
  withRoleTargetQuality,
  withRoleTargetSetting,
} from "./roleTargets";

function card(
  oracleId: string,
  quantity: number,
  zone: CardSet["zone"] = "mainboard",
  typeLine = "Artifact",
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
      type_line: typeLine,
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
  overallScore = 80,
): CardRoleEvaluation {
  return {
    oracle_id: oracleId,
    deck_revision: 1,
    evaluator_version: "test",
    prompt_version: "test",
    overall_score: overallScore,
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
    expect(DEFAULT_ROLE_TARGETS.quality).toBe("high");
    expect(DEFAULT_ROLE_TARGETS.roles.land).toEqual({ target: 38 });
    expect(DEFAULT_ROLE_TARGETS.roles.mana_ramp).toEqual({ target: 12 });
    expect(DEFAULT_ROLE_TARGETS.roles.card_advantage.target).toBe(12);
    expect(DEFAULT_ROLE_TARGETS.roles.targeted_disruption.target).toBe(12);
    expect(DEFAULT_ROLE_TARGETS.roles.mass_disruption.target).toBe(6);
    expect(DEFAULT_ROLE_TARGETS.roles.enabler.target).toBe(10);
    expect(DEFAULT_ROLE_TARGETS.roles.payoff.target).toBe(10);
    expect(DEFAULT_ROLE_TARGETS.roles.enhancer.target).toBe(10);
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
        roles: {
          ...DEFAULT_ROLE_TARGETS.roles,
          mana_ramp: { target: 12 },
        },
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

  it("counts lands one-for-one and reports their quantity-weighted overall score", () => {
    const progress = calculateRoleTargetProgress({
      cards: [
        card("forest", 8, "mainboard", "Basic Land — Forest"),
        card("island", 2, "mainboard", "Basic Land — Island"),
        card("unscored", 1, "mainboard", "Land"),
      ],
      evaluations: new Map([
        ["forest", evaluation("forest", [["land", 5]], 60)],
        ["island", evaluation("island", [["land", 5]], 100)],
      ]),
      targets: withRoleTargetQuality(DEFAULT_ROLE_TARGETS, "very_high"),
    });

    expect(progress.land.contribution).toBe(11);
    expect(progress.land.averageOverallScore).toBe(68);
    expect(progress.land.qualityThreshold).toBe(100);
  });

  it("excludes commander, sideboard, companion, and considering quantities", () => {
    const cards = [
      card("included", 2, "mainboard", "Land"),
      card("commander", 1, "commander", "Land"),
      card("sideboard", 4, "sideboard", "Land"),
      card("companion", 1, "companion", "Land"),
      card("considering", 3, "considering", "Land"),
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

  it("updates one target without mutating global quality or other roles", () => {
    const next = withRoleTargetSetting(DEFAULT_ROLE_TARGETS, "mana_ramp", {
      target: 14,
    });

    expect(next.roles.mana_ramp).toEqual({ target: 14 });
    expect(next.quality).toBe("high");
    expect(DEFAULT_ROLE_TARGETS.roles.mana_ramp).toEqual({ target: 12 });
  });

  it("persists settings independently by deck id and merges new defaults", () => {
    const configured = {
      ...DEFAULT_ROLE_TARGETS,
      quality: "very_high" as const,
      roles: {
        ...DEFAULT_ROLE_TARGETS.roles,
        mana_ramp: { target: 14 },
      },
    };
    storeRoleTargets("deck/one", configured);

    expect(storedRoleTargets("deck/one").roles.mana_ramp).toEqual({
      target: 14,
    });
    expect(storedRoleTargets("deck/one").quality).toBe("very_high");
    expect(storedRoleTargets("deck/two")).toEqual(DEFAULT_ROLE_TARGETS);
  });

  it("applies one global quality threshold to every role", () => {
    const cards = [card("engine", 1)];
    const scores = new Map([
      [
        "engine",
        evaluation("engine", [
          ["mana_ramp", 50],
          ["card_advantage", 50],
        ]),
      ],
    ]);
    const targets = withRoleTargetQuality(DEFAULT_ROLE_TARGETS, "neutral");

    const progress = calculateRoleTargetProgress({
      cards,
      evaluations: scores,
      targets,
    });

    expect(progress.mana_ramp.contribution).toBe(1);
    expect(progress.card_advantage.contribution).toBe(1);
    expect(progress.mana_ramp.averageOverallScore).toBe(80);
    expect(progress.card_advantage.averageOverallScore).toBe(80);
    expect(progress.mana_ramp.quality).toBe("neutral");
    expect(progress.card_advantage.qualityThreshold).toBe(50);
  });

  it("reports a quantity-weighted overall score for every role", () => {
    const progress = calculateRoleTargetProgress({
      cards: [card("engine", 2), card("tutor", 1)],
      evaluations: new Map([
        [
          "engine",
          evaluation(
            "engine",
            [
              ["mana_ramp", 80],
              ["payoff", 80],
            ],
            60,
          ),
        ],
        ["tutor", evaluation("tutor", [["mana_ramp", 80]], 90)],
      ]),
      targets: DEFAULT_ROLE_TARGETS,
    });

    expect(progress.mana_ramp.averageOverallScore).toBe(70);
    expect(progress.payoff.averageOverallScore).toBe(60);
    expect(progress.enabler.averageOverallScore).toBeNull();
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

    expect(settings.roles.land).toEqual(DEFAULT_ROLE_TARGETS.roles.land);
    expect(settings.roles.mana_ramp).toEqual({ target: 15 });
    expect(settings.quality).toBe("neutral");
    expect(settings.roles.mass_disruption).toEqual(
      DEFAULT_ROLE_TARGETS.roles.mass_disruption,
    );
  });

  it("retains legacy targets and promotes one intentional quality override", () => {
    localStorage.setItem(
      "survail.role-targets:legacy",
      JSON.stringify({
        version: 1,
        roles: {
          land: { target: 40, quality: "high" },
          mana_ramp: { target: 14, quality: "low" },
        },
      }),
    );

    const settings = storedRoleTargets("legacy");

    expect(settings.quality).toBe("low");
    expect(settings.roles.land.target).toBe(40);
    expect(settings.roles.mana_ramp.target).toBe(14);
  });

  it("falls back to High for conflicting legacy qualities", () => {
    localStorage.setItem(
      "survail.role-targets:conflicting",
      JSON.stringify({
        version: 1,
        roles: {
          mana_ramp: { target: 12, quality: "low" },
          card_advantage: { target: 12, quality: "neutral" },
        },
      }),
    );

    expect(storedRoleTargets("conflicting").quality).toBe("high");
  });
});
