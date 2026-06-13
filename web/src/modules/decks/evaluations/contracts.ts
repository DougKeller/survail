export type CardRole =
  | "land"
  | "mana_ramp"
  | "card_advantage"
  | "removal"
  | "board_wipe"
  | "enabler"
  | "enhancer"
  | "payoff";

interface QualitativeAnswer {
  criterion_id: string;
  rating: "very_low" | "low" | "neutral" | "high" | "very_high";
  score: number;
}

interface CardRoleScore {
  role: CardRole;
  score: number;
  description: string;
  answers: QualitativeAnswer[];
}

export interface CardRoleEvaluation {
  oracle_id: string;
  deck_revision: number;
  evaluator_version: string;
  overall_score: number;
  overall_comment: string;
  roles: CardRoleScore[];
  cached: boolean;
}

export interface CardEvaluationProgress {
  completed: number;
  total: number;
  average_seconds_per_card: number | null;
  eta_seconds: number | null;
}
