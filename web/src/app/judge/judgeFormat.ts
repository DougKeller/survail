import { titleize } from "../deckPrimitives";

import type { JudgeReferenceCard } from "../../modules/decks/evaluations/contracts";

/** Score bounds parsed from a golden [low, high] range pair. */
export interface ScoreBounds {
  high: number;
  low: number;
}

/** Reads a golden [low, high] pair; null when the range is malformed. */
export function rangeBounds(range: number[]): ScoreBounds | null {
  const low = range[0];
  const high = range[1];
  if (low === undefined || high === undefined) return null;
  return { high, low };
}

export function withinBounds(score: number, bounds: ScoreBounds): boolean {
  return score >= bounds.low && score <= bounds.high;
}

export function boundsText(bounds: ScoreBounds): string {
  return `${String(bounds.low)}–${String(bounds.high)}`;
}

/** "0.9375" → "94%". */
export function percentText(rate: number): string {
  return `${String(Math.round(rate * 100))}%`;
}

const SNAKE_CASE_TOKEN = /\b[a-z]+(?:_[a-z]+)+\b/g;
const QUOTED_TOKEN = /'([a-z]+(?:_[a-z]+)*)'/g;

/** Backend failure strings mention snake_case role names plus quoted
    criterion names and ratings ("'timing' answered 'very_high'");
    humanize them and capitalize the sentence. */
export function failureText(message: string): string {
  const humanized = message
    .replace(QUOTED_TOKEN, (_match, token: string) => `'${titleize(token)}'`)
    .replace(SNAKE_CASE_TOKEN, (token) => titleize(token));
  return humanized.charAt(0).toUpperCase() + humanized.slice(1);
}

/** Failing cards first so misjudged entries are scannable at the top. */
export function sortFailuresFirst(
  cards: JudgeReferenceCard[],
): JudgeReferenceCard[] {
  return [...cards].sort((a, b) => Number(a.passed) - Number(b.passed));
}
