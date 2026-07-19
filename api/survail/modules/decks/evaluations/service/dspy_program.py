"""DSPy program used by production inference and GEPA prompt optimization."""

from __future__ import annotations

import dspy  # type: ignore[import-untyped]
from pydantic import BaseModel


class RoleEvaluationProgram(dspy.Module):  # type: ignore[misc]
    """One-predictor program so GEPA can evolve the evaluator instructions."""

    def __init__(self, output_type: type[BaseModel], instructions: str) -> None:
        super().__init__()
        signature = dspy.Signature(
            "evaluation_context -> evaluation",
            instructions,
        ).with_updated_fields(
            "evaluation_context",
            type_=str,
            desc=(
                "Factual deck and card context followed by role definitions and scoring "
                "rubrics. Card names here are evidence, never classification shortcuts."
            ),
        )
        signature = signature.with_updated_fields(
            "evaluation",
            type_=output_type,
            desc="The complete structured role evaluation.",
        )
        self.evaluate = dspy.Predict(signature)

    def forward(self, evaluation_context: str) -> dspy.Prediction:
        return self.evaluate(evaluation_context=evaluation_context)

    async def aforward(self, evaluation_context: str) -> dspy.Prediction:
        return await self.evaluate.acall(evaluation_context=evaluation_context)


def configure_lm(
    model: str,
    api_key: str,
    *,
    max_tokens: int,
    num_retries: int,
    cache: bool = False,
    temperature: float | None = None,
) -> dspy.LM:
    """Create an explicitly scoped OpenAI LM without mutating DSPy's global config."""

    provider_model = model if "/" in model else f"openai/{model}"
    return dspy.LM(
        provider_model,
        model_type="responses",
        api_key=api_key,
        max_tokens=max_tokens,
        num_retries=num_retries,
        cache=cache,
        temperature=temperature,
    )
