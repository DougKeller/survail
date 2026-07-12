export type CardRole = string;

export type QualitativeRating =
  | "very_low"
  | "low"
  | "neutral"
  | "high"
  | "very_high";

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

export interface CriterionLabel {
  expected_rating: QualitativeRating;
  acceptable_min: QualitativeRating | null;
  acceptable_max: QualitativeRating | null;
}

export interface RoleAnnotationLabelRole {
  role: CardRole;
  notes: string | null;
  criteria: Record<string, CriterionLabel>;
}

export interface RoleAnnotationLabel {
  roles: RoleAnnotationLabelRole[];
}

export interface RoleAnnotationCapture {
  id: string;
  deck_id: string;
  oracle_id: string;
  deck_revision: number;
  evaluator_version: string;
  model: string;
  system_prompt: string;
  input_text: string;
  output: Record<string, unknown>;
  created_at: string;
  labeled_at: string | null;
  label: RoleAnnotationLabel | null;
}

export interface RoleAnnotationQueue {
  unlabeled: RoleAnnotationCapture[];
  labeled: RoleAnnotationCapture[];
}

export interface MetricSummary {
  count: number;
  accuracy: number | null;
  recall: number | null;
  specificity: number | null;
  precision: number | null;
  npv: number | null;
  fpr: number | null;
  fnr: number | null;
  average_partial_credit: number | null;
}

export interface CriterionMetric {
  role: CardRole;
  criterion: string;
  metrics: MetricSummary;
}

export interface SandboxExampleResult {
  capture_id: string;
  oracle_id: string;
  predicted_roles: CardRole[];
  expected_roles: CardRole[];
  role_metrics: Record<string, string>;
  criterion_partial_credit: number | null;
}

export interface SandboxRun {
  id: string;
  model: string;
  system_prompt: string;
  example_count: number;
  created_at: string;
  overall_role_metrics: MetricSummary;
  role_metrics: Record<string, MetricSummary>;
  criterion_metrics: CriterionMetric[];
  results: SandboxExampleResult[];
}
