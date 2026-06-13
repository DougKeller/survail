import time
from collections.abc import Callable

from openai import APIConnectionError, APIStatusError, APITimeoutError, OpenAI, RateLimitError

from survail.integrations.openai.schemas import StructuredDeckDescription

TARGET_DESCRIPTION_WORDS = "120 to 180 words"
MAX_DESCRIPTION_OUTPUT_TOKENS = 1000
TRANSIENT_STATUS_CODES = frozenset({408, 409, 429, 500, 502, 503, 504})


class DeckDescriptionClient:
    def __init__(
        self,
        api_key: str,
        model: str,
        *,
        client: OpenAI | None = None,
        max_attempts: int = 4,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        if not api_key:
            raise ValueError("OPENAI_API_KEY is required")
        if not model:
            raise ValueError("An OpenAI description model is required")
        if max_attempts < 1:
            raise ValueError("max_attempts must be positive")
        self._model = model
        self._client = client or OpenAI(api_key=api_key, max_retries=0)
        self._max_attempts = max_attempts
        self._sleep = sleep

    def close(self) -> None:
        return

    def generate(self, context: str) -> StructuredDeckDescription:
        for attempt in range(self._max_attempts):
            try:
                response = self._client.responses.parse(
                    model=self._model,
                    instructions=(
                        "Return a structured deck overview with four fields only: overview, "
                        "early_game, midgame, and lategame. The overview should be exactly four "
                        "sentences: one sentence stating the plan and win condition; two sentences "
                        "describing the most important synergies and interactions; one sentence "
                        "describing the main weakness. early_game, midgame, and lategame should "
                        "each be one concise sentence. "
                        f"Aim for about {TARGET_DESCRIPTION_WORDS} total. Base every claim only on "
                        "supplied format and card data. Do not list every card or invent absent "
                        "cards. Whenever you cite a card by name, wrap its exact supplied title in "
                        "double square brackets, for example [[Ephemerate]]."
                    ),
                    input=context,
                    text_format=StructuredDeckDescription,
                    max_output_tokens=MAX_DESCRIPTION_OUTPUT_TOKENS,
                )
                if response.output_parsed is None:
                    raise ValueError("OpenAI returned no deck description")
                return response.output_parsed
            except (RateLimitError, APITimeoutError, APIConnectionError, APIStatusError) as error:
                if attempt + 1 == self._max_attempts or not self._is_retryable(error):
                    raise
                self._sleep(self._retry_delay(error, attempt))
        raise RuntimeError("Description retry loop exited unexpectedly")

    @staticmethod
    def _is_retryable(error: Exception) -> bool:
        return not isinstance(error, APIStatusError) or error.status_code in TRANSIENT_STATUS_CODES

    @staticmethod
    def _retry_delay(error: Exception, attempt: int) -> float:
        if isinstance(error, APIStatusError):
            retry_after = error.response.headers.get("retry-after")
            if retry_after is not None:
                try:
                    return min(float(retry_after), 60)
                except ValueError:
                    pass
        return float(min(2**attempt, 60))


class OpenAIDeckDescriptionGenerator:
    def __init__(self, api_key: str, model: str) -> None:
        self._api_key = api_key
        self._model = model

    def generate(self, context: str) -> StructuredDeckDescription:
        client = DeckDescriptionClient(self._api_key, self._model)
        try:
            return client.generate(context)
        finally:
            client.close()
