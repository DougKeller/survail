interface AnalyticsBucket {
  key: string;
  label: string;
  quantity: number;
  percentage: number;
}

interface MissingRoleEvaluationCard {
  oracle_id: string;
  card_name: string;
}

interface RoleDistribution {
  available: boolean;
  complete: boolean;
  evaluated_cards: number;
  total_cards: number;
  unevaluated_cards: number;
  message: string | null;
  buckets: AnalyticsBucket[];
  missing_cards: MissingRoleEvaluationCard[];
}

export interface DeckAnalytics {
  total_cards: number;
  unique_cards: number;
  nonland_cards: number;
  mana_curve: AnalyticsBucket[];
  color_distribution: AnalyticsBucket[];
  type_distribution: AnalyticsBucket[];
  role_distribution: RoleDistribution;
}
