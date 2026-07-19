import type { CardRoleEvaluation } from "../../decks/evaluations/contracts";

const DISPLAY_HASH_LENGTH = 8;

export function promptVersionLabel(promptVersion: string): string {
  const separator = promptVersion.indexOf("-");
  if (separator < 0) return promptVersion;
  return `${promptVersion.slice(0, separator + 1)}${promptVersion.slice(
    separator + 1,
    separator + 1 + DISPLAY_HASH_LENGTH,
  )}`;
}

export function evaluationProvenanceLabel(
  evaluation: Pick<CardRoleEvaluation, "evaluator_version" | "prompt_version">,
): string {
  return `Judge ${evaluation.evaluator_version} · Prompt ${promptVersionLabel(
    evaluation.prompt_version,
  )}`;
}
