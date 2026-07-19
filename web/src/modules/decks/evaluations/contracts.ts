type CardRole = string;

type QualitativeRating = "very_low" | "low" | "neutral" | "high" | "very_high";

interface CardRoleScore {
  role: CardRole;
  score: number;
  description: string;
  answers: Record<string, QualitativeRating>;
}

export interface CardRoleEvaluation {
  oracle_id: string;
  deck_revision: number;
  evaluator_version: string;
  prompt_version: string;
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

export interface JudgeGoldenExpectation {
  must_roles: string[];
  forbid_roles: string[];
  role_score_ranges: Record<string, number[]>;
  role_criteria: Record<string, Record<string, string[]>>;
  overall_range: number[];
}

export interface JudgeReferenceCard {
  name: string;
  deck_title: string;
  image_uri: string | null;
  mana_cost: string | null;
  type_line: string | null;
  expectation: JudgeGoldenExpectation;
  result: {
    overall_score: number;
    overall_comment: string;
    roles: CardRoleScore[];
  } | null;
  passed: boolean;
  failures: string[];
}

export interface JudgeReference {
  evaluator_version: string;
  model: string;
  min_pass_rate: number;
  pass_rate: number;
  passed_cards: number;
  total_cards: number;
  deck_title: string;
  deck_goal: string;
  decks: { title: string; goal: string }[];
  cards: JudgeReferenceCard[];
}

type EvaluationFeedbackVerdict = "up" | "down";

export interface EvaluationFeedbackRequest {
  oracle_id: string;
  evaluator_version: string;
  prompt_version: string;
  scope: string;
  verdict: EvaluationFeedbackVerdict;
  reason: string;
  expected_added_roles: string[];
  expected_removed_roles: string[];
  expected_criteria: Record<string, QualitativeRating>;
}
