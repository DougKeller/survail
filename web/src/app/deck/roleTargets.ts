import type { CardSet } from "../../modules/decks/contracts";
import type { CardRoleEvaluation } from "../../modules/decks/evaluations/contracts";

export const ROLE_QUALITY_THRESHOLDS = {
  very_high: 100,
  high: 75,
  neutral: 50,
  low: 25,
} as const;

export const ROLE_TARGET_ROLES = [
  "land",
  "mana_ramp",
  "card_advantage",
  "card_selection",
  "targeted_disruption",
  "mass_disruption",
  "enabler",
  "payoff",
  "enhancer",
] as const;

export const ROLE_TARGET_QUALITY_OPTIONS = [
  { value: "very_high", label: "Very High", threshold: 100 },
  { value: "high", label: "High", threshold: 75 },
  { value: "neutral", label: "Neutral", threshold: 50 },
  { value: "low", label: "Low", threshold: 25 },
] as const;

export type RoleTargetQuality = keyof typeof ROLE_QUALITY_THRESHOLDS;
export type RoleTargetRole = (typeof ROLE_TARGET_ROLES)[number];

export interface RoleTargetSetting {
  target: number;
}

export interface RoleTargets {
  quality: RoleTargetQuality;
  roles: Record<RoleTargetRole, RoleTargetSetting>;
}

export interface RoleTargetProgress {
  /** Quantity-weighted across scored mainboard cards assigned to this role. */
  averageOverallScore: number | null;
  contribution: number;
  target: number;
  remaining: number;
  /** Null means that this role has no configured target. */
  completion: number | null;
  quality: RoleTargetQuality;
  qualityThreshold: number;
}

export type RoleTargetProgressByRole = Record<
  RoleTargetRole,
  RoleTargetProgress
>;

interface CalculateRoleTargetProgressOptions {
  cards: readonly CardSet[];
  evaluations: ReadonlyMap<string, CardRoleEvaluation>;
  targets: RoleTargets;
}

const DEFAULT_TARGET_QUANTITIES: Record<RoleTargetRole, number> = {
  land: 38,
  mana_ramp: 12,
  card_advantage: 12,
  card_selection: 0,
  targeted_disruption: 12,
  mass_disruption: 6,
  enabler: 10,
  payoff: 10,
  enhancer: 10,
};

/**
 * Commander fundamentals recommend the first six non-zero quantities and
 * roughly 30 plan cards, represented as ten each for enabler/payoff/enhancer.
 * They do not publish a card-selection quantity, so its target is unconfigured.
 */
export const DEFAULT_ROLE_TARGETS: RoleTargets = {
  quality: "high",
  roles: Object.fromEntries(
    ROLE_TARGET_ROLES.map((role) => [
      role,
      { target: DEFAULT_TARGET_QUANTITIES[role] },
    ]),
  ) as Record<RoleTargetRole, RoleTargetSetting>,
};

const QUALITY_VALUES = new Set<string>(Object.keys(ROLE_QUALITY_THRESHOLDS));

function isRoleTargetQuality(value: unknown): value is RoleTargetQuality {
  return typeof value === "string" && QUALITY_VALUES.has(value);
}

function validTarget(value: unknown): number | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as { target?: unknown };
  if (
    typeof candidate.target !== "number" ||
    !Number.isInteger(candidate.target) ||
    candidate.target < 0
  )
    return null;
  return candidate.target;
}

function storageKey(deckId: string): string {
  return `survail.role-targets:${encodeURIComponent(deckId)}`;
}

function defaultTargets(): RoleTargets {
  return {
    quality: DEFAULT_ROLE_TARGETS.quality,
    roles: Object.fromEntries(
      ROLE_TARGET_ROLES.map((role) => [
        role,
        { ...DEFAULT_ROLE_TARGETS.roles[role] },
      ]),
    ) as Record<RoleTargetRole, RoleTargetSetting>,
  };
}

function legacyQuality(roles: Record<string, unknown>): RoleTargetQuality {
  const qualities = ROLE_TARGET_ROLES.flatMap((role) => {
    const value = roles[role];
    if (typeof value !== "object" || value === null) return [];
    const quality = (value as { quality?: unknown }).quality;
    return isRoleTargetQuality(quality) ? [quality] : [];
  });
  const nonDefault = [
    ...new Set(qualities.filter((quality) => quality !== "high")),
  ];
  return nonDefault.length === 1 ? (nonDefault[0] ?? "high") : "high";
}

export function storedRoleTargets(deckId: string): RoleTargets {
  const defaults = defaultTargets();
  const stored = localStorage.getItem(storageKey(deckId));
  if (stored === null) return defaults;
  try {
    const parsed = JSON.parse(stored) as {
      version?: unknown;
      quality?: unknown;
      roles?: unknown;
    };
    if (
      (parsed.version !== 1 && parsed.version !== 2) ||
      typeof parsed.roles !== "object" ||
      parsed.roles === null
    )
      return defaults;
    const storedRoles = parsed.roles as Record<string, unknown>;
    defaults.quality =
      parsed.version === 2 && isRoleTargetQuality(parsed.quality)
        ? parsed.quality
        : legacyQuality(storedRoles);
    for (const role of ROLE_TARGET_ROLES) {
      const target = validTarget(storedRoles[role]);
      if (target !== null) defaults.roles[role] = { target };
    }
    return defaults;
  } catch {
    return defaults;
  }
}

export function storeRoleTargets(deckId: string, targets: RoleTargets): void {
  localStorage.setItem(
    storageKey(deckId),
    JSON.stringify({
      version: 2,
      quality: targets.quality,
      roles: targets.roles,
    }),
  );
}

export function withRoleTargetSetting(
  targets: RoleTargets,
  role: RoleTargetRole,
  setting: RoleTargetSetting,
): RoleTargets {
  return {
    ...targets,
    roles: { ...targets.roles, [role]: { ...setting } },
  };
}

export function withRoleTargetQuality(
  targets: RoleTargets,
  quality: RoleTargetQuality,
): RoleTargets {
  return { ...targets, quality };
}

function roleScore(
  evaluation: CardRoleEvaluation | undefined,
  role: RoleTargetRole,
): number | null {
  const score = evaluation?.roles.find((item) => item.role === role)?.score;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}

export function calculateRoleTargetProgress({
  cards,
  evaluations,
  targets,
}: CalculateRoleTargetProgressOptions): RoleTargetProgressByRole {
  const contributions = Object.fromEntries(
    ROLE_TARGET_ROLES.map((role) => [role, 0]),
  ) as Record<RoleTargetRole, number>;
  const overallScoreTotals = Object.fromEntries(
    ROLE_TARGET_ROLES.map((role) => [role, 0]),
  ) as Record<RoleTargetRole, number>;
  const scoredQuantities = Object.fromEntries(
    ROLE_TARGET_ROLES.map((role) => [role, 0]),
  ) as Record<RoleTargetRole, number>;

  for (const card of cards) {
    if (card.zone !== "mainboard" || card.quantity <= 0) continue;
    const evaluation = evaluations.get(card.oracle_id);
    const isLand = /\bLand\b/.test(card.scryfall.type_line);
    if (isLand) {
      contributions.land += card.quantity;
      if (
        evaluation !== undefined &&
        Number.isFinite(evaluation.overall_score)
      ) {
        overallScoreTotals.land += card.quantity * evaluation.overall_score;
        scoredQuantities.land += card.quantity;
      }
    }
    for (const role of ROLE_TARGET_ROLES) {
      if (role === "land") continue;
      const score = roleScore(evaluation, role);
      if (score === null) continue;
      if (
        evaluation !== undefined &&
        Number.isFinite(evaluation.overall_score)
      ) {
        overallScoreTotals[role] += card.quantity * evaluation.overall_score;
        scoredQuantities[role] += card.quantity;
      }
      const threshold = ROLE_QUALITY_THRESHOLDS[targets.quality];
      const contribution = Math.min(1, Math.max(0, score) / threshold);
      contributions[role] += card.quantity * contribution;
    }
  }

  return Object.fromEntries(
    ROLE_TARGET_ROLES.map((role) => {
      const setting = targets.roles[role];
      const contribution = contributions[role];
      return [
        role,
        {
          averageOverallScore:
            scoredQuantities[role] === 0
              ? null
              : overallScoreTotals[role] / scoredQuantities[role],
          contribution,
          target: setting.target,
          remaining: Math.max(0, setting.target - contribution),
          completion:
            setting.target === 0
              ? null
              : Math.min(1, contribution / setting.target),
          quality: targets.quality,
          qualityThreshold: ROLE_QUALITY_THRESHOLDS[targets.quality],
        },
      ];
    }),
  ) as RoleTargetProgressByRole;
}
